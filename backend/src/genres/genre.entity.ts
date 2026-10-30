import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('genres')
export class Genre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToMany(() => Product, (product) => product.genres)
  products: Product[];
}
