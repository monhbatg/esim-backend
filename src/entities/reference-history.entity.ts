
import { ReferencesModule } from '../users/dto/reference-module.enum';
import { ReferencesType } from '../users/dto/reference-type.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('references_history')
export class ReferencesHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  referenceId: string;   // FK but not required to enforce

  @Column({
    type: 'enum',
    enum: ReferencesModule,
  })
  module: ReferencesModule;

  @Column()
  key: string;

  @Column({
    type: 'enum',
    enum: ReferencesType,
  })
  type: ReferencesType;

  @Column({ type: 'text', nullable: true })
  oldValue: string;

  @Column({ type: 'text', nullable: true })
  newValue: string;

  @Column({ type: 'text', nullable: true })
  changedBy: string; // user id / email / service name

  @CreateDateColumn()
  changedAt: Date;
}