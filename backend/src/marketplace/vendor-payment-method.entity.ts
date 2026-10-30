import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { MarketplacePaymentMethod } from './marketplace-payment-method.entity';

@Entity('vendor_payment_methods')
export class VendorPaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'vendor_id', type: 'int' })
  vendorId: number;

  @Column({ name: 'marketplace_payment_method_id', type: 'int' })
  marketplacePaymentMethodId: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ name: 'custom_config', type: 'json', nullable: true })
  customConfig: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => MarketplacePaymentMethod)
  @JoinColumn({ name: 'marketplace_payment_method_id' })
  paymentMethod: MarketplacePaymentMethod;
}
