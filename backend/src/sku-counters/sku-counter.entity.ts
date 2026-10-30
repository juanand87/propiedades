import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';

@Entity('sku_counters')
export class SkuCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'format_prefix', length: 10 })
  formatPrefix: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'last_number', type: 'int', default: 0 })
  lastNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
