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
import { Transaction } from './transaction.entity';

/**
 * eSIM Purchase entity for tracking purchased eSIM cards
 * Links to transaction and stores all eSIM package details
 */
@Entity('esim_purchases')
@Index(['userId', 'createdAt']) // Index for user purchase history queries
@Index(['transactionId'], { unique: true }) // Unique index for transaction reference
@Index(['packageCode']) // Index for package code queries
export class ESimPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  transactionId: string; // Reference to transaction.transactionId

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transactionId', referencedColumnName: 'transactionId' })
  transaction: Transaction | null;

  // eSIM Package Details
  @Column()
  packageCode: string; // e.g., 'CKH491'

  @Column()
  slug: string; // e.g., 'NA-3_1_7'

  @Column()
  packageName: string; // e.g., 'North America 1GB 7Days'

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  price: number; // Price at time of purchase

  @Column({ type: 'varchar' })
  currency: string; // Currency at time of purchase

  @Column({ type: 'bigint' })
  dataVolume: number; // Data volume in bytes

  @Column({ type: 'int' })
  duration: number; // Duration value

  @Column({ type: 'varchar' })
  durationUnit: string; // e.g., 'DAY', 'MONTH'

  @Column({ type: 'text' })
  location: string; // Comma-separated country codes (e.g., 'MX,US,CA')

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // eSIM Card Details (after activation)
  @Column({ type: 'varchar', nullable: true })
  iccid: string | null; // ICCID of the eSIM card

  @Column({ type: 'varchar', nullable: true })
  activationCode: string | null; // Activation code/QR code data

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null; // When eSIM was activated

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null; // When eSIM expires

  @Column({ type: 'boolean', default: false })
  isActivated: boolean; // Whether eSIM has been activated

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Whether eSIM is currently active

  // Additional package metadata
  @Column({ type: 'json', nullable: true })
  packageMetadata: Record<string, any> | null; // Full package details (operators, networks, etc.)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

