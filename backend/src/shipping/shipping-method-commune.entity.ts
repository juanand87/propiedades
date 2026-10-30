import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { VendorShippingMethod } from './vendor-shipping-method.entity';
import { Commune } from './commune.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('shipping_method_communes')
@Index(['vendorShippingMethodId', 'communeId'], { unique: true })
export class ShippingMethodCommune {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'vendor_shipping_method_id' })
  vendorShippingMethodId: number;

  @ManyToOne(() => VendorShippingMethod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_shipping_method_id' })
  vendorShippingMethod: VendorShippingMethod;

  @Column({ name: 'commune_id' })
  communeId: number;

  @ManyToOne(() => Commune, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commune_id' })
  commune: Commune;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'base_cost', type: 'decimal', precision: 10, scale: 0, default: 0, transformer: clpTransformer })
  baseCost: number;

  @Column({ name: 'estimated_days', nullable: true })
  estimatedDays: number;

  @Column({ name: 'additional_config', type: 'json', nullable: true })
  additionalConfig: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
