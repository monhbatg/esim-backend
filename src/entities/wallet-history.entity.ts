import { Entity, PrimaryGeneratedColumn, JoinColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";
import { Wallet } from "./wallet.entity";

@Entity('wallets_history')
export class WalletHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string; // user id
  
  @Column({ nullable: true })
  walletId: string; // wallet id

  @Column({ name: 'type'})
  type: string; // transaction type (e.g., deposit, withdrawal, purchase)

  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number; // transaction amount

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}