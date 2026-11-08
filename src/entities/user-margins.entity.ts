import { 
  Column,
  CreateDateColumn,
  Entity, 
  JoinColumn, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn
} from "typeorm";
import { User } from "./user.entity";
import { DataPackageEntity } from "./data-packages.entity";

@Entity('user_margins')
export class UserMargins {
  @PrimaryGeneratedColumn('uuid')
  id: string; // unique identifier for the user margin record

  @Column({ nullable: true })
  userId: string; // user id

  @Column({ nullable: true })
  packageId: string; // package id

  @Column({ name: 'margin', type: 'decimal', precision: 10, scale: 2 })
  margin: number;   // tuhain hariltsagch uriin zarahiig husej bui margin huwi dung zooj ugnu uunees hamaar yerunhii package une huwisana
  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}