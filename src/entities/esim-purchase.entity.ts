import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// Transaction import removed - transactionId is now a plain string without relation
import { Customer } from './customer.entity';
import { User } from './user.entity';

/**
 * eSIM Purchase entity for tracking purchased eSIM cards
 * Links to transaction and stores all eSIM package details
 * Supports both User purchases (userId) and Customer purchases (customerId)
 */
@Entity('esim_purchases')
@Index(['userId', 'createdAt']) // Index for user purchase history queries
@Index(['customerId', 'createdAt']) // Index for customer purchase history queries
@Index(['transactionId']) // Index for transaction reference (removed unique to support multiple SIMs per transaction)
@Index(['packageCode']) // Index for package code queries
@Index(['invoiceId']) // Index for invoice reference
export class ESimPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ type: 'varchar' })
  transactionId: string; // Reference to transaction.transactionId (for user purchases) or unique ID (for customer purchases)

  @Column({ type: 'varchar', nullable: true })
  orderNo: string | null; // eSIM provider order number

  @Column({ type: 'varchar', nullable: true })
  esimTranNo: string | null; // eSIM provider transaction number

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
