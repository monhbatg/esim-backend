import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { TransactionType, TransactionStatus } from '../users/dto/transaction-types.enum';

/**
 * Transaction entity for tracking all wallet transactions
 * Provides full audit trail for financial operations
 */
@Entity('transactions')
@Index(['userId', 'createdAt']) // Index for user transaction history queries
@Index(['transactionId'], { unique: true }) // Unique index for transaction ID
@Index(['status', 'createdAt']) // Index for status-based queries
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  transactionId: string; // Unique transaction identifier (e.g., TXN-20240101-ABC123)

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  walletId: string;

  @ManyToOne(() => Wallet, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet | null;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  amount: number;

  @Column({ type: 'varchar', default: 'USD', nullable: true })
  currency: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  balanceBefore: number | null; // Balance before transaction

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  balanceAfter: number | null; // Balance after transaction

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null; // External reference (e.g., order ID, payment ID)

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any> | null; // Additional transaction data

  @Column({ type: 'text', nullable: true })
  failureReason: string | null; // Reason if transaction failed

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null; // When transaction was completed
}

