import { 
    Column, 
    Entity, 
    Index, 
    JoinColumn, 
    ManyToOne, 
    PrimaryGeneratedColumn, 
} from "typeorm";
import { Transaction } from "./transaction.entity";
 

@Entity('invoice_payment')
@Index(['invoiceId','paymentId'])
@Index(['transactionId'], { unique: true})
export class InvoicePayment{
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({unique: true})
    invoiceId: string;

    @Column()
    amount: number;

    @Column()
    senderInfo: string

    @Column({ type: 'json', nullable: true })
    packageInfo: Record<string, any> | null;;

    @Column({ type: 'timestamp', nullable: true})
    invoiceCreatedAt: Date | null;

    @Column({unique: true, nullable: true})
    paymentId: string;

    @Column({nullable: true})
    paidAmount: number;

    @Column({nullable: true})
    paymentStatus: string;

    @Column({ type: 'json', nullable: true })
    paymentResponse: Record<string, any> | null;

    @Column({ type: 'json', nullable: true })
    p2pTrancation: Record<string, any> | null;

    @Column( { type: 'timestamp', nullable: true})
    paymentCheckedAt: Date | null;

    @Column({nullable: true})
    transactionId: String;

    @ManyToOne(()=> Transaction, {onDelete: 'CASCADE'})
    @JoinColumn({ name: 'transactionId' })
    transaction: Transaction;

    @Column({ type: 'json', nullable: true })
    orderResponse: Record<string, any> | null;

    @Column({ type: 'json', nullable: true })
    currentEsim:  Record<string, any> | null;
    
    
    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date | null; // When transaction was completed
}