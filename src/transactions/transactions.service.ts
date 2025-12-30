/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { DataSource, EntityManager, In, MoreThan, Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { EsimInvoice } from '../entities/esim-invoice.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { Transaction } from '../entities/transaction.entity';
import { CURRENCY_CONSTANTS } from '../marketplace/constants/currency.constants';
import {
  TransactionStatus,
  TransactionType,
} from '../users/dto/transaction-types.enum';
import { WalletService } from '../wallet/wallet.service';
import { InquiryPackagesService } from '../inquiry/services/inquiry.packages.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CustomerPurchaseDto } from './dto/customer-purchase.dto';
import { OrderEsimDto } from './dto/order-esim.dto';
import { PurchaseEsimDto } from './dto/purchase-esim.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { QueryEsimDto } from './dto/query-esim.dto';
import { QpayConnectionService } from './services/qpay.connection.service';
import { MailService } from './services/mail.service';
import { User } from 'src/entities/user.entity';
import { DataPackageEntity } from 'src/entities/data-packages.entity';

export interface EsimItem {
  esimTranNo: string;
  orderNo: string;
  transactionId: string;
  imsi: string;
  iccid: string;
  smsStatus: number;
  msisdn: string;
  ac: string;
  qrCodeUrl: string;
  shortUrl: string;
  smdpStatus: string;
  eid: string;
  activeType: number;
  dataType: number;
  activateTime: string;
  expiredTime: string;
  installationTime: string;
  totalVolume: number;
  totalDuration: number;
  durationUnit: string;
  orderUsage: number;
  esimStatus: string;
  pin: string;
  puk: string;
  apn: string;
  ipExport: string;
  supportTopUpType: number;
  fupPolicy: string;
  packageList: EsimPackage[];
}

export interface EsimPackage {
  packageName: string;
  packageCode: string;
  slug: string;
  duration: number;
  volume: number;
  locationCode: string;
  createTime: string;
  esimTranNo: string;
  transactionId: string;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  private readonly apiBaseUrl = 'https://api.esimaccess.com/api/v1';
  private readonly accessCode = process.env.ESIM_ACCESS_CODE;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ESimPurchase)
    private readonly esimPurchaseRepository: Repository<ESimPurchase>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(EsimInvoice)
    private readonly esimInvoiceRepository: Repository<EsimInvoice>,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly qpayConnectionService: QpayConnectionService,
    @Inject(forwardRef(() => InquiryPackagesService))
    private readonly inquiryPackagesService: InquiryPackagesService,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(DataPackageEntity)
    private readonly dataPackageRepo: Repository<DataPackageEntity>,
  ) {}

  /**
   * Generate unique transaction ID
   * Format: TXN-YYYYMMDD-XXXXXX (e.g., TXN-20240101-A1B2C3)
   */
  private generateTransactionId(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${dateStr}-${randomStr}`;
  }

  /**
   * Process a transaction - charges money from user's wallet
   * @param userId - The ID of the user making the transaction
   * @param createTransactionDto - Transaction details
   * @returns The created transaction
   * @throws NotFoundException if user/wallet not found
   * @throws BadRequestException if balance is insufficient or invalid data
   */
  async processTransaction(
    userId: string,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    // Validate transaction type for withdrawals
    if (createTransactionDto.type === TransactionType.WITHDRAWAL) {
      // Check if user has sufficient balance
      const hasBalance = await this.walletService.hasSufficientBalance(
        userId,
        createTransactionDto.amount,
      );

      if (!hasBalance) {
        const balance = await this.walletService.getBalance(userId);
        throw new BadRequestException(
          `Insufficient balance. Current balance: ${balance.toFixed(2)}, Required: ${createTransactionDto.amount.toFixed(2)}`,
        );
      }
    }

    // Use transaction for atomicity
    return await this.dataSource.transaction(async (manager) => {
      const transactionRepository = manager.getRepository(Transaction);

      // Get wallet info for currency and balance
      // This will auto-create wallet if it doesn't exist
      const { balance: currentBalance, currency } =
        await this.walletService.getBalanceWithCurrency(userId);

      // Get wallet entity (it should exist now after getBalanceWithCurrency)
      // We need the wallet ID for the transaction record
      let wallet;
      try {
        wallet = await this.walletService.getWallet(userId);
      } catch {
        // If wallet still doesn't exist (shouldn't happen), create it by getting balance again
        await this.walletService.getBalance(userId);
        wallet = await this.walletService.getWallet(userId);
      }

      // Generate unique transaction ID
      let transactionId = this.generateTransactionId();
      // Ensure uniqueness (retry if collision - extremely rare)
      let attempts = 0;
      while (
        (await transactionRepository.findOne({
          where: { transactionId },
        })) &&
        attempts < 10
      ) {
        transactionId = this.generateTransactionId();
        attempts++;
      }

      // Create transaction record with PENDING status
      const transaction = transactionRepository.create({
        transactionId,
        userId,
        walletId: wallet.id,
        type: createTransactionDto.type,
        status: TransactionStatus.PENDING,
        amount: createTransactionDto.amount,
        currency,
        balanceBefore: Number(currentBalance),
        description: createTransactionDto.description || null,
        referenceId: createTransactionDto.referenceId || null,
        metadata: createTransactionDto.metadata || null,
      });

      // Save transaction first
      const savedTransaction = await transactionRepository.save(transaction);

      try {
        // Process the transaction based on type
        let newBalance: number;
        let updatedWallet;

        if (createTransactionDto.type === TransactionType.WITHDRAWAL) {
          // Deduct balance from wallet
          updatedWallet = await this.walletService.deductBalance(
            userId,
            createTransactionDto.amount,
            {
              transactionId: savedTransaction.transactionId,
              description: createTransactionDto.description,
            },
          );
          newBalance = Number(updatedWallet.balance);
        } else if (createTransactionDto.type === TransactionType.DEPOSIT) {
          // Add balance to wallet
          updatedWallet = await this.walletService.addBalance(
            userId,
            createTransactionDto.amount,
          );
          newBalance = Number(updatedWallet.balance);
        } else {
          // For other types (REFUND, TRANSFER, ADJUSTMENT), handle as needed
          // For now, we'll just record them without balance changes
          newBalance = Number(currentBalance);
        }

        // Update transaction with final status and balance
        savedTransaction.status = TransactionStatus.COMPLETED;
        savedTransaction.balanceAfter = newBalance;
        savedTransaction.completedAt = new Date();

        const completedTransaction =
          await transactionRepository.save(savedTransaction);

        this.logger.log(
          `Transaction completed: ${transactionId}, User: ${userId}, Type: ${createTransactionDto.type}, Amount: ${createTransactionDto.amount}`,
        );

        return completedTransaction;
      } catch (error) {
        // Mark transaction as failed
        savedTransaction.status = TransactionStatus.FAILED;
        savedTransaction.failureReason =
          error instanceof Error ? error.message : 'Unknown error';
        savedTransaction.balanceAfter = Number(currentBalance);

        await transactionRepository.save(savedTransaction);

        this.logger.error(
          `Transaction failed: ${transactionId}, User: ${userId}, Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        );

        throw error;
      }
    });
  }

  /**
   * Get transaction by ID
   * @param transactionId - The transaction ID
   * @param userId - Optional user ID to ensure ownership
   * @returns The transaction
   * @throws NotFoundException if transaction not found
   */
  async getTransactionById(
    transactionId: string,
    userId?: string,
  ): Promise<Transaction> {
    const where: any = { transactionId };
    if (userId) {
      where.userId = userId;
    }

    const transaction = await this.transactionRepository.findOne({
      where,
      relations: ['user', 'wallet'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Get transactions for a user with filters and pagination
   * @param userId - The user ID
   * @param queryDto - Query parameters
   * @returns List of transactions with pagination info
   */
  async getUserTransactions(
    userId: string,
    queryDto: QueryTransactionsDto,
  ): Promise<{
    transactions: (Transaction & { esimPurchase?: ESimPurchase })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // Build query with eSIM purchase join
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect(
        'esim_purchases',
        'esimPurchase',
        'esimPurchase.transactionId = transaction.transactionId',
      )
      .where('transaction.userId = :userId', { userId })
      .orderBy('transaction.createdAt', 'DESC');

    // Apply filters
    if (queryDto.type) {
      queryBuilder.andWhere('transaction.type = :type', {
        type: queryDto.type,
      });
    }

    if (queryDto.status) {
      queryBuilder.andWhere('transaction.status = :status', {
        status: queryDto.status,
      });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate: queryDto.startDate,
      });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', {
        endDate: queryDto.endDate,
      });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const transactions = await queryBuilder.skip(skip).take(limit).getMany();

    // Load eSIM purchases for transactions that have them
    const transactionIds = transactions
      .map((t) => t.transactionId)
      .filter((id) => id);

    const esimPurchases =
      transactionIds.length > 0
        ? await this.esimPurchaseRepository.find({
            where: { transactionId: In(transactionIds) },
          })
        : [];

    // Map eSIM purchases to transactions
    const transactionsWithEsim = transactions.map((transaction) => {
      const esimPurchase = esimPurchases.find(
        (ep) => ep.transactionId === transaction.transactionId,
      );
      return {
        ...transaction,
        esimPurchase,
      };
    });

    return {
      transactions: transactionsWithEsim,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get transaction by unique transaction ID
   * @param transactionId - The unique transaction ID
   * @returns The transaction
   * @throws NotFoundException if transaction not found
   */
  async getTransactionByTransactionId(
    transactionId: string,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { transactionId },
      relations: ['user', 'wallet'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Purchase an eSIM card
   * Creates a transaction and eSIM purchase record
   * Charges money from user's wallet
   * @param userId - The ID of the user purchasing the eSIM
   * @param purchaseEsimDto - eSIM purchase details
   * @returns The transaction and eSIM purchase details
   * @throws BadRequestException if balance is insufficient
   */
  async purchaseEsim(
    userId: string,
    purchaseEsimDto: PurchaseEsimDto,
  ): Promise<{ transaction: Transaction; purchase: ESimPurchase }> {
    // First, create the transaction (this handles wallet charging)
    const transaction = await this.processTransaction(userId, {
      type: TransactionType.WITHDRAWAL,
      amount: purchaseEsimDto.price,
      description: `Purchase eSIM: ${purchaseEsimDto.packageName}`,
      referenceId: purchaseEsimDto.packageCode,
      metadata: {
        packageCode: purchaseEsimDto.packageCode,
        slug: purchaseEsimDto.slug,
        packageName: purchaseEsimDto.packageName,
        dataVolume: purchaseEsimDto.dataVolume,
        duration: purchaseEsimDto.duration,
        durationUnit: purchaseEsimDto.durationUnit,
        location: purchaseEsimDto.location,
        isEsimPurchase: true,
      },
    });

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(
      purchaseEsimDto.duration,
      purchaseEsimDto.durationUnit,
    );

    // Create eSIM purchase record
    const esimPurchase = this.esimPurchaseRepository.create({
      userId,
      transactionId: transaction.transactionId,
      packageCode: purchaseEsimDto.packageCode,
      slug: purchaseEsimDto.slug,
      packageName: purchaseEsimDto.packageName,
      price: purchaseEsimDto.price,
      currency: purchaseEsimDto.currency,
      dataVolume: purchaseEsimDto.dataVolume,
      duration: purchaseEsimDto.duration,
      durationUnit: purchaseEsimDto.durationUnit,
      location: purchaseEsimDto.location,
      description: purchaseEsimDto.description || null,
      packageMetadata: purchaseEsimDto.packageMetadata || null,
      expiresAt,
      isActivated: false,
      isActive: true,
    });

    const savedPurchase = await this.esimPurchaseRepository.save(esimPurchase);

    this.logger.log(
      `eSIM purchased: ${purchaseEsimDto.packageCode}, User: ${userId}, Transaction: ${transaction.transactionId}`,
    );

    return {
      transaction,
      purchase: savedPurchase,
    };
  }

  /**
   * Get user's eSIM purchases
   * @param userId - The user ID
   * @returns List of eSIM purchases
   */
  async getUserEsimPurchases(userId: string): Promise<ESimPurchase[]> {
    return await this.esimPurchaseRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get eSIM purchase by ID
   * @param purchaseId - The purchase ID
   * @param userId - Optional user ID to ensure ownership
   * @returns The eSIM purchase
   * @throws NotFoundException if not found
   */
  async getEsimPurchaseById(
    purchaseId: string,
    userId?: string,
  ): Promise<ESimPurchase> {
    const where: any = { id: purchaseId };
    if (userId) {
      where.userId = userId;
    }

    const purchase = await this.esimPurchaseRepository.findOne({
      where,
      relations: ['user'],
    });

    if (!purchase) {
      throw new NotFoundException('eSIM purchase not found');
    }

    return purchase;
  }

  /**
   * Get eSIM purchase by package code for a user
   * @param userId - The user ID
   * @param packageCode - The package code
   * @returns List of purchases with this package code
   */
  async getEsimPurchasesByPackageCode(
    userId: string,
    packageCode: string,
  ): Promise<ESimPurchase[]> {
    return await this.esimPurchaseRepository.find({
      where: { userId, packageCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get eSIM purchase by transaction ID
   * Note: For user purchases, this returns the purchase linked to the Transaction.
   * For customer purchases, transactionId is unique per SIM, so this will return one purchase.
   * @param transactionId - The transaction ID
   * @param userId - Optional user ID to ensure ownership (only for user purchases)
   * @returns The eSIM purchase or null if not found
   */
  async getEsimPurchaseByTransactionId(
    transactionId: string,
    userId?: string,
  ): Promise<ESimPurchase | null> {
    const where: any = { transactionId };
    if (userId) {
      where.userId = userId;
    }

    return await this.esimPurchaseRepository.findOne({
      where,
    });
  }

  /**
   * Get eSIM purchases by invoice ID (for customer purchases)
   * @param invoiceId - The invoice ID
   * @returns List of eSIM purchases for this invoice
   */
  async getEsimPurchasesByInvoiceId(
    invoiceId: string,
  ): Promise<ESimPurchase[]> {
    return await this.esimPurchaseRepository.find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
      relations: ['customer'],
    });
  }

  /**
   * Calculate expiration date based on duration and unit
   * @param duration - Duration value
   * @param durationUnit - Duration unit (DAY, MONTH, etc.)
   * @returns Expiration date
   */
  private calculateExpirationDate(
    duration: number,
    durationUnit: string,
  ): Date {
    const now = new Date();
    const expirationDate = new Date(now);

    switch (durationUnit.toUpperCase()) {
      case 'DAY':
      case 'DAYS':
        expirationDate.setDate(now.getDate() + duration);
        break;
      case 'MONTH':
      case 'MONTHS':
        expirationDate.setMonth(now.getMonth() + duration);
        break;
      case 'YEAR':
      case 'YEARS':
        expirationDate.setFullYear(now.getFullYear() + duration);
        break;
      case 'HOUR':
      case 'HOURS':
        expirationDate.setHours(now.getHours() + duration);
        break;
      default:
        // Default to days if unit is unknown
        expirationDate.setDate(now.getDate() + duration);
    }

    return expirationDate;
  }

  /**
   * Order eSIM profiles from eSIM Access API
   * Deducts balance from user's wallet and places order with eSIM provider
   * @param userId - The ID of the user ordering the eSIM
   * @param orderEsimDto - Order details including packages and amount
   * @returns Order response with orderNo and transaction details
   * @throws BadRequestException if balance is insufficient or order fails
   */
  async orderEsim(
    userId: string,
    orderEsimDto: OrderEsimDto,
  ): Promise<{
    orderNo: string;
    transactionId: string;
    amount: number;
    transactionStatus: string;
    balanceBefore: number;
    balanceAfter: number;
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    // Generate transaction ID if not provided
    let transactionId = orderEsimDto.transactionId;
    if (!transactionId) {
      transactionId = this.generateTransactionId();
      // Ensure uniqueness (retry if collision - extremely rare)
      let attempts = 0;
      while (
        (await this.transactionRepository.findOne({
          where: { transactionId },
        })) &&
        attempts < 10
      ) {
        transactionId = this.generateTransactionId();
        attempts++;
      }
    } else {
      // Check if provided transaction ID already exists (duplicate check)
      const existingTransaction = await this.transactionRepository.findOne({
        where: { transactionId },
      });

      if (existingTransaction) {
        throw new BadRequestException(
          `Transaction ID ${transactionId} already exists. Please use a unique transaction ID.`,
        );
      }
    }

    // Get wallet balance (always in MNT)
    const { balance: currentBalance } =
      await this.walletService.getBalanceWithCurrency(userId);

    // Convert amount from API format to MNT
    // API format: amount is in units where 10000 = $1.00
    // Conversion: (amount / 10000) * 3600 = MNT amount
    const usdAmount = orderEsimDto.amount / CURRENCY_CONSTANTS.PRICE_MULTIPLIER;
    const amountInMnt = Math.round(
      usdAmount * CURRENCY_CONSTANTS.USD_TO_MNT_RATE,
    );

    // Check if user has sufficient balance (in MNT)
    if (Number(currentBalance) < amountInMnt) {
      throw new BadRequestException(
        `Insufficient balance. Current balance: ${Number(currentBalance).toFixed(2)} MNT, Required: ${amountInMnt.toFixed(2)} MNT`,
      );
    }

    // Get wallet entity
    const wallet = await this.walletService.getWallet(userId);

    // Create and save transaction record with PENDING status first
    // This ensures the transaction is saved even if API call hangs
    // Save only MNT converted amount
    const transaction = this.transactionRepository.create({
      transactionId: transactionId,
      userId,
      walletId: wallet.id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      amount: amountInMnt, // Save MNT converted amount
      currency: CURRENCY_CONSTANTS.CURRENCY_CODE, // Always use MNT
      balanceBefore: Number(currentBalance),
      description: `eSIM Order: ${orderEsimDto.packageInfoList.map((p) => p.packageCode).join(', ')}`,
      metadata: {
        orderType: 'esim',
        packageInfoList: orderEsimDto.packageInfoList,
        originalAmount: orderEsimDto.amount, // Store original API amount for reference
        convertedAmountMnt: amountInMnt, // Store converted MNT amount
      },
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    this.logger.log(
      `Transaction created: ${transactionId} with PENDING status for user ${userId}`,
    );

    try {
      // Prepare request body for eSIM Access API
      const requestBody: any = {
        transactionId: transactionId,
        amount: orderEsimDto.amount,
        packageInfoList: orderEsimDto.packageInfoList.map((pkg) => ({
          packageCode: pkg.packageCode,
          count: pkg.count,
          price: pkg.price,
        })),
      };

      // Call eSIM Access API to place order
      const url = `${this.apiBaseUrl}/open/esim/order`;
      this.logger.log(
        `Placing eSIM order: ${transactionId} for user ${userId}`,
      );

      let orderResponse: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(url, requestBody, {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout for order API
          }),
        );

        orderResponse = response.data;
        this.logger.log(
          `eSIM order API response received for ${transactionId}`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `eSIM order API call failed: ${axiosError.message}`,
          axiosError.stack,
        );

        // Extract error message from response if available
        let errorMessage = 'Failed to place eSIM order';
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as any;
          errorMessage =
            errorData.errorMsg ||
            errorData.message ||
            `API Error: ${axiosError.response.status}`;
        } else if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage = 'eSIM provider API request timed out';
        }

        // Update transaction to FAILED status
        await this.transactionRepository.update(
          { transactionId },
          {
            status: TransactionStatus.FAILED,
            failureReason: errorMessage,
            balanceAfter: Number(currentBalance),
            currency: CURRENCY_CONSTANTS.CURRENCY_CODE, // Ensure MNT currency
          },
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: errorMessage,
            error: 'eSIM Order Failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate API response
      if (!orderResponse || !orderResponse.success) {
        const errorMsg =
          orderResponse?.errorMsg ||
          'Order failed - invalid response from eSIM provider';
        this.logger.error(
          `eSIM order failed: ${errorMsg}`,
          JSON.stringify(orderResponse),
        );

        // Update transaction to FAILED status
        await this.transactionRepository.update(
          { transactionId },
          {
            status: TransactionStatus.FAILED,
            failureReason: errorMsg,
            balanceAfter: Number(currentBalance),
            currency: CURRENCY_CONSTANTS.CURRENCY_CODE, // Ensure MNT currency
          },
        );

        throw new BadRequestException(errorMsg);
      }

      // Extract order number from response
      const orderNo = orderResponse.obj?.orderNo || orderResponse.orderNo;
      if (!orderNo) {
        this.logger.error(
          'Order response missing orderNo',
          JSON.stringify(orderResponse),
        );

        // Update transaction to FAILED status
        await this.transactionRepository.update(
          { transactionId },
          {
            status: TransactionStatus.FAILED,
            failureReason: 'Order response missing order number',
            balanceAfter: Number(currentBalance),
            currency: CURRENCY_CONSTANTS.CURRENCY_CODE, // Ensure MNT currency
          },
        );

        throw new BadRequestException('Order response missing order number');
      }

      return await this.dataSource.transaction(async (manager) => {
        const transactionRepository = manager.getRepository(Transaction);

        const updatedWallet = await this.walletService.deductBalance(
          userId,
          amountInMnt,
          {
            transactionId: savedTransaction.transactionId,
            description: `eSIM Order: ${orderNo}`,
          },
        );

        const newBalance = Number(updatedWallet.balance);

        // Update transaction with final status and order details
        const transactionToUpdate = await transactionRepository.findOne({
          where: { transactionId },
        });

        if (transactionToUpdate) {
          transactionToUpdate.status = TransactionStatus.COMPLETED;
          transactionToUpdate.balanceAfter = newBalance;
          transactionToUpdate.completedAt = new Date();
          transactionToUpdate.currency = CURRENCY_CONSTANTS.CURRENCY_CODE; // Ensure MNT currency
          transactionToUpdate.metadata = {
            orderType: 'esim',
            packageInfoList: orderEsimDto.packageInfoList,
            orderNo,
            esimOrderResponse: orderResponse.obj || orderResponse,
            originalAmount: orderEsimDto.amount, // Store original API amount for reference
            convertedAmountMnt: amountInMnt, // Store converted MNT amount
          };
          transactionToUpdate.referenceId = orderNo;

          await transactionRepository.save(transactionToUpdate);
        }

        this.logger.log(
          `eSIM order successful: OrderNo=${orderNo}, TransactionId=${transactionId}, User=${userId}`,
        );

        return {
          orderNo,
          transactionId: transactionId,
          amount: amountInMnt, // Return MNT converted amount
          transactionStatus: TransactionStatus.COMPLETED,
          balanceBefore: Number(currentBalance),
          balanceAfter: newBalance,
        };
      });
    } catch (error) {
      // If error was already handled (transaction updated), re-throw it
      // Otherwise, mark transaction as failed
      const currentTransaction = await this.transactionRepository.findOne({
        where: { transactionId },
      });

      if (
        currentTransaction &&
        currentTransaction.status === TransactionStatus.PENDING
      ) {
        // Update transaction to FAILED status if still PENDING
        await this.transactionRepository.update(
          { transactionId },
          {
            status: TransactionStatus.FAILED,
            failureReason:
              error instanceof Error ? error.message : 'Unknown error',
            balanceAfter: Number(currentBalance),
            currency: CURRENCY_CONSTANTS.CURRENCY_CODE, // Ensure MNT currency
          },
        );

        this.logger.error(
          `eSIM order failed: ${transactionId}, User: ${userId}, Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }

      // Re-throw the error so it can be handled by the controller
      throw error;
    }
  }

  /**
   * Process customer purchase
   * 1. Create/Find Customer
   * 2. Create QPay Invoice
   * 3. Save EsimInvoice
   */
  async processCustomerPurchase(dto: CustomerPurchaseDto): Promise<any> {
    // 1. Find or Create Customer
    let customer = await this.customerRepository.findOne({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!customer) {
      customer = this.customerRepository.create({
        phoneNumber: dto.phoneNumber,
        email: dto.email,
      });
      customer = await this.customerRepository.save(customer);
    } else {
      // Update email if changed
      if (dto.email && customer.email !== dto.email) {
        customer.email = dto.email;
        customer = await this.customerRepository.save(customer);
      }
    }

    // 2. Create QPay Invoice
    // Generate unique sender_invoice_no
    const senderInvoiceNo = `CUSTOMER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const invoiceRequest: any = {
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: dto.phoneNumber,
      invoice_description: dto.packageCode+', '+dto.phoneNumber+', Захиалга' || 'Customer eSIM Purchase',
      amount: dto.amount,
      callback_url: `${process.env.API_URL || 'http://localhost:3000'}/customer/transactions/callback/${senderInvoiceNo}`,
      invoice_receiver_data: {
        register: '',
        name: dto.email.split('@')[0],
        email: dto.email,
        phone: dto.phoneNumber,
      },
    };

    const qpayResponse =
      await this.qpayConnectionService.createInvoice(invoiceRequest);

    // 3. Save EsimInvoice
    const esimInvoice = this.esimInvoiceRepository.create({
      amount: dto.amount,
      senderInvoiceNo: senderInvoiceNo,
      qpayInvoiceId: qpayResponse.invoice_id,
      status: 'PENDING',
      customer: customer,
      invoiceData: qpayResponse,
      packageCode: dto.packageCode,
      isSentEmail: false,
    });

    await this.esimInvoiceRepository.save(esimInvoice);

    return {
      ...qpayResponse,
      customerId: customer.id,
      internalInvoiceId: esimInvoice.id,
    };
  }

  /**
   * Order eSIM for customer purchase (without wallet deduction)
   * Used when invoice is paid via QPay
   * @param qpayInvoiceId - The QPay invoice ID (from QPay payment system)
   * @param orderEsimDto - Order details
   * @returns Order response with orderNo
   */
  async orderEsimForCustomer(
    qpayInvoiceId: string,
    orderEsimDto: OrderEsimDto,
  ): Promise<{
    orderNo: string;
    transactionId: string;
    amount: number;
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    // Generate eSIM order transaction ID if not provided
    // This is used for the eSIM API order, not the same as Transaction entity
    let esimOrderTransactionId = orderEsimDto.transactionId;
    if (!esimOrderTransactionId) {
      esimOrderTransactionId = this.generateTransactionId();
      // Ensure uniqueness (retry if collision - extremely rare)
      let attempts = 0;
      while (
        (await this.transactionRepository.findOne({
          where: { transactionId: esimOrderTransactionId },
        })) &&
        attempts < 10
      ) {
        esimOrderTransactionId = this.generateTransactionId();
        attempts++;
      }
    }

    // Find the EsimInvoice by QPay invoice ID
    // Note: qpayInvoiceId is the external QPay system ID, esimInvoice.id is our internal database ID
    const esimInvoice = await this.esimInvoiceRepository.findOne({
      where: { qpayInvoiceId: qpayInvoiceId },
      relations: ['customer'],
    });

    if (!esimInvoice) {
      throw new NotFoundException(
        `Invoice not found for QPay invoice ID: ${qpayInvoiceId}`,
      );
    }

    // Check if already processed
    if (esimInvoice.status === 'PROCESSED' || esimInvoice.status === 'PAID') {
      this.logger.log(
        `Invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}) already processed, skipping order`,
      );
      // Return existing order data if available
      if (esimInvoice.invoiceData?.orderNo) {
        return {
          orderNo: esimInvoice.invoiceData.orderNo,
          transactionId:
            esimInvoice.invoiceData.transactionId || esimOrderTransactionId,
          amount: esimInvoice.amount,
        };
      }
      throw new BadRequestException('Invoice already processed');
    }

    try {
      // Prepare request body for eSIM Access API
      const requestBody: any = {
        transactionId: esimOrderTransactionId,
        amount: orderEsimDto.amount,
        packageInfoList: orderEsimDto.packageInfoList.map((pkg) => ({
          packageCode: pkg.packageCode,
          count: pkg.count,
          price: pkg.price,
        })),
      };

      // Call eSIM Access API to place order
      const url = `${this.apiBaseUrl}/open/esim/order`;
      this.logger.log(
        `Placing eSIM order for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), eSIM Order TransactionId: ${esimOrderTransactionId}`,
      );

      let orderResponse: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(url, requestBody, {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout for order API
          }),
        );

        orderResponse = response.data;
        this.logger.log(
          `eSIM order API response received for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `eSIM order API call failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${axiosError.message}`,
          axiosError.stack,
        );

        // Extract error message from response if available
        let errorMessage = 'Failed to place eSIM order';
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as any;
          errorMessage =
            errorData.errorMsg ||
            errorData.message ||
            `API Error: ${axiosError.response.status}`;
        } else if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage = 'eSIM provider API request timed out';
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: errorMessage,
            error: 'eSIM Order Failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate API response
      if (!orderResponse || !orderResponse.success) {
        const errorMsg =
          orderResponse?.errorMsg ||
          'Order failed - invalid response from eSIM provider';
        this.logger.error(
          `eSIM order failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${errorMsg}`,
          JSON.stringify(orderResponse),
        );

        throw new BadRequestException(errorMsg);
      }

      // Extract order number from response
      const orderNo = orderResponse.obj?.orderNo || orderResponse.orderNo;
      if (!orderNo) {
        this.logger.error(
          `Order response missing orderNo for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
          JSON.stringify(orderResponse),
        );

        throw new BadRequestException('Order response missing order number');
      }

      // Update EsimInvoice with order details and mark as paid (order completed)
      // Status is set to 'PAID' since the order is placed synchronously and completes immediately
      esimInvoice.status = 'PAID';
      const orderResponseData = orderResponse.obj || orderResponse;
      esimInvoice.invoiceData = {
        ...esimInvoice.invoiceData,
        orderNo,
        transactionId: esimOrderTransactionId, // Store eSIM order transaction ID
        esimOrderResponse: orderResponseData,
        processedAt: new Date().toISOString(),
      };

      // Use a database transaction to ensure invoice is saved and committed
      // before creating purchases. This prevents foreign key constraint violations.
      await this.dataSource.transaction(async (manager) => {
        // Save invoice within transaction
        const invoiceRepository = manager.getRepository(EsimInvoice);
        const savedInvoice = await invoiceRepository.save(esimInvoice);

        // Reload invoice with customer relation within the same transaction
        const invoiceWithCustomer = await invoiceRepository.findOne({
          where: { id: savedInvoice.id },
          relations: ['customer'],
        });

        if (!invoiceWithCustomer) {
          throw new Error(
            `Failed to reload invoice ${savedInvoice.id} after saving`,
          );
        }

        if (!invoiceWithCustomer.customer) {
          throw new Error(
            `Invoice ${invoiceWithCustomer.id} does not have a customer relation`,
          );
        }

        // Create purchases within the same transaction
        // This ensures the invoice exists when purchases are created
        try {
          await this.createEsimPurchasesInTransaction(
            orderResponseData,
            invoiceWithCustomer,
            esimOrderTransactionId,
            orderEsimDto,
            manager,
          );
        } catch (purchaseError) {
          this.logger.error(
            `Failed to create ESimPurchase records in transaction: ${purchaseError instanceof Error ? purchaseError.message : 'Unknown error'}`,
            purchaseError instanceof Error ? purchaseError.stack : undefined,
          );
          // Don't throw - let transaction complete, purchases can be created later via fallback
        }
      });

      // Try fallback method if transaction completed but purchases weren't created
      // This handles cases where the transaction succeeded but purchase creation failed
      try {
        const invoiceCheck = await this.esimInvoiceRepository.findOne({
          where: { id: esimInvoice.id },
          relations: ['customer'],
        });

        if (invoiceCheck && invoiceCheck.customer) {
          const existingPurchases = await this.esimPurchaseRepository.count({
            where: { invoiceId: invoiceCheck.id },
          });

          if (existingPurchases === 0) {
            this.logger.log(
              `No purchases found for invoice ${invoiceCheck.id}, attempting fallback creation`,
            );
            // Try to get esimTranNo and iccid from invoice data (stored in esimOrderResponse)
            const esimTranNo =
              invoiceCheck.invoiceData?.esimOrderResponse?.esimTranNo ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.esimTranNo ||
              null;
            const iccid =
              invoiceCheck.invoiceData?.esimOrderResponse?.iccid ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.iccid ||
              null;

            await this.createPurchasesFromPackageInfo(
              invoiceCheck,
              esimOrderTransactionId,
              orderEsimDto,
              invoiceCheck.invoiceData?.orderNo || null,
              esimTranNo,
              iccid,
            );
          }
        }
      } catch (fallbackError) {
        this.logger.error(
          `Fallback purchase creation also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`,
        );
      }

      this.logger.log(
        `eSIM order successful for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), OrderNo: ${orderNo}, eSIM Order TransactionId: ${esimOrderTransactionId}`,
      );

      return {
        orderNo,
        transactionId: esimOrderTransactionId,
        amount: orderEsimDto.amount,
      };
    } catch (error) {
      this.logger.error(
        `eSIM order failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    }
  }

  /**
   * Get all pending invoices for cron job processing
   * @returns Array of pending EsimInvoices
   */
  async getPendingInvoices(): Promise<EsimInvoice[]> {
    return await this.esimInvoiceRepository.find({
      where: {
        status: 'PENDING',
      },
      relations: ['customer'],
      order: {
        createdAt: 'ASC', // Process oldest first
      },
    });
  }

  /**
   * Get package details by packageCode from eSIM API
   * @param packageCode - The package code to search for
   * @returns Array of matching packages
   */
  async getPackageDetailsByCode(packageCode: string): Promise<
    Array<{
      packageCode: string;
      name: string;
      price: number;
      currencyCode: string;
      [key: string]: unknown;
    }>
  > {
    try {
      this.logger.log(
        `Fetching package details for packageCode: ${packageCode}`,
      );
      const packages = await this.inquiryPackagesService.getPackagesByFilters({
        packageCode,
      });
      return packages as unknown as Array<{
        packageCode: string;
        name: string;
        price: number;
        currencyCode: string;
        [key: string]: unknown;
      }>;
    } catch (error) {
      this.logger.error(
        `Failed to fetch package details for ${packageCode}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Update EsimInvoice status
   * @param invoiceId - The internal invoice ID
   * @param status - The new status
   */
  async updateEsimInvoiceStatus(
    invoiceId: string,
    status: string,
  ): Promise<void> {
    await this.esimInvoiceRepository.update({ id: invoiceId }, { status });
  }

  /**
   * Create ESimPurchase records within a database transaction
   * This ensures the invoice exists when purchases are created
   * @param orderResponseData - The order response data from eSIM API
   * @param esimInvoice - The invoice record (contains internal invoice ID and QPay invoice ID)
   * @param esimOrderTransactionId - The eSIM order transaction ID (used for eSIM API, not Transaction entity)
   * @param orderEsimDto - The order DTO with package info
   * @param manager - The EntityManager from the transaction
   */
  private async createEsimPurchasesInTransaction(
    orderResponseData: any,
    esimInvoice: EsimInvoice,
    esimOrderTransactionId: string,
    orderEsimDto: OrderEsimDto,
    manager: EntityManager,
  ): Promise<void> {
    const purchaseRepository = manager.getRepository(ESimPurchase);
    const customerRepository = manager.getRepository(Customer);

    try {
      // Extract SIM list from order response
      const simList =
        orderResponseData.esimList ||
        orderResponseData.obj?.esimList ||
        orderResponseData.list ||
        orderResponseData.obj?.list ||
        orderResponseData.data?.esimList ||
        orderResponseData.data?.list ||
        [];

      this.logger.log(
        `Found SIM list with ${Array.isArray(simList) ? simList.length : 0} items for invoice ${esimInvoice.id}`,
      );

      // Verify invoice and customer exist in the transaction
      const invoiceCheck = await manager.findOne(EsimInvoice, {
        where: { id: esimInvoice.id },
        relations: ['customer'],
      });

      if (!invoiceCheck) {
        throw new Error(`Invoice ${esimInvoice.id} not found in transaction`);
      }

      const customer = invoiceCheck.customer;
      if (!customer) {
        throw new Error(`Invoice ${invoiceCheck.id} has no customer`);
      }

      const customerCheck = await customerRepository.findOne({
        where: { id: customer.id },
      });

      if (!customerCheck) {
        throw new Error(`Customer ${customer.id} not found in transaction`);
      }

      // If no SIM list found, create purchases based on package info
      if (!Array.isArray(simList) || simList.length === 0) {
        this.logger.warn(
          `No SIM cards found in order response for invoice ${esimInvoice.id}. Creating purchases from package info.`,
        );
        // Try to extract esimTranNo and iccid from order response (might be at top level or in first SIM item)
        const esimTranNo =
          orderResponseData.esimTranNo ||
          orderResponseData.obj?.esimTranNo ||
          null;
        const iccid =
          orderResponseData.iccid ||
          orderResponseData.obj?.iccid ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.iccid
            : null) ||
          null;

        await this.createPurchasesFromPackageInfoInTransaction(
          invoiceCheck,
          customerCheck,
          esimOrderTransactionId,
          orderEsimDto,
          purchaseRepository,
          orderResponseData.orderNo || null,
          esimTranNo,
          iccid,
        );
        return;
      }

      // Create a map of package codes to package info
      const packageInfoMap = new Map<
        string,
        OrderEsimDto['packageInfoList'][0]
      >();
      orderEsimDto.packageInfoList.forEach((pkg) => {
        packageInfoMap.set(pkg.packageCode, pkg);
      });

      // Process each SIM card
      const purchasePromises = simList.map(async (simItem: any) => {
        try {
          const iccid = simItem.iccid || null;
          const activationCode = simItem.ac || simItem.activationCode || null;
          const qrCodeUrl = simItem.qrCodeUrl || simItem.shortUrl || null;

          let packageCode = simItem.packageCode;
          if (
            !packageCode &&
            simItem.packageList &&
            simItem.packageList.length > 0
          ) {
            packageCode = simItem.packageList[0].packageCode;
          }

          if (!packageCode) {
            this.logger.warn(
              `No package code found for SIM item, skipping: ${JSON.stringify(simItem)}`,
            );
            return null;
          }

          // Get package details
          let packageDetails: any = null;
          try {
            const packages =
              await this.inquiryPackagesService.getPackagesByFilters({
                packageCode,
              });
            if (packages && packages.length > 0) {
              packageDetails = packages[0];
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch package details for ${packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }

          const packageInfo = packageInfoMap.get(packageCode);

          // Verify invoice exists in transaction before creating purchase
          const finalInvoiceCheck = await manager.findOne(EsimInvoice, {
            where: { id: invoiceCheck.id },
          });

          if (!finalInvoiceCheck) {
            this.logger.error(
              `Invoice ${invoiceCheck.id} not found when creating purchase. Skipping.`,
            );
            return null;
          }

          const purchaseData: Partial<ESimPurchase> = {
            customerId: customerCheck.id,
            invoiceId: finalInvoiceCheck.id,
            transactionId: `${esimOrderTransactionId}-${iccid || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            orderNo: orderResponseData.orderNo || null,
            esimTranNo: simItem.esimTranNo || null,
            packageCode: packageCode,
            slug: packageDetails?.slug || '',
            packageName:
              packageDetails?.name ||
              packageDetails?.packageName ||
              `Package ${packageCode}`,
            price: packageInfo?.price || invoiceCheck.amount / simList.length,
            currency: packageDetails?.currencyCode || 'MNT',
            dataVolume: packageDetails?.volume || simItem.totalVolume || 0,
            duration: packageDetails?.duration || simItem.totalDuration || 0,
            durationUnit:
              packageDetails?.durationUnit || simItem.durationUnit || 'DAY',
            location: packageDetails?.location || '',
            description: packageDetails?.description || null,
            iccid: iccid,
            activationCode: activationCode || qrCodeUrl,
            isActivated: simItem.activateTime ? true : false,
            isActive: true,
            packageMetadata: {
              ...packageDetails,
              orderNo: orderResponseData.orderNo,
              esimTranNo: simItem.esimTranNo,
              qrCodeUrl: qrCodeUrl,
              imsi: simItem.imsi,
              msisdn: simItem.msisdn,
              smdpStatus: simItem.smdpStatus,
              eid: simItem.eid,
              activateTime: simItem.activateTime,
              expiredTime: simItem.expiredTime,
              installationTime: simItem.installationTime,
              esimStatus: simItem.esimStatus,
            },
          };

          if (purchaseData.duration && purchaseData.durationUnit) {
            purchaseData.expiresAt = this.calculateExpirationDate(
              purchaseData.duration,
              purchaseData.durationUnit,
            );
          } else if (simItem.expiredTime) {
            purchaseData.expiresAt = new Date(simItem.expiredTime);
          }

          if (simItem.activateTime) {
            purchaseData.activatedAt = new Date(simItem.activateTime);
          }

          const esimPurchase = purchaseRepository.create(purchaseData);
          return await purchaseRepository.save(esimPurchase);
        } catch (error) {
          this.logger.error(
            `Failed to create purchase record for SIM item: ${error instanceof Error ? error.message : 'Unknown'}`,
            error instanceof Error ? error.stack : undefined,
          );
          return null;
        }
      });

      const purchases = await Promise.all(purchasePromises);
      const successfulPurchases = purchases.filter((p) => p !== null);

      this.logger.log(
        `Created ${successfulPurchases.length} ESimPurchase records in transaction for invoice ${esimInvoice.id}`,
      );

      // If no purchases created, try fallback
      if (successfulPurchases.length === 0) {
        this.logger.warn(
          `No purchases created from SIM list. Attempting fallback for invoice ${esimInvoice.id}`,
        );
        // Try to extract esimTranNo and iccid from order response (might be at top level or in first SIM item)
        const esimTranNo =
          orderResponseData.esimTranNo ||
          orderResponseData.obj?.esimTranNo ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.esimTranNo
            : null) ||
          null;
        const iccid =
          orderResponseData.iccid ||
          orderResponseData.obj?.iccid ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.iccid
            : null) ||
          null;

        await this.createPurchasesFromPackageInfoInTransaction(
          invoiceCheck,
          customerCheck,
          esimOrderTransactionId,
          orderEsimDto,
          purchaseRepository,
          orderResponseData.orderNo || null,
          esimTranNo,
          iccid,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to create ESimPurchase records in transaction: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Create ESimPurchase records from package info within a transaction (fallback method)
   */
  private async createPurchasesFromPackageInfoInTransaction(
    esimInvoice: EsimInvoice,
    customer: Customer,
    esimOrderTransactionId: string,
    orderEsimDto: OrderEsimDto,
    purchaseRepository: Repository<ESimPurchase>,
    orderNo: string | null = null,
    esimTranNo: string | null = null,
    iccid: string | null = null,
  ): Promise<void> {
    const purchasePromises = orderEsimDto.packageInfoList.map(
      async (packageInfo, index) => {
        try {
          let packageDetails: any = null;
          try {
            const packages =
              await this.inquiryPackagesService.getPackagesByFilters({
                packageCode: packageInfo.packageCode,
              });
            if (packages && packages.length > 0) {
              packageDetails = packages[0];
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch package details for ${packageInfo.packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }

          const purchases = [];
          for (let i = 0; i < packageInfo.count; i++) {
            // Verify invoice exists in transaction
            const invoiceCheck = await purchaseRepository.manager.findOne(
              EsimInvoice,
              {
                where: { id: esimInvoice.id },
              },
            );

            if (!invoiceCheck) {
              this.logger.error(
                `Invoice ${esimInvoice.id} not found in transaction when creating purchase ${i + 1} of ${packageInfo.count}. Skipping.`,
              );
              continue;
            }

            const purchaseData: Partial<ESimPurchase> = {
              customerId: customer.id,
              invoiceId: invoiceCheck.id,
              transactionId: esimOrderTransactionId,
              orderNo: orderNo,
              esimTranNo: esimTranNo, // Extracted from order response when available
              packageCode: packageInfo.packageCode,
              slug: packageDetails?.slug || '',
              packageName:
                packageDetails?.name ||
                packageDetails?.packageName ||
                `Package ${packageInfo.packageCode}`,
              price: packageInfo.price,
              currency: packageDetails?.currencyCode || 'MNT',
              dataVolume: packageDetails?.volume || 0,
              duration: packageDetails?.duration || 0,
              durationUnit: packageDetails?.durationUnit || 'DAY',
              location: packageDetails?.location || '',
              description: packageDetails?.description || null,
              iccid: iccid, // Extracted from order response when available
              activationCode: null,
              isActivated: false,
              isActive: true,
              packageMetadata: packageDetails || null,
            };

            if (purchaseData.duration && purchaseData.durationUnit) {
              purchaseData.expiresAt = this.calculateExpirationDate(
                purchaseData.duration,
                purchaseData.durationUnit,
              );
            }

            const esimPurchase = purchaseRepository.create(purchaseData);
            purchases.push(await purchaseRepository.save(esimPurchase));
          }

          return purchases;
        } catch (error) {
          this.logger.error(
            `Failed to create purchase for package ${packageInfo.packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
          return [];
        }
      },
    );

    const allPurchases = await Promise.all(purchasePromises);
    const totalPurchases = allPurchases.flat().length;

    this.logger.log(
      `Created ${totalPurchases} ESimPurchase records from package info in transaction for invoice ${esimInvoice.id}`,
    );
  }

  /**
   * Create ESimPurchase records from order response
   * Parses the order response and creates purchase records for each SIM card
   * @param orderResponseData - The order response data from eSIM API
   * @param esimInvoice - The invoice record (contains internal invoice ID and QPay invoice ID)
   * @param esimOrderTransactionId - The eSIM order transaction ID (used for eSIM API, not Transaction entity)
   * @param orderEsimDto - The order DTO with package info
   */
  private async createEsimPurchasesFromOrderResponse(
    orderResponseData: any,
    esimInvoice: EsimInvoice,
    esimOrderTransactionId: string,
    orderEsimDto: OrderEsimDto,
  ): Promise<void> {
    try {
      // Log the full order response structure for debugging
      this.logger.log(
        `Creating ESimPurchase records for invoice ${esimInvoice.id}. Order response keys: ${Object.keys(orderResponseData).join(', ')}`,
      );
      if (orderResponseData.obj) {
        this.logger.log(
          `Order response obj keys: ${Object.keys(orderResponseData.obj).join(', ')}`,
        );
      }

      // Extract SIM list from order response
      // The response structure may vary, try common patterns
      const simList =
        orderResponseData.esimList ||
        orderResponseData.obj?.esimList ||
        orderResponseData.list ||
        orderResponseData.obj?.list ||
        orderResponseData.data?.esimList ||
        orderResponseData.data?.list ||
        [];

      this.logger.log(
        `Found SIM list with ${Array.isArray(simList) ? simList.length : 0} items for invoice ${esimInvoice.id}`,
      );

      // Ensure invoice is saved and has an ID
      if (!esimInvoice.id) {
        this.logger.error(
          `Invoice does not have an ID, cannot create purchases. Invoice: ${JSON.stringify(esimInvoice)}`,
        );
        return;
      }

      // Reload invoice from database to ensure it exists and is fresh
      const existingInvoice = await this.esimInvoiceRepository.findOne({
        where: { id: esimInvoice.id },
        relations: ['customer'],
      });

      if (!existingInvoice) {
        this.logger.error(
          `Invoice with ID ${esimInvoice.id} does not exist in database, cannot create purchases`,
        );
        return;
      }

      // Get customer from verified invoice
      const customer = existingInvoice.customer;
      if (!customer) {
        this.logger.warn(
          `No customer found for invoice ${existingInvoice.id}, skipping purchase creation`,
        );
        return;
      }

      // Verify customer exists in database
      const existingCustomer = await this.customerRepository.findOne({
        where: { id: customer.id },
      });

      if (!existingCustomer) {
        this.logger.error(
          `Customer with ID ${customer.id} does not exist in database, cannot create purchases`,
        );
        return;
      }

      // If no SIM list found, create purchases based on package info from order DTO
      // This handles cases where the API doesn't return SIM details immediately
      if (!Array.isArray(simList) || simList.length === 0) {
        this.logger.warn(
          `No SIM cards found in order response for invoice ${existingInvoice.id}. Creating purchases from package info.`,
        );

        // Create purchases from package info list
        // Try to extract esimTranNo and iccid from order response
        const esimTranNo =
          orderResponseData.esimTranNo ||
          orderResponseData.obj?.esimTranNo ||
          null;
        const iccid =
          orderResponseData.iccid ||
          orderResponseData.obj?.iccid ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.iccid
            : null) ||
          null;

        await this.createPurchasesFromPackageInfo(
          existingInvoice,
          esimOrderTransactionId,
          orderEsimDto,
          orderResponseData.orderNo || orderResponseData.obj?.orderNo || null,
          esimTranNo,
          iccid,
        );
        return;
      }

      // Create a map of package codes to package info for quick lookup
      const packageInfoMap = new Map<
        string,
        OrderEsimDto['packageInfoList'][0]
      >();
      orderEsimDto.packageInfoList.forEach((pkg) => {
        packageInfoMap.set(pkg.packageCode, pkg);
      });

      // Process each SIM card
      const purchasePromises = simList.map(async (simItem: any) => {
        try {
          // Extract SIM card details
          const iccid = simItem.iccid || null;
          const activationCode = simItem.ac || simItem.activationCode || null;
          const qrCodeUrl = simItem.qrCodeUrl || simItem.shortUrl || null;

          // Get package code from SIM item or package list
          let packageCode = simItem.packageCode;
          if (
            !packageCode &&
            simItem.packageList &&
            simItem.packageList.length > 0
          ) {
            packageCode = simItem.packageList[0].packageCode;
          }

          if (!packageCode) {
            this.logger.warn(
              `No package code found for SIM item, skipping: ${JSON.stringify(simItem)}`,
            );
            return null;
          }

          // Get package details from inquiry service
          let packageDetails: any = null;
          try {
            const packages =
              await this.inquiryPackagesService.getPackagesByFilters({
                packageCode,
              });
            if (packages && packages.length > 0) {
              packageDetails = packages[0];
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch package details for ${packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }

          // Get package info from order DTO
          const packageInfo = packageInfoMap.get(packageCode);

          // Double-check invoice exists right before creating purchase
          // This ensures the invoice is committed to the database
          const invoiceCheck = await this.esimInvoiceRepository.findOne({
            where: { id: existingInvoice.id },
          });

          if (!invoiceCheck) {
            this.logger.error(
              `Invoice ${existingInvoice.id} does not exist in database when creating purchase. Skipping this purchase.`,
            );
            return null;
          }

          // Prepare purchase data
          const purchaseData: Partial<ESimPurchase> = {
            customerId: existingCustomer.id, // Use verified customer ID
            invoiceId: invoiceCheck.id, // Use invoice ID from fresh database query
            // Generate unique transaction ID per SIM card
            // Format: {esimOrderTransactionId}-{iccid}-{random}
            // Note: This is NOT linked to Transaction entity, it's just a unique identifier
            transactionId: `${esimOrderTransactionId}-${iccid || Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            orderNo:
              orderResponseData.orderNo ||
              orderResponseData.obj?.orderNo ||
              null,
            esimTranNo: simItem.esimTranNo || null,
            packageCode: packageCode,
            slug: packageDetails?.slug || '',
            packageName:
              packageDetails?.name ||
              packageDetails?.packageName ||
              `Package ${packageCode}`,
            price: packageInfo?.price || esimInvoice.amount / simList.length,
            currency: packageDetails?.currencyCode || 'MNT',
            dataVolume: packageDetails?.volume || simItem.totalVolume || 0,
            duration: packageDetails?.duration || simItem.totalDuration || 0,
            durationUnit:
              packageDetails?.durationUnit || simItem.durationUnit || 'DAY',
            location: packageDetails?.location || '',
            description: packageDetails?.description || null,
            iccid: iccid,
            activationCode: activationCode || qrCodeUrl,
            isActivated: simItem.activateTime ? true : false,
            isActive: true,
            packageMetadata: {
              ...packageDetails,
              orderNo: orderResponseData.orderNo,
              esimTranNo: simItem.esimTranNo,
              qrCodeUrl: qrCodeUrl,
              imsi: simItem.imsi,
              msisdn: simItem.msisdn,
              smdpStatus: simItem.smdpStatus,
              eid: simItem.eid,
              activateTime: simItem.activateTime,
              expiredTime: simItem.expiredTime,
              installationTime: simItem.installationTime,
              esimStatus: simItem.esimStatus,
            },
          };

          // Calculate expiration date
          if (purchaseData.duration && purchaseData.durationUnit) {
            purchaseData.expiresAt = this.calculateExpirationDate(
              purchaseData.duration,
              purchaseData.durationUnit,
            );
          } else if (simItem.expiredTime) {
            purchaseData.expiresAt = new Date(simItem.expiredTime);
          }

          // Set activated date if available
          if (simItem.activateTime) {
            purchaseData.activatedAt = new Date(simItem.activateTime);
          }

          // Create and save purchase record
          const esimPurchase = this.esimPurchaseRepository.create(purchaseData);
          return await this.esimPurchaseRepository.save(esimPurchase);
        } catch (error) {
          this.logger.error(
            `Failed to create purchase record for SIM item: ${error instanceof Error ? error.message : 'Unknown'}`,
            error instanceof Error ? error.stack : undefined,
          );
          return null;
        }
      });

      const purchases = await Promise.all(purchasePromises);
      const successfulPurchases = purchases.filter((p) => p !== null);

      this.logger.log(
        `Created ${successfulPurchases.length} ESimPurchase records for invoice ${esimInvoice.id}`,
      );

      // If no purchases were created from SIM list, try fallback
      if (successfulPurchases.length === 0) {
        this.logger.warn(
          `No purchases created from SIM list. Attempting fallback for invoice ${esimInvoice.id}`,
        );
        // Try to extract esimTranNo and iccid from order response
        const esimTranNo =
          orderResponseData.esimTranNo ||
          orderResponseData.obj?.esimTranNo ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.esimTranNo
            : null) ||
          null;
        const iccid =
          orderResponseData.iccid ||
          orderResponseData.obj?.iccid ||
          (Array.isArray(simList) && simList.length > 0
            ? simList[0]?.iccid
            : null) ||
          null;

        await this.createPurchasesFromPackageInfo(
          esimInvoice,
          esimOrderTransactionId,
          orderEsimDto,
          orderResponseData.orderNo || orderResponseData.obj?.orderNo || null,
          esimTranNo,
          iccid,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to create ESimPurchase records from order response: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Try fallback even on error
      try {
        this.logger.log(
          `Attempting fallback: creating purchases from package info for invoice ${esimInvoice.id}`,
        );
        // Try to extract esimTranNo and iccid from order response
        const esimTranNo =
          orderResponseData.esimTranNo ||
          orderResponseData.obj?.esimTranNo ||
          null;
        const iccid =
          orderResponseData.iccid || orderResponseData.obj?.iccid || null;

        await this.createPurchasesFromPackageInfo(
          esimInvoice,
          esimOrderTransactionId,
          orderEsimDto,
          orderResponseData.orderNo || orderResponseData.obj?.orderNo || null,
          esimTranNo,
          iccid,
        );
      } catch (fallbackError) {
        this.logger.error(
          `Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`,
        );
      }
      // Don't throw - we want the order to succeed even if purchase creation fails
    }
  }

  /**
   * Create ESimPurchase records from package info (fallback method)
   * Used when SIM list is not available in order response
   * @param esimInvoice - The invoice record
   * @param esimOrderTransactionId - The eSIM order transaction ID
   * @param orderEsimDto - The order DTO with package info
   */
  private async createPurchasesFromPackageInfo(
    esimInvoice: EsimInvoice,
    esimOrderTransactionId: string,
    orderEsimDto: OrderEsimDto,
    orderNo: string | null = null,
    esimTranNo: string | null = null,
    iccid: string | null = null,
  ): Promise<void> {
    // Ensure invoice is saved and has an ID
    if (!esimInvoice.id) {
      this.logger.error(
        `Invoice does not have an ID, cannot create purchases. Invoice: ${JSON.stringify(esimInvoice)}`,
      );
      return;
    }

    // Verify invoice exists in database and load customer relation
    const existingInvoice = await this.esimInvoiceRepository.findOne({
      where: { id: esimInvoice.id },
      relations: ['customer'],
    });

    if (!existingInvoice) {
      this.logger.error(
        `Invoice with ID ${esimInvoice.id} does not exist in database, cannot create purchases`,
      );
      return;
    }

    const customer = existingInvoice.customer;
    if (!customer) {
      this.logger.warn(
        `No customer found for invoice ${existingInvoice.id}, cannot create purchases`,
      );
      return;
    }

    // Ensure customer exists in database
    const existingCustomer = await this.customerRepository.findOne({
      where: { id: customer.id },
    });

    if (!existingCustomer) {
      this.logger.error(
        `Customer with ID ${customer.id} does not exist in database, cannot create purchases`,
      );
      return;
    }

    // Create one purchase per package in the order
    const purchasePromises = orderEsimDto.packageInfoList.map(
      async (packageInfo, index) => {
        try {
          // Get package details from inquiry service
          let packageDetails: any = null;
          try {
            const packages =
              await this.inquiryPackagesService.getPackagesByFilters({
                packageCode: packageInfo.packageCode,
              });
            if (packages && packages.length > 0) {
              packageDetails = packages[0];
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch package details for ${packageInfo.packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
            );
          }

          // Create purchase for each count (if count > 1, create multiple purchases)
          const purchases = [];
          for (let i = 0; i < packageInfo.count; i++) {
            // Double-check invoice exists right before creating purchase
            const invoiceCheck = await this.esimInvoiceRepository.findOne({
              where: { id: existingInvoice.id },
            });

            if (!invoiceCheck) {
              this.logger.error(
                `Invoice ${existingInvoice.id} does not exist in database when creating purchase ${i + 1} of ${packageInfo.count}. Skipping.`,
              );
              continue; // Skip this purchase
            }

            const purchaseData: Partial<ESimPurchase> = {
              customerId: existingCustomer.id, // Use verified customer ID
              invoiceId: invoiceCheck.id, // Use invoice ID from fresh database query
              // Generate unique transaction ID per purchase
              transactionId: `${esimOrderTransactionId}-${packageInfo.packageCode}-${index}-${i}-${Date.now()}`,
              orderNo: orderNo,
              esimTranNo: esimTranNo, // Extracted from order response when available
              packageCode: packageInfo.packageCode,
              slug: packageDetails?.slug || '',
              packageName:
                packageDetails?.name ||
                packageDetails?.packageName ||
                `Package ${packageInfo.packageCode}`,
              price: packageInfo.price,
              currency: packageDetails?.currencyCode || 'MNT',
              dataVolume: packageDetails?.volume || 0,
              duration: packageDetails?.duration || 0,
              durationUnit: packageDetails?.durationUnit || 'DAY',
              location: packageDetails?.location || '',
              description: packageDetails?.description || null,
              iccid: iccid, // Extracted from order response when available
              activationCode: null, // Will be updated when SIM details are available
              isActivated: false,
              isActive: true,
              packageMetadata: packageDetails || null,
            };

            // Calculate expiration date
            if (purchaseData.duration && purchaseData.durationUnit) {
              purchaseData.expiresAt = this.calculateExpirationDate(
                purchaseData.duration,
                purchaseData.durationUnit,
              );
            }

            const esimPurchase =
              this.esimPurchaseRepository.create(purchaseData);
            purchases.push(
              await this.esimPurchaseRepository.save(esimPurchase),
            );
          }

          return purchases;
        } catch (error) {
          this.logger.error(
            `Failed to create purchase for package ${packageInfo.packageCode}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
          return [];
        }
      },
    );

    const allPurchases = await Promise.all(purchasePromises);
    const totalPurchases = allPurchases.flat().length;

    this.logger.log(
      `Created ${totalPurchases} ESimPurchase records from package info for invoice ${esimInvoice.id}`,
    );
  }

  /**
   * Get customer data by email or phone number
   * Returns active QPay invoices and purchased SIM cards
   * @param email - Customer email (optional)
   * @param phoneNumber - Customer phone number (optional)
   * @returns Customer data with active invoices and purchased SIM cards
   */
  async getCustomerData(
    email?: string,
    phoneNumber?: string,
  ): Promise<{
    customerId: string;
    email: string;
    phoneNumber: string;
    activeInvoices: EsimInvoice[];
    purchasedSimCards: ESimPurchase[];
  }> {
    if (!email && !phoneNumber) {
      throw new BadRequestException(
        'Either email or phoneNumber must be provided',
      );
    }

    // Find customer by email or phone (OR logic)
    let customer: Customer | null = null;

    if (email && phoneNumber) {
      // If both provided, try email first, then phone
      customer = await this.customerRepository.findOne({
        where: [{ email }, { phoneNumber }],
      });
    } else if (email) {
      customer = await this.customerRepository.findOne({
        where: { email },
      });
    } else if (phoneNumber) {
      customer = await this.customerRepository.findOne({
        where: { phoneNumber },
      });
    }

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get active invoices (PENDING, PAID, PROCESSED)
    const activeInvoices = await this.esimInvoiceRepository.find({
      where: {
        customerId: customer.id,
        status: In(['PENDING', 'PAID', 'PROCESSED']),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    // Get purchased SIM cards for this customer
    // Query by customerId directly (now that ESimPurchase supports customers)
    const purchasedSimCards = await this.esimPurchaseRepository.find({
      where: { customerId: customer.id },
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      customerId: customer.id,
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      activeInvoices,
      purchasedSimCards,
    };
  }

  /**
   * Query eSIM purchases with filters and pagination
   * Calls the eSIM Access API to query eSIM purchases
   * @param queryDto - Query parameters (orderNo, esimTranNo, iccid, startTime, endTime, pager)
   * @returns Query response matching API format
   */
  async queryEsimPurchases(queryDto: QueryEsimDto): Promise<{
    success: boolean;
    errorCode: string;
    errorMsg: string | null;
    obj: {
      esimList: any[];
      pager: {
        pageSize: number;
        pageNum: number;
        total: number;
      };
    };
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    const pageNum = queryDto.pager?.pageNum || 1;
    const pageSize = queryDto.pager?.pageSize || 20;

    // Prepare request body for eSIM Access API
    const requestBody: any = {
      orderNo: queryDto.orderNo || '',
      esimTranNo: queryDto.esimTranNo || '',
      iccid: queryDto.iccid || '',
      pager: {
        pageNum: pageNum,
        pageSize: pageSize,
      },
    };

    // Add optional date filters if provided
    if (queryDto.startTime) {
      requestBody.startTime = queryDto.startTime;
    }
    if (queryDto.endTime) {
      requestBody.endTime = queryDto.endTime;
    }

    // Call eSIM Access API to query eSIM purchases
    const url = `${this.apiBaseUrl}/open/esim/query`;
    this.logger.log(
      `Querying eSIM purchases from API: ${url} with filters: orderNo=${queryDto.orderNo || ''}, esimTranNo=${queryDto.esimTranNo || ''}, iccid=${queryDto.iccid || ''}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, requestBody, {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      const apiResponse = response.data;

      // Validate API response
      if (!apiResponse) {
        this.logger.error('Empty response from eSIM Access API');
        throw new BadRequestException('Invalid response from eSIM provider');
      }

      this.logger.log(
        `Successfully queried eSIM purchases. Found ${apiResponse.obj?.esimList?.length || 0} items`,
      );

      const esimPurchase = await this.esimPurchaseRepository.findOne({
        where: { orderNo: queryDto.orderNo },
      });
      let sendEmailAccount = '';
      if (esimPurchase) {
        const esimInvoice = await this.esimInvoiceRepository.findOne({
          where: { id: esimPurchase.invoiceId! },
        });
          if(esimInvoice){
            if (esimInvoice.isSentEmail === false) {
              if (esimPurchase.customerId) {
                const sendEmail = await this.customerRepository.findOne({
                  where: { id: esimPurchase.customerId },
                });
                if (!sendEmail)
                  throw new Error(
                    `Customer ${esimPurchase.customerId} not found in transaction`,
                  );
                else sendEmailAccount = sendEmail.email;
              } else {
                if (esimPurchase.userId) {
                  const sendEmail = await this.userRepository.findOne({
                    where: { id: esimPurchase.userId },
                  });
                  if (!sendEmail)
                    throw new Error(
                      `User ${esimPurchase.userId} not found in transaction`,
                    );
                  else sendEmailAccount = sendEmail?.email;
                } else {
                  throw new Error(
                    `User ${esimPurchase.userId} not found in transaction`,
                  );
                }
              }
              const orderHtml = this.OrderMailBuilder(apiResponse);
              await this.mailService.sendMail(
                sendEmailAccount,
                'Goy eSIM purchase',
                orderHtml,
              );
              await this.esimInvoiceRepository.update(
                { id: esimInvoice.id },
                { isSentEmail: true }
              );
            }
          }
      }

      // Return the API response as-is (it already matches the expected format)
      return {
        success: apiResponse.success !== undefined ? apiResponse.success : true,
        errorCode: apiResponse.errorCode || '0',
        errorMsg: apiResponse.errorMsg || null,
        obj: {
          esimList: apiResponse.obj?.esimList || [],
          pager: apiResponse.obj?.pager || {
            pageSize,
            pageNum,
            total: 0,
          },
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `eSIM query API call failed: ${axiosError.message}`,
        axiosError.stack,
      );

      // Extract error message from response if available
      let errorMessage = 'Failed to query eSIM purchases';
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data as any;
        errorMessage =
          errorData.errorMsg ||
          errorData.message ||
          `API Error: ${axiosError.response.status}`;
      } else if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.message.includes('timeout')
      ) {
        errorMessage = 'eSIM provider API request timed out';
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: errorMessage,
          error: 'eSIM Query Failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  OrderMailBuilder(apiResponse: any): string {
    const ac = apiResponse.obj.esimList[0].ac;
    const parts = ac.split('$');
    const smdp = parts[1];
    const activationCode = parts[2];

    const htmlOrder = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

        <p>Эрхэм харилцагч танд,</p>

        <p>
          Манай бүтээгдэхүүн үйлчилгээг сонгон захиалсан танд баярлалаа🍀 Таны eSIM-ны ХУДАЛДАН АВАЛТ-ын мэдээллийг илгээж байна.  
          Та төхөөрөмж дээрээ идэвхжүүлэхийн тулд QR кодыг уншуулж хэрэглэнэ үү.
        </p>

        <p><strong>Уншуулах QR код:</strong></p>

        <table cellpadding="10" cellspacing="0" border="0" border-spacing="0">
          <tr>
            <!-- QR CODE -->
            <td style="vertical-align: top;">
              <img 
                src=${apiResponse.obj.esimList[0].qrCodeUrl}  
                alt="QR Code" 
                style="width:180px;height:180px;border:1px solid #ddd;padding:5px;"
              />
            </td>
          </tr>
          <tr>
            <!-- INFO BOX -->
            <td>
              <div style="
                background:#bfe797;
                padding:8px;
                border-radius:8px;
                width:450px;
                font-size:14px;
              ">
                <p style="line-height:50%;"><strong>Захиалгын дугаар(orderNo):</strong> ${apiResponse.obj.esimList[0].orderNo}</p>
                <p style="line-height:50%;"><strong>eSIM дугаар(esimTranNo):</strong> ${apiResponse.obj.esimList[0].esimTranNo}</p>
                <p style="line-height:50%;"><strong>ICCID дугаар(iccid):</strong> ${apiResponse.obj.esimList[0].iccid}</p>
                <p style="line-height:50%;"><strong>Багцын нэр:</strong> ${apiResponse.obj.esimList[0].packageList[0].packageName}</p>
                <p style="line-height:50%;"><strong>Хүчинтэй хугацаа:</strong> ${apiResponse.obj.esimList[0].expiredTime}</p>

                <p style=" style="line-height:50%;display:inline"">
                  <strong>SM-DP+ Хаяг:</strong>
                  <a href=${smdp} target="_blank">
                    ${smdp}
                  </a>
                </p>

                <p style="line-height:50%"><strong>Идэвхжүүлэх Код:</strong> ${activationCode}</p>

                <p style="line-height:50%">
                  <strong>APN:</strong>
                  <a href=${apiResponse.obj.esimList[0].apn} target="_blank">${apiResponse.obj.esimList[0].apn}</a>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin-top:20px;">
          Мөн дараах холбоосыг ашиглан QR кодоо суулгах болон дата хэрэглээгээ хянах боломжтой:  
          <a href="${apiResponse.obj.esimList[0].shortUrl}" target="_blank">${apiResponse.obj.esimList[0].shortUrl}</a>
        </p>

        <hr style="margin-top:20px; border:none; border-top:1px solid #e5e5e5;" />

        <div style="
          margin-top:16px;
          font-size:13px;
          color:#555;
          line-height:1.6;
        ">
          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Утас:</strong>
            <a href="tel:+97670001234" style="color:#34a04b; text-decoration:none;">
              +976 6001-6363
            </a>
          </p>

          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Фэйсбүүк хаяг:</strong>
            <a href="https://www.facebook.com/GOYeSIM/" target="_blank" style="color:#34a04b; text-decoration:none;">
              facebook.com/GOYeSIM
            </a>
          </p>

          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Вэб сайт:</strong>
            <a href="https://www.goysim.mn" target="_blank" style="color:#34a04b; text-decoration:none;">
              www.goysim.mn
            </a>
          </p>
        </div>

        <p style="margin-top:14px;">Хүндэтгэсэн,</p>
        <strong><p style="color:#34a04b; margin:0;">GOY eSIM</p></strong>

      </div>
      `;
    return htmlOrder;
  }

  /**
   * 
   * @param queryDto - Query parameters (iccid) we need only iccid 
   * @returns Query response matching API format + suggestPackage: any[]  цэнэглэх боломжтой багцуудыг санал болгох
   */
  async queryExtend(queryDto: QueryEsimDto): Promise<{
    success: boolean;
    errorCode: string;
    errorMsg: string | null;
    obj: {
      esimList: any[];
      pager: {
        pageSize: number;
        pageNum: number;
        total: number;
      };
      suggestPackage: any[]
      customerPhone: string;
      customerEmail: string;
    };
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    const pageNum = queryDto.pager?.pageNum || 1;
    const pageSize = queryDto.pager?.pageSize || 20;

    // Prepare request body for eSIM Access API
    const requestBody: any = {
      orderNo: queryDto.orderNo || '',
      esimTranNo: queryDto.esimTranNo || '',
      iccid: queryDto.iccid || '',
      pager: {
        pageNum: pageNum,
        pageSize: pageSize,
      },
    };

    // Add optional date filters if provided
    if (queryDto.startTime) {
      requestBody.startTime = queryDto.startTime;
    }
    if (queryDto.endTime) {
      requestBody.endTime = queryDto.endTime;
    }

    // Call eSIM Access API to query eSIM purchases
    const url = `${this.apiBaseUrl}/open/esim/query`;
    this.logger.log(
      `Querying eSIM purchases from API: ${url} with filters: orderNo=${queryDto.orderNo || ''}, esimTranNo=${queryDto.esimTranNo || ''}, iccid=${queryDto.iccid || ''}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, requestBody, {
          headers: {
            'RT-AccessCode': this.accessCode,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      const apiResponse = response.data;

      // Validate API response
      if (!apiResponse) {
        this.logger.error('Empty response from eSIM Access API');
        throw new BadRequestException('Invalid response from eSIM provider');
      }

      this.logger.log(
        `Successfully queried eSIM topup. Found ${apiResponse.obj?.esimList?.length || 0} items`,
      );

      //find Related Packages and add to response
      const relatedPackages = await this.dataPackageRepo.find({
        where: { locationCode: apiResponse.obj.esimList[0].packageList[0].locationCode,
          buyPrice : MoreThan(0)
        },
      });
      const orderLog = await this.esimPurchaseRepository.findOne({ where: {orderNo: apiResponse.obj.esimList[0].orderNo}});
      let phoneNumber= '';
      let email='';
      if(orderLog!==null){
        if(orderLog?.customerId!==null){
          const customer = await this.customerRepository.findOne({ where: {id: orderLog!.customerId}});
          if(customer){
            phoneNumber = customer?.phoneNumber;
            email = customer?.email;
          }
        }
      }
      // Return the API response as-is (it already matches the expected format)
      return {
        success: apiResponse.success !== undefined ? apiResponse.success : true,
        errorCode: apiResponse.errorCode || '0',
        errorMsg: apiResponse.errorMsg || null,
        obj: {
          esimList: apiResponse.obj?.esimList || [],
          pager: apiResponse.obj?.pager || {
            pageSize,
            pageNum,
            total: 0,
          },
          suggestPackage: relatedPackages || [],
          customerPhone: phoneNumber,
          customerEmail: email
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `eSIM query API call failed: ${axiosError.message}`,
        axiosError.stack,
      );

      // Extract error message from response if available
      let errorMessage = 'Failed to query eSIM topup 2594';
      if (axiosError.response?.data) {
        const errorData = axiosError.response.data as any;
        errorMessage =
          errorData.errorMsg ||
          errorData.message ||
          `API Error: ${axiosError.response.status}`;
      } else if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.message.includes('timeout')
      ) {
        errorMessage = 'eSIM provider API request timed out';
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: errorMessage,
          error: 'eSIM Query Failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Process customer topup
   * 1. Create/Find Customer
   * 2. Create QPay Invoice
   * 3. Save EsimInvoice
   */
  async processCustomerTopup(dto: CustomerPurchaseDto): Promise<any> {
    // 1. Find or Create Customer
    let customer = await this.customerRepository.findOne({
      where: { phoneNumber: dto.phoneNumber },
    });

    if (!customer) {
      customer = this.customerRepository.create({
        phoneNumber: dto.phoneNumber,
        email: dto.email,
      });
      customer = await this.customerRepository.save(customer);
    } else {
      // Update email if changed
      if (dto.email && customer.email !== dto.email) {
        customer.email = dto.email;
        customer = await this.customerRepository.save(customer);
      }
    }

    // 2. Create QPay Invoice
    // Generate unique sender_invoice_no
    const senderInvoiceNo = `CUSTOMER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const invoiceRequest: any = {
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: dto.phoneNumber,
      invoice_description: dto.packageCode+', '+dto.phoneNumber+', Цэнэглэлт' || 'Customer eSIM Topup',
      amount: dto.amount,
      callback_url: `${process.env.API_URL || 'http://localhost:3000'}/customer/transactions/callback/${senderInvoiceNo}`,
      invoice_receiver_data: {
        register: '',
        name: dto.email.split('@')[0],
        email: dto.email,
        phone: dto.phoneNumber,
      },
    };

    const qpayResponse =
      await this.qpayConnectionService.createInvoice(invoiceRequest);

    // 3. Save EsimInvoice
    const esimInvoice = this.esimInvoiceRepository.create({
      amount: dto.amount,
      senderInvoiceNo: senderInvoiceNo,
      qpayInvoiceId: qpayResponse.invoice_id,
      status: 'PENDING',
      customer: customer,
      invoiceData: qpayResponse,
      packageCode: dto.packageCode,
      iccId: dto.iccId
    });

    await this.esimInvoiceRepository.save(esimInvoice);

    return {
      ...qpayResponse,
      customerId: customer.id,
      internalInvoiceId: esimInvoice.id,
    };
  }

  async topupEsim(invoiceId: string): Promise<Record<string, unknown>> {

  // Check invoice status from QPay
      const invoiceStatus = (await this.qpayConnectionService.checkInvoice(
        invoiceId,
      )) as {
        count: number;
        rows?: Array<{ payment_status: string }>;
        [key: string]: unknown;
      };
  
      // Check if invoice is paid
      const isPaid =
        invoiceStatus.count > 0 &&
        invoiceStatus.rows?.some(
          (row: { payment_status: string }) => row.payment_status === 'PAID',
        );
  
      if (isPaid) {
        // Find the EsimInvoice record by QPay invoice ID
        // Note: qpayInvoiceId is the external QPay payment system ID
        // esimInvoice.id is our internal database UUID
        const esimInvoice =
          await this.getEsimInvoiceByQpayId(invoiceId);
  
        if (esimInvoice && esimInvoice.packageCode) {
          // Check if already processed
          if (
            esimInvoice.status !== 'PROCESSED' &&
            esimInvoice.status !== 'PAID'
          ) {
            try {
              // Inquire eSIM package details from API using packageCode
              this.logger.log(
                `Fetching eSIM package details for packageCode: ${esimInvoice.packageCode}`,
              );
              const packages =
                await this.getPackageDetailsByCode(
                  esimInvoice.packageCode,
                );
  
              if (!packages || packages.length === 0) {
                throw new NotFoundException(
                  `Package not found for packageCode: ${esimInvoice.packageCode}`,
                );
              }
  
              const packageDetails = packages[0];
              if (!packageDetails) {
                throw new NotFoundException(
                  `Package details not found for packageCode: ${esimInvoice.packageCode}`,
                );
              }
  
              this.logger.log(
                `Found package: ${packageDetails.name}, Price: ${packageDetails.price} ${packageDetails.currencyCode}`,
              );
  
              // Use price from API response (already in API format)
              // API price is in units where 10000 = $1.00
              const packagePrice = Number(packageDetails.price);
  
              const orderEsimDto = {
                transactionId: undefined, // Will be auto-generated (eSIM order transaction ID)
                amount: packagePrice,
                packageInfoList: [
                  {
                    packageCode: esimInvoice.packageCode,
                    count: 1,
                    price: packagePrice,
                  },
                ],
              };
  
              // Place eSIM order
              // Note: orderEsimForCustomer already updates the invoice status to 'PAID'
              // and creates ESimPurchase records, so no need to update status again
              const orderResult =
                await this.topupEsimForCustomer(
                  invoiceId, // Pass QPay invoice ID
                  orderEsimDto,
                );

              // Get orderNo from ESimPurchase records if available (more reliable)
              let esimOrderNo = orderResult.orderNo;
              try {
                const purchases =
                  await this.getEsimPurchasesByInvoiceId(
                    esimInvoice.id,
                  );
                if (purchases.length > 0 && purchases[0].orderNo) {
                  esimOrderNo = purchases[0].orderNo;
                }
              } catch (error) {
                // If we can't get from purchases, use orderResult.orderNo
                this.logger.warn(
                  `Could not retrieve orderNo from purchases, using orderResult: ${error instanceof Error ? error.message : 'Unknown'}`,
                );
              }
  
              return {
                ...invoiceStatus,
                orderPlaced: true,
                orderNo: esimOrderNo || orderResult.orderNo || null,
                transactionId: orderResult.transactionId,
                message: 'Invoice paid and eSIM order placed successfully',
              };
            } catch (error) {
              this.logger.error(
                `Failed to place eSIM order for invoice (QPay ID: ${invoiceId}, Internal ID: ${esimInvoice.id}): ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
  
              // Try to get orderNo from ESimPurchase records even if order failed
              let esimOrderNo: string | null = null;
              try {
                const purchases =
                  await this.getEsimPurchasesByInvoiceId(
                    esimInvoice.id,
                  );
                if (purchases.length > 0 && purchases[0].orderNo) {
                  esimOrderNo = purchases[0].orderNo;
                }
              } catch {
                // Ignore error, orderNo will be null
              }
  
              // Return invoice status even if order fails
              return {
                ...invoiceStatus,
                orderPlaced: false,
                orderNo: esimOrderNo || null,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to place eSIM order',
                message: 'Invoice is paid but eSIM order failed',
              };
            }
          } else {
            // Already processed
            const invoiceData = esimInvoice.invoiceData as
              | { orderNo?: string }
              | undefined;
  
            // Try to get orderNo from ESimPurchase records
            let esimOrderNo = invoiceData?.orderNo;
            try {
              const purchases =
                await this.getEsimPurchasesByInvoiceId(
                  esimInvoice.id,
                );
              if (purchases.length > 0 && purchases[0].orderNo) {
                esimOrderNo = purchases[0].orderNo;
              }
            } catch (error) {
              // If we can't get from purchases, use invoiceData.orderNo
              this.logger.warn(
                `Could not retrieve orderNo from purchases for already processed invoice: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            }
  
            return {
              ...invoiceStatus,
              orderPlaced: true,
              alreadyProcessed: true,
              orderNo: esimOrderNo || null,
              message: 'Invoice already processed',
            };
          }
        }
      }
  
      // Return invoice status (not paid or no invoice found)
      // Try to get orderNo even if invoice not found or not paid
      let esimOrderNo: string | null = null;
      if (isPaid) {
        try {
          const esimInvoice =
            await this.getEsimInvoiceByQpayId(invoiceId);
          if (esimInvoice) {
            // Try to get orderNo from ESimPurchase records
            try {
              const purchases =
                await this.getEsimPurchasesByInvoiceId(
                  esimInvoice.id,
                );
              if (purchases.length > 0 && purchases[0].orderNo) {
                esimOrderNo = purchases[0].orderNo;
              } else {
                // Try from invoiceData
                const invoiceData = esimInvoice.invoiceData as
                  | { orderNo?: string }
                  | undefined;
                if (invoiceData?.orderNo) {
                  esimOrderNo = invoiceData.orderNo;
                }
              }
            } catch {
              // Try from invoiceData as fallback
              const invoiceData = esimInvoice.invoiceData as
                | { orderNo?: string }
                | undefined;
              if (invoiceData?.orderNo) {
                esimOrderNo = invoiceData.orderNo;
              }
            }
          }
        } catch {
          // Ignore error, orderNo will be null
        }
      }
  
      // Return invoice status (not paid or no invoice found)
      return {
        ...invoiceStatus,
        orderPlaced: false,
        orderNo: esimOrderNo || null,
        message: isPaid
          ? 'Invoice paid but no eSIM invoice found'
          : 'Invoice not paid yet',
      };
  }

  async topupEsimForCustomer(
    qpayInvoiceId: string,
    orderEsimDto: OrderEsimDto,
  ): Promise<{
    orderNo: string;
    transactionId: string;
    amount: number;
  }> {
    // Validate access code is configured
    if (!this.accessCode) {
      this.logger.error('ESIM_ACCESS_CODE is not configured');
      throw new BadRequestException('eSIM service is not properly configured');
    }

    // Generate eSIM order transaction ID if not provided
    // This is used for the eSIM API order, not the same as Transaction entity
    let esimOrderTransactionId = orderEsimDto.transactionId;
    if (!esimOrderTransactionId) {
      esimOrderTransactionId = this.generateTransactionId();
      // Ensure uniqueness (retry if collision - extremely rare)
      let attempts = 0;
      while (
        (await this.transactionRepository.findOne({
          where: { transactionId: esimOrderTransactionId },
        })) &&
        attempts < 10
      ) {
        esimOrderTransactionId = this.generateTransactionId();
        attempts++;
      }
    }

    // Find the EsimInvoice by QPay invoice ID
    // Note: qpayInvoiceId is the external QPay system ID, esimInvoice.id is our internal database ID
    const esimInvoice = await this.esimInvoiceRepository.findOne({
      where: { qpayInvoiceId: qpayInvoiceId },
      relations: ['customer'],
    });

    if (!esimInvoice) {
      throw new NotFoundException(
        `Invoice not found for QPay invoice ID: ${qpayInvoiceId}`,
      );
    }

    // Check if already processed
    if (esimInvoice.status === 'PROCESSED' || esimInvoice.status === 'PAID') {
      this.logger.log(
        `Invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}) already processed, skipping order`,
      );
      // Return existing order data if available
      if (esimInvoice.invoiceData?.orderNo) {
        return {
          orderNo: esimInvoice.invoiceData.orderNo,
          transactionId:
            esimInvoice.invoiceData.transactionId || esimOrderTransactionId,
          amount: esimInvoice.amount,
        };
      }
      throw new BadRequestException('Invoice already processed');
    }

    try {
      // Prepare request body for eSIM Access API
      const requestBody: any = {
        esimTranNo: "",
        iccid: esimInvoice.iccId,
        packageCode: `TOPUP_${esimInvoice.packageCode}`,
        transactionId: esimOrderTransactionId
      };

      // Call eSIM Access API to place order
      //const url = `${this.apiBaseUrl}/open/esim/order`;
      const url = `${this.apiBaseUrl}/open/esim/topup`;
      this.logger.log(
        `Placing eSIM Top-up for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), eSIM Top-up TransactionId: ${esimOrderTransactionId}`,
      );

      let topupResponse: any;
      try {
        const response = await firstValueFrom(
          this.httpService.post(url, requestBody, {
            headers: {
              'RT-AccessCode': this.accessCode,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 seconds timeout for order API
          }),
        );

        topupResponse = response.data;
        this.logger.log(
          `eSIM Top-up API response received for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
        );
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `eSIM Top-up API call failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${axiosError.message}`,
          axiosError.stack,
        );

        // Extract error message from response if available
        let errorMessage = 'Failed to place eSIM Top-up';
        if (axiosError.response?.data) {
          const errorData = axiosError.response.data as any;
          errorMessage =
            errorData.errorMsg ||
            errorData.message ||
            `API Error: ${axiosError.response.status}`;
        } else if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message.includes('timeout')
        ) {
          errorMessage = 'eSIM provider API request timed out';
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: errorMessage,
            error: 'eSIM Topup Failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate API response
      if (topupResponse.obj === null || !topupResponse.success) {
        const errorMsg =
          topupResponse?.errorMsg ||
          'Top-up failed - invalid response from eSIM provider';
        this.logger.error(
          `eSIM Top-up failed for invoice #1 (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${errorMsg}`,
          JSON.stringify(topupResponse),
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: errorMsg,
            error: 'eSIM Topup Failed',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      //now i need to check MY eSIM list
      const queryData: QueryEsimDto = {
        orderNo:"",
        esimTranNo:"",
        iccid: esimInvoice.iccId,
      }
      const currentEsim = await this.queryExtend(queryData);
      // Extract order number from response
      const orderNo = currentEsim.obj.esimList[0].orderNo;
      if (!orderNo) {
        this.logger.error(
          `Top-up response missing transactionId for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id})`,
          JSON.stringify(topupResponse),
        );

        throw new BadRequestException('Top-up response missing transactionId number');
      }

      // Update EsimInvoice with order details and mark as paid (order completed)
      // Status is set to 'PAID' since the order is placed synchronously and completes immediately
      esimInvoice.status = 'PAID';
      const topupResponseData = topupResponse.obj || topupResponse;
      esimInvoice.invoiceData = {
        ...esimInvoice.invoiceData,
        orderNo,
        transactionId: esimOrderTransactionId, // Store eSIM order transaction ID
        esimOrderResponse: topupResponseData,
        processedAt: new Date().toISOString(),
      };

      // Use a database transaction to ensure invoice is saved and committed
      // before creating purchases. This prevents foreign key constraint violations.
        await this.dataSource.transaction(async (manager) => {
        // Save invoice within transaction
        const invoiceRepository = manager.getRepository(EsimInvoice);
        const savedInvoice = await invoiceRepository.save(esimInvoice);

        // Reload invoice with customer relation within the same transaction
        const invoiceWithCustomer = await invoiceRepository.findOne({
          where: { id: savedInvoice.id },
          relations: ['customer'],
        });

        if (!invoiceWithCustomer) {
          throw new Error(
            `Failed to reload invoice ${savedInvoice.id} after saving`,
          );
        }

        if (!invoiceWithCustomer.customer) {
          throw new Error(
            `Invoice ${invoiceWithCustomer.id} does not have a customer relation`,
          );
        }

        // Create purchases within the same transaction
        // This ensures the invoice exists when purchases are created
        try {
          await this.createEsimPurchasesInTransaction(
            currentEsim.obj.esimList[0],
            invoiceWithCustomer,
            esimOrderTransactionId,
            orderEsimDto,
            manager,
          );
        } catch (purchaseError) {
          this.logger.error(
            `Failed to create ESimPurchase records in transaction: ${purchaseError instanceof Error ? purchaseError.message : 'Unknown error'}`,
            purchaseError instanceof Error ? purchaseError.stack : undefined,
          );
          // Don't throw - let transaction complete, purchases can be created later via fallback
        }
      });

      // Try fallback method if transaction completed but purchases weren't created
      // This handles cases where the transaction succeeded but purchase creation failed
      try {
        const invoiceCheck = await this.esimInvoiceRepository.findOne({
          where: { id: esimInvoice.id },
          relations: ['customer'],
        });

        if (invoiceCheck && invoiceCheck.customer) {
          const existingPurchases = await this.esimPurchaseRepository.count({
            where: { invoiceId: invoiceCheck.id },
          });

          if (existingPurchases === 0) {
            this.logger.log(
              `No purchases found for invoice ${invoiceCheck.id}, attempting fallback creation`,
            );
            // Try to get esimTranNo and iccid from invoice data (stored in esimOrderResponse)
            const esimTranNo =
              invoiceCheck.invoiceData?.esimOrderResponse?.esimTranNo ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.esimTranNo ||
              null;
            const iccid =
              invoiceCheck.invoiceData?.esimOrderResponse?.iccid ||
              invoiceCheck.invoiceData?.esimOrderResponse?.obj?.iccid ||
              null;

            await this.createPurchasesFromPackageInfo(
              invoiceCheck,
              esimOrderTransactionId,
              orderEsimDto,
              orderNo,
              esimTranNo,
              iccid,
            );
          }
        }
      } catch (fallbackError) {
        this.logger.error(
          `Fallback purchase creation also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`,
        );
      }
      //================ EMail Notification =================================
      const esimPurchase = await this.esimPurchaseRepository.findOne({where: { orderNo: orderNo}})
      let sendEmailAccount ='';
      if(esimPurchase){
        if(esimPurchase.customerId){
          const sendEmail = await this.customerRepository.findOne({ where: { id: esimPurchase.customerId }});
          if (!sendEmail) 
            throw new Error(`Customer ${esimPurchase.customerId} not found in transaction`);
          else
            sendEmailAccount = sendEmail.email;
        }else{
          if(esimPurchase.userId){
            const sendEmail = await this.userRepository.findOne({ where: { id: esimPurchase.userId}});
            if (!sendEmail) 
              throw new Error(`User ${esimPurchase.userId} not found in transaction`);
            else
              sendEmailAccount = sendEmail?.email;
          }else{
            throw new Error(`User ${esimPurchase.userId} not found in transaction`);
          }
        
        }
      }
      const topupHtml = this.TopupMailBuilder(currentEsim.obj.esimList);
      await this.mailService.sendMail(
        sendEmailAccount,
        'Goy SIM topup', 
        topupHtml
      );
      
      this.logger.log(
        `eSIM Topup successful for customer invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}), OrderNo: ${orderNo}, eSIM Order TransactionId: ${esimOrderTransactionId}`,
      );

      return {
        orderNo,
        transactionId: esimOrderTransactionId,
        amount: orderEsimDto.amount,
      };
    } catch (error) {
      this.logger.error(
        `eSIM topup failed for invoice (QPay ID: ${qpayInvoiceId}, Internal ID: ${esimInvoice.id}): ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    }
  }

  TopupMailBuilder(esimList: EsimItem[]): string{
    const htmlTopup = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

        <p>Эрхэм харилцагч танд,</p>

        <p>
          Манай бүтээгдэхүүн үйлчилгээг сонгон захиалсан танд баярлалаа🍀 Таны eSIM-ны ЦЭНЭГЛЭЛТ-ийн мэдээллийг илгээж байна.  
          Та төхөөрөмж дээрээ идэвхжүүлэхийн тулд QR кодыг уншуулж хэрэглэнэ үү.
        </p>

        <p><strong>Таны цэнэглэсэн багцын мэдээлэл:</strong></p>

        <table cellpadding="10" cellspacing="0" border="0" border-spacing="0">
          <tr>
            <!-- INFO BOX -->
            <td>
              <div style="
                background:#bfe797;
                padding:8px;
                border-radius:8px;
                width:450px;
                font-size:14px;
              ">
                <p style="line-height:50%;"><strong>Захиалгын дугаар(orderNo):</strong> ${esimList[0].orderNo}</p>
                <p style="line-height:50%;"><strong>eSIM дугаар(esimTranNo):</strong> ${esimList[0].esimTranNo}</p>
                <p style="line-height:50%;"><strong>ICCID дугаар(iccid):</strong> ${esimList[0].iccid}</p>
                <p style="line-height:50%">
                  <strong>APN:</strong>
                  <a href=${esimList[0].apn} target="_blank">${esimList[0].apn}</a>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <p style="margin-top:20px;">
          Мөн дараах QR кодоор дата хэрэглээгээ хянах боломжтой:  
          <a href="${esimList[0].shortUrl}" target="_blank">${esimList[0].shortUrl}</a>
        </p>

        <hr style="margin-top:20px; border:none; border-top:1px solid #e5e5e5;" />

        <div style="
          margin-top:16px;
          font-size:13px;
          color:#555;
          line-height:1.6;
        ">
          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Утас:</strong>
            <a href="tel:+97670001234" style="color:#34a04b; text-decoration:none;">
              +976 6001-6363
            </a>
          </p>

          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Фэйсбүүк хаяг:</strong>
            <a href="https://www.facebook.com/GOYeSIM/" target="_blank" style="color:#34a04b; text-decoration:none;">
              facebook.com/GOYeSIM
            </a>
          </p>

          <p style="margin:3px 0;">
            <span style="color:#34a04b;">🍀</span>
            <strong>Вэб сайт:</strong>
            <a href="https://www.goysim.mn" target="_blank" style="color:#34a04b; text-decoration:none;">
              www.goysim.mn
            </a>
          </p>
        </div>
        <p>Хүндэтгэсэн,</p>
        <strong><p style="color: #34a04b;">GOY eSIM</p></strong>
      </div>
      `;
    return htmlTopup;
  }

  /**
   * Get EsimInvoice by QPay invoice ID
   * @param qpayInvoiceId - The QPay invoice ID
   * @returns The EsimInvoice or null if not found
   */
  async getEsimInvoiceByQpayId(
    qpayInvoiceId: string,
  ): Promise<EsimInvoice | null> {
    return await this.esimInvoiceRepository.findOne({
      where: { qpayInvoiceId },
      relations: ['customer'],
    });
  }

  /**
   * Check invoice status and process if paid (for cron jobs)
   * @param qpayInvoiceId - The QPay invoice ID to check
   * @returns Invoice status result
   */
  async checkInvoiceStatus(qpayInvoiceId: string): Promise<Record<string, unknown>> {
    // Check invoice status from QPay
    const invoiceStatus = (await this.qpayConnectionService.checkInvoice(
      qpayInvoiceId,
    )) as {
      count: number;
      rows?: Array<{ payment_status: string }>;
      [key: string]: unknown;
    };

    // Check if invoice is paid
    const isPaid =
      invoiceStatus.count > 0 &&
      invoiceStatus.rows?.some(
        (row: { payment_status: string }) => row.payment_status === 'PAID',
      );

    if (isPaid) {
      // Find the EsimInvoice record by QPay invoice ID
      const esimInvoice = await this.getEsimInvoiceByQpayId(qpayInvoiceId);

      if (esimInvoice && esimInvoice.packageCode) {
        // Check if already processed
        if (
          esimInvoice.status !== 'PROCESSED' &&
          esimInvoice.status !== 'PAID'
        ) {
          try {
            // Process the invoice based on type (purchase or topup)
            if (esimInvoice.iccId) {
              // This is a topup invoice
              const orderEsimDto = {
                transactionId: undefined,
                amount: esimInvoice.amount,
                packageInfoList: [
                  {
                    packageCode: esimInvoice.packageCode,
                    count: 1,
                    price: esimInvoice.amount,
                  },
                ],
              };

              const orderResult = await this.topupEsimForCustomer(
                qpayInvoiceId,
                orderEsimDto,
              );

              return {
                ...invoiceStatus,
                orderPlaced: true,
                orderNo: orderResult.orderNo,
                transactionId: orderResult.transactionId,
                message: 'Invoice paid and eSIM topup processed successfully',
              };
            } else {
              // This is a purchase invoice
              const orderEsimDto = {
                transactionId: undefined,
                amount: esimInvoice.amount,
                packageInfoList: [
                  {
                    packageCode: esimInvoice.packageCode,
                    count: 1,
                    price: esimInvoice.amount,
                  },
                ],
              };

              const orderResult = await this.orderEsimForCustomer(
                qpayInvoiceId,
                orderEsimDto,
              );

              return {
                ...invoiceStatus,
                orderPlaced: true,
                orderNo: orderResult.orderNo,
                transactionId: orderResult.transactionId,
                message: 'Invoice paid and eSIM order processed successfully',
              };
            }
          } catch (error) {
            this.logger.error(
              `Failed to process invoice ${qpayInvoiceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

            return {
              ...invoiceStatus,
              orderPlaced: false,
              error: error instanceof Error ? error.message : 'Failed to process invoice',
              message: 'Invoice is paid but processing failed',
            };
          }
        } else {
          return {
            ...invoiceStatus,
            orderPlaced: true,
            alreadyProcessed: true,
            message: 'Invoice already processed',
          };
        }
      }
    }

    return {
      ...invoiceStatus,
      orderPlaced: false,
      message: isPaid ? 'Invoice paid but no eSIM invoice found' : 'Invoice not paid yet',
    };
  }

}
