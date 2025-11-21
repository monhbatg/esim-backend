import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { DataPackageEntity } from './data-packages.entity';
import { DataPackageOperator } from './data-package-operators.entity';

@Entity({ name: 'package_locations' })
@Index(['locationCode']) // Index for location code lookups
@Index(['locationName']) // Index for location name queries
export class DataPackageLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'location_name', type: 'varchar' })
  locationName: string;

  @Column({ name: 'location_logo', type: 'text', nullable: true })
  locationLogo: string;

  @Column({ name: 'location_code', type: 'varchar' })
  locationCode: string;

  @ManyToOne(() => DataPackageEntity, (pkg) => pkg.locationNetworkList, {
    onDelete: 'CASCADE',
  })
  dataPackageEntity: DataPackageEntity;

  @OneToMany(() => DataPackageOperator, (op) => op.dataPackageLocation, {
    cascade: true,
  })
  operatorList: DataPackageOperator[];
}
