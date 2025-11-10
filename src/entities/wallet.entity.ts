import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Wallet entity for managing user balances
 * Separate table for better auditability and transaction history
 */
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  balance: number;

  @Column({ type: 'varchar', default: 'USD', nullable: true })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isFrozen: boolean;

  @Column({ type: 'text', nullable: true })
  frozenReason: string | null;

  @VersionColumn()
  version: number; // Optimistic locking to prevent race conditions

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastTransactionAt: Date | null;
}

