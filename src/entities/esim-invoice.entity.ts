import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { User } from './user.entity';

@Entity('esim_invoices')
export class EsimInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column()
  amount: number;

  @Column({ unique: true })
  senderInvoiceNo: string; // QPay sender_invoice_no

  @Column({ nullable: true })
  qpayInvoiceId: string; // QPay invoice_id returned from API

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ nullable: true})
  iccId: string;

  @Column({ nullable: true })
  packageCode: string;

  @Column({ nullable: true })
  customerId: string;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'json', nullable: true })
  invoiceData: any; // Store full invoice response/data

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}