import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { DataPackageLocation } from './data-package-locations.entity';

@Entity({ name: 'package_operators' })
@Index(['operatorName']) // Index for operator name lookups
@Index(['networkType']) // Index for network type queries
export class DataPackageOperator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'operator_name', type: 'varchar'  })
  operatorName: string;

  @Column({ name: 'network_type', type: 'varchar'  })
  networkType: string;

  @ManyToOne(() => DataPackageLocation, (loc) => loc.operatorList, {
    onDelete: 'CASCADE',
  })
  dataPackageLocation: DataPackageLocation;
}
