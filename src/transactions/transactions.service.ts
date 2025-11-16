/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { WalletService } from '../wallet/wallet.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PurchaseEsimDto } from './dto/purchase-esim.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { OrderEsimDto } from './dto/order-esim.dto';
import {
  TransactionType,
  TransactionStatus,
} from '../users/dto/transaction-types.enum';
import { CURRENCY_CONSTANTS } from '../marketplace/constants/currency.constants';

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
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
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
      } catch (error) {
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
      relations: ['transaction'],
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
      relations: ['transaction', 'user'],
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
      relations: ['transaction'],
    });
  }

  /**
   * Get eSIM purchase by transaction ID
   * @param transactionId - The transaction ID
   * @param userId - Optional user ID to ensure ownership
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
      relations: ['transaction'],
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
}
