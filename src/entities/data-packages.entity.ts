import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataPackageLocation } from './data-package-locations.entity';

@Entity({ name: 'packages' })
@Index(['packageCode']) // Index for package code lookups
@Index(['locationCode']) // Index for location-based queries
@Index(['slug']) // Index for slug-based queries
@Index(['volume']) // Index for volume-based queries
export class DataPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'package_code', type: 'varchar', unique: true })
  packageCode: string;

  @Column({ type: 'varchar', nullable: true })
  slug: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number;

  @Column({ name: 'currency_code', type: 'varchar', nullable: true })
  currencyCode: string;

  @Column({ type: 'bigint', nullable: true })
  volume: number;

  @Column({ name: 'sms_status', type: 'smallint', nullable: true })
  smsStatus: number;

  @Column({ name: 'data_type', type: 'smallint', nullable: true })
  dataType: number;

  @Column({ name: 'unused_valid_time', type: 'int', nullable: true })
  unusedValidTime: number;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ name: 'duration_unit', type: 'varchar', nullable: true })
  durationUnit: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

  @Column({ name: 'location_code', type: 'varchar', nullable: true })
  locationCode: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'active_type', type: 'smallint', nullable: true })
  activeType: number;

  @Column({ default: false })
  favorite: boolean;

  @Column({
    name: 'retail_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  retailPrice: number;

  @Column({ type: 'varchar', nullable: true })
  speed: string;

  @Column({ name: 'ip_export', type: 'varchar', nullable: true })
  ipExport: string;

  @Column({ name: 'support_topup_type', type: 'smallint', nullable: true })
  supportTopUpType: number;

  @Column({ name: 'fup_policy', type: 'text', nullable: true })
  fupPolicy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    name: 'buy_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  buyPrice: number;

  // Relations
  @OneToMany(
    () => DataPackageLocation,
    (location) => location.dataPackageEntity,
    {
      cascade: true,
    },
  )
  locationNetworkList: DataPackageLocation[];
}
