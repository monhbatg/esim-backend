import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Region } from './region.entity';
import { Category } from './category.entity';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name_en: string;

  @Column({ type: 'varchar', length: 100 })
  name_mn: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string | null;

  @Column()
  region_id: number;

  @Column({ type: 'varchar', length: 2 })
  country_code: string;

  @ManyToOne(() => Region, (region) => region.countries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @ManyToMany(() => Category, (category) => category.countries)
  @JoinTable({
    name: 'country_categories',
    joinColumn: { name: 'country_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
