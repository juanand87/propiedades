import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('formats')
export class Format {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToMany(() => Product, (product) => product.formats)
  products: Product[];
}
