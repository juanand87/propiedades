import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

@Entity('vendor_categories')
export class VendorCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  name: string;

  @Column({ nullable: true })
  slug: string;

  @Column({ nullable: true, type: 'varchar', length: 100 })
  icon: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  format: string; // 'vinyl', 'cd', 'cassette', 'vhs', etc.

  @Column({ default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
