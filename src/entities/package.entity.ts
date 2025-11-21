import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  package_code: string;

  @Column({ type: 'varchar', nullable: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  price: string;

  @Column({ type: 'varchar', nullable: true })
  retail_price: string;

  @Column({ type: 'varchar', nullable: true })
  currency_code: string;

  @Column({ type: 'bigint', nullable: true })
  volume: number;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ type: 'varchar', nullable: true })
  duration_unit: string;

  @Column({ type: 'int', nullable: true })
  sms_status: number;

  @Column({ type: 'int', nullable: true })
  data_type: number;

  @Column({ type: 'int', nullable: true })
  unused_valid_time: number;

  @Column({ type: 'int', nullable: true })
  active_type: number;

  @Column({ type: 'boolean', default: false })
  favorite: boolean;

  @Column({ type: 'int', nullable: true })
  support_topup_type: number;

  @Column({ type: 'text', nullable: true })
  fup_policy: string;

  @Column({ type: 'varchar', nullable: true })
  speed: string;

  @Column({ type: 'varchar', nullable: true })
  ip_export: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  location_code: string;

  @Column({ type: 'varchar', nullable: true })
  buy_price: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

