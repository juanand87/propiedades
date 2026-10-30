import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { ShippingMethod } from './shipping-method.entity';

@Entity('vendor_shipping_methods')
@Index(['vendorId', 'shippingMethodId'], { unique: true })
export class VendorShippingMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'vendor_id', length: 36 })
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'shipping_method_id' })
  shippingMethodId: number;

  @ManyToOne(() => ShippingMethod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipping_method_id' })
  shippingMethod: ShippingMethod;

  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;

  @Column({ type: 'json', nullable: true })
  config: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
