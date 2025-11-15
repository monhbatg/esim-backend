import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { User } from '../entities/user.entity';
import { WALLET_CONSTANTS } from './constants/wallet.constants';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get or create wallet for a user
   * @param userId - The ID of the user
   * @returns The user's wallet
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      // Verify user exists
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate and set currency
      const currency = this.validateCurrency(
        user.preferredCurrency || WALLET_CONSTANTS.DEFAULT_CURRENCY,
      );

      // Create wallet with user's preferred currency
      wallet = this.walletRepository.create({
        userId,
        balance: 0,
        currency,
        isActive: true,
      });

      wallet = await this.walletRepository.save(wallet);
      this.logger.log(
        `Wallet created for user ${userId} with currency ${currency}`,
      );
    }

    return wallet;
  }

  /**
   * Get wallet by user ID
   * @param userId - The ID of the user
   * @returns The user's wallet
   * @throws NotFoundException if wallet not found
   */
  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for user');
    }

    return wallet;
  }

  /**
   * Get balance for a user
   * @param userId - The ID of the user
   * @returns The user's current balance
   */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return Number(wallet.balance || 0);
  }

  /**
   * Add balance to a user's wallet
   * Uses optimistic locking to prevent race conditions
   * @param userId - The ID of the user
   * @param amount - The amount to add (must be > 0)
   * @param metadata - Optional metadata for transaction tracking
   * @returns The updated wallet
   * @throws NotFoundException if user/wallet not found
   * @throws BadRequestException if amount is invalid
   */
  async addBalance(userId: string, amount: number): Promise<Wallet> {
    // Validate amount
    this.validateAmount(amount);

    // Retry logic for optimistic locking conflicts
    let attempts = 0;
    while (attempts < WALLET_CONSTANTS.MAX_RETRY_ATTEMPTS) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const walletRepository = manager.getRepository(Wallet);

          // Get wallet with lock
          let wallet = await walletRepository.findOne({
            where: { userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!wallet) {
            // Create wallet if it doesn't exist
            const user = await this.userRepository.findOne({
              where: { id: userId },
            });

            if (!user) {
              throw new NotFoundException('User not found');
            }

            wallet = walletRepository.create({
              userId,
              balance: 0,
              currency: this.validateCurrency(
                user.preferredCurrency || WALLET_CONSTANTS.DEFAULT_CURRENCY,
              ),
              isActive: true,
            });
          }

          // Validate wallet state
          this.validateWalletState(wallet);

          // Increment balance
          const previousBalance = Number(wallet.balance || 0);
          const newBalance = previousBalance + amount;

          // Check maximum balance limit
          if (newBalance > WALLET_CONSTANTS.MAX_BALANCE) {
            throw new BadRequestException(
              `Balance cannot exceed ${WALLET_CONSTANTS.MAX_BALANCE.toLocaleString()}. Current: ${previousBalance.toFixed(2)}, Attempted: ${amount.toFixed(2)}`,
            );
          }

          wallet.balance = newBalance;

          // Round to 2 decimal places
          wallet.balance = Math.round(wallet.balance * 100) / 100;
          wallet.lastTransactionAt = new Date();

          // Save with optimistic locking
          wallet = await walletRepository.save(wallet);

          this.logger.log(
            `Balance added: User ${userId}, Amount: ${amount}, Previous: ${previousBalance}, New: ${wallet.balance}`,
          );

          // TODO: Create transaction record when TransactionModule is implemented
          // await this.createTransactionRecord({
          //   walletId: wallet.id,
          //   userId,
          //   type: TransactionType.DEPOSIT,
          //   amount,
          //   previousBalance,
          //   newBalance: wallet.balance,
          //   metadata,
          // });

          return wallet;
        });
      } catch (error) {
        // Handle optimistic locking conflict
        if (
          error instanceof ConflictException ||
          error.code === '23505' ||
          error.message?.includes('version')
        ) {
          attempts++;
          if (attempts >= WALLET_CONSTANTS.MAX_RETRY_ATTEMPTS) {
            this.logger.error(
              `Failed to add balance after ${attempts} attempts for user ${userId}`,
            );
            throw new ConflictException(
              'Balance update conflict. Please retry.',
            );
          }
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, WALLET_CONSTANTS.RETRY_DELAY_MS * attempts),
          );
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Failed to update balance after retries');
  }

  /**
   * Deduct balance from a user's wallet
   * @param userId - The ID of the user
   * @param amount - The amount to deduct (must be > 0)
   * @param metadata - Optional metadata for transaction tracking
   * @returns The updated wallet
   * @throws NotFoundException if user/wallet not found
   * @throws BadRequestException if amount is invalid or insufficient balance
   */
  async deductBalance(
    userId: string,
    amount: number,
    metadata?: { transactionId?: string; description?: string },
  ): Promise<Wallet> {
    // Validate amount
    this.validateAmount(amount);

    // Retry logic for optimistic locking conflicts
    let attempts = 0;
    while (attempts < WALLET_CONSTANTS.MAX_RETRY_ATTEMPTS) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const walletRepository = manager.getRepository(Wallet);

          // Get wallet with lock
          let wallet = await walletRepository.findOne({
            where: { userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!wallet) {
            throw new NotFoundException('Wallet not found for user');
          }

          // Validate wallet state
          this.validateWalletState(wallet);

          // Check balance
          const currentBalance = Number(wallet.balance || 0);
          if (currentBalance < amount) {
            throw new BadRequestException(
              `Insufficient balance. Current: ${currentBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`,
            );
          }

          // Deduct balance
          wallet.balance = currentBalance - amount;
          wallet.balance = Math.round(wallet.balance * 100) / 100;
          wallet.lastTransactionAt = new Date();

          wallet = await walletRepository.save(wallet);

          this.logger.log(
            `Balance deducted: User ${userId}, Amount: ${amount}, Previous: ${currentBalance}, New: ${wallet.balance}`,
          );

          // TODO: Create transaction record when TransactionModule is implemented
          // await this.createTransactionRecord({
          //   walletId: wallet.id,
          //   userId,
          //   type: TransactionType.WITHDRAWAL,
          //   amount,
          //   previousBalance: currentBalance,
          //   newBalance: wallet.balance,
          //   metadata,
          // });

          return wallet;
        });
      } catch (error) {
        // Handle optimistic locking conflict
        if (
          error instanceof ConflictException ||
          error.code === '23505' ||
          error.message?.includes('version')
        ) {
          attempts++;
          if (attempts >= WALLET_CONSTANTS.MAX_RETRY_ATTEMPTS) {
            this.logger.error(
              `Failed to deduct balance after ${attempts} attempts for user ${userId}`,
            );
            throw new ConflictException(
              'Balance update conflict. Please retry.',
            );
          }
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, WALLET_CONSTANTS.RETRY_DELAY_MS * attempts),
          );
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Failed to update balance after retries');
  }

  /**
   * Check if user has sufficient balance
   * @param userId - The ID of the user
   * @param amount - The amount to check
   * @returns true if user has sufficient balance
   */
  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  /**
   * Get balance with currency information
   * @param userId - The ID of the user
   * @returns Object containing balance and currency
   */
  async getBalanceWithCurrency(userId: string): Promise<{
    balance: number;
    currency: string;
  }> {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: Number(wallet.balance),
      currency: wallet.currency,
    };
  }

  /**
   * Freeze wallet (for admin operations, disputes, etc.)
   * @param userId - The ID of the user
   * @param reason - Reason for freezing
   */
  async freezeWallet(userId: string, reason?: string): Promise<Wallet> {
    const wallet = await this.getWallet(userId);
    wallet.isFrozen = true;
    wallet.frozenReason = reason || null;
    const updated = await this.walletRepository.save(wallet);
    this.logger.log(
      `Wallet frozen for user ${userId}${reason ? ` - Reason: ${reason}` : ''}`,
    );
    return updated;
  }

  /**
   * Unfreeze wallet
   * @param userId - The ID of the user
   */
  async unfreezeWallet(userId: string): Promise<Wallet> {
    const wallet = await this.getWallet(userId);
    wallet.isFrozen = false;
    wallet.frozenReason = null;
    const updated = await this.walletRepository.save(wallet);
    this.logger.log(`Wallet unfrozen for user ${userId}`);
    return updated;
  }

  /**
   * Validate amount
   * @param amount - Amount to validate
   * @throws BadRequestException if invalid
   */
  private validateAmount(amount: number): void {
    if (!amount || amount <= 0) {
      throw new BadRequestException(
        `Amount must be greater than 0. Minimum: ${WALLET_CONSTANTS.MIN_AMOUNT}`,
      );
    }

    if (amount < WALLET_CONSTANTS.MIN_AMOUNT) {
      throw new BadRequestException(
        `Amount must be at least ${WALLET_CONSTANTS.MIN_AMOUNT}`,
      );
    }

    if (amount > WALLET_CONSTANTS.MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount cannot exceed ${WALLET_CONSTANTS.MAX_AMOUNT.toLocaleString()} per transaction`,
      );
    }
  }

  /**
   * Validate currency code
   * @param currency - Currency code to validate
   * @returns Validated currency code
   * @throws BadRequestException if invalid
   */
  private validateCurrency(currency: string): string {
    const upperCurrency = currency.toUpperCase();
    if (
      !WALLET_CONSTANTS.SUPPORTED_CURRENCIES.includes(
        upperCurrency as (typeof WALLET_CONSTANTS.SUPPORTED_CURRENCIES)[number],
      )
    ) {
      this.logger.warn(
        `Unsupported currency: ${currency}. Defaulting to ${WALLET_CONSTANTS.DEFAULT_CURRENCY}`,
      );
      return WALLET_CONSTANTS.DEFAULT_CURRENCY;
    }
    return upperCurrency as (typeof WALLET_CONSTANTS.SUPPORTED_CURRENCIES)[number];
  }

  /**
   * Validate wallet state (active and not frozen)
   * @param wallet - Wallet to validate
   * @throws BadRequestException if wallet is invalid
   */
  private validateWalletState(wallet: Wallet): void {
    if (wallet.isFrozen) {
      throw new BadRequestException(
        `Wallet is frozen. Reason: ${wallet.frozenReason || 'No reason provided'}`,
      );
    }

    if (!wallet.isActive) {
      throw new BadRequestException('Wallet is not active');
    }
  }
}
