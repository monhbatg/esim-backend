import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('salary')
export class Salary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal' })
  totalFinalProfit: number;

  @Column({ length: 50 })
  investmentTaxPercent: string;

  @Column({ type: 'decimal' })
  investmentTaxAmount: number;

  @Column({ type: 'decimal' })
  runningCosts: number;

  @Column({ type: 'jsonb' })
  operatorsSalaryDetail: Array<{
    operatorId: string;
    operatorName: string;
    operatorSalary: number;
  }>;

  @Column({ type: 'decimal' })
  totalOperatorSalary: number;

  @Column({ type: 'jsonb' })
  developerSalaryDetail: Array<{
    developer: string;
    salaryPercen: string;
    salary: number;
  }>;

  @Column({ type: 'decimal' })
  totalDeveloperSalary: number;

  @Column({ type: 'decimal' })
  totalAdminSalary: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}