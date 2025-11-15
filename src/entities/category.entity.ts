import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Country } from './country.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name_en: string;

  @Column({ type: 'varchar', length: 100 })
  name_mn: string;

  @Column({ type: 'text', nullable: true })
  description_en: string | null;

  @Column({ type: 'text', nullable: true })
  description_mn: string | null;

  @ManyToMany(() => Country, (country) => country.categories)
  countries: Country[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

