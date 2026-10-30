import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('order_shipments')
export class OrderShipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  // Método de envío
  @Column({ name: 'shipping_method', nullable: true })
  shippingMethod: string;

  @Column({ name: 'shipping_method_code', nullable: true })
  shippingMethodCode: string;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 0, default: 0, transformer: clpTransformer })
  shippingCost: number;

  // Envia.com Integration
  @Column({ name: 'envia_carrier', nullable: true, length: 50 })
  enviaCarrier: string;

  @Column({ name: 'envia_service', nullable: true, length: 100 })
  enviaService: string;

  @Column({ name: 'envia_service_description', nullable: true, length: 255 })
  enviaServiceDescription: string;

  @Column({ name: 'envia_quoted_price', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  enviaQuotedPrice: number;

  @Column({ name: 'envia_final_price', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  enviaFinalPrice: number;

  @Column({ name: 'envia_shipment_id', nullable: true, length: 100 })
  enviaShipmentId: string;

  @Column({ name: 'envia_tracking_number', nullable: true, length: 100 })
  enviaTrackingNumber: string;

  @Column({ name: 'envia_label_url', type: 'text', nullable: true })
  enviaLabelUrl: string;

  @Column({ name: 'envia_tracking_url', type: 'text', nullable: true })
  enviaTrackingUrl: string;

  @Column({ name: 'envia_shipping_status', nullable: true, length: 50 })
  enviaShippingStatus: string;

  @Column({ name: 'envia_label_generated_at', type: 'timestamp', nullable: true })
  enviaLabelGeneratedAt: Date;

  @Column({ name: 'envia_last_tracking_update', type: 'timestamp', nullable: true })
  enviaLastTrackingUpdate: Date;

  // Status general
  @Column({ default: 'pending', length: 50 })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Order, (order) => order.shipments)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
