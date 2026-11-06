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
import { MailService } from 'src/transactions/services/mail.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
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
  async addBalanceRequest(userId: string, amount: number): Promise<Wallet> {
    // Validate amount
    this.validateAmount(amount);
    this.logger.log(`Adding balance: User ${userId}, Amount: ${amount}`);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const addFundHTML = this.addFundMailBuilder(user!, amount);
    await this.mailService.sendMail(
        'javhaa08@gmail.com',
        'Goy eSIM add Fund',
        addFundHTML,
      );
    //customer add fund request and sent to email to admin
    let wallet = await this.walletRepository.findOne({
            where: { userId }
          });
    if(wallet)
      return wallet;
    else 
      return new Wallet();
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

  addFundMailBuilder(user: User, amount: number): string{
      const htmlTopup = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  
          <p>Эрхэм Адман танд,</p>
  
          <p>
            Танд GoySIM харилцагчаас Данс цэнэглэлт хийлгэх хүсэлт илгээсэн байна.
          </p>
  
          <p><strong>Цэнэглэлт хийлгэх мэдээлэл:</strong></p>
  
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
                  <table width="100%" cellpadding="8" cellspacing="0"
                  style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:14px;">

                        <tr>
                            <td width="50%">
                                <strong>UserId:</strong> ${user.id}
                            </td>
                            <td width="50%">
                                <strong>Firstname:</strong> ${user.firstName}
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <strong>Lastname:</strong> ${user.lastName}
                            </td>
                            <td>
                                <strong>Phone:</strong> ${user.phoneNumber}
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <strong>Email:</strong> ${user.email}
                            </td>
                            <td>
                                <strong>Amount:</strong> ${amount}төгрөг
                            </td>
                        </tr>

                        <tr>
                            <td colspan="2">
                                <strong>Date:</strong> ${new Date().toLocaleDateString()}
                            </td>
                        </tr>

                    </table>
                  </p>
                </div>
              </td>
            </tr>
          </table>
 
 
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
}

