import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { ESimPurchase } from '../entities/esim-purchase.entity';
import { WalletService } from '../wallet/wallet.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PurchaseEsimDto } from './dto/purchase-esim.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  TransactionType,
  TransactionStatus,
} from '../users/dto/transaction-types.enum';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(ESimPurchase)
    private readonly esimPurchaseRepository: Repository<ESimPurchase>,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
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
}
