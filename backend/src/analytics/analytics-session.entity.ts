import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Product } from '../products/product.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('analytics_sessions')
@Index(['vendorId', 'createdAt'])
@Index(['vendorId', 'source'])
@Index(['vendorId', 'region'])
@Index(['vendorId', 'deviceType'])
export class AnalyticsSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ name: 'session_id', type: 'varchar', length: 100 })
  sessionId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  // Origen del tráfico
  @Column({ name: 'source', type: 'varchar', length: 50, nullable: true })
  source: string | null; // 'google', 'direct', 'social', 'referral', 'other'

  @Column({ name: 'utm_source', type: 'varchar', length: 100, nullable: true })
  utmSource: string | null;

  @Column({ name: 'utm_medium', type: 'varchar', length: 100, nullable: true })
  utmMedium: string | null;

  @Column({ name: 'utm_campaign', type: 'varchar', length: 100, nullable: true })
  utmCampaign: string | null;

  @Column({ name: 'referrer', type: 'varchar', length: 500, nullable: true })
  referrer: string | null;

  // Ubicación
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'country', type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  // Dispositivo
  @Column({ name: 'device_type', type: 'varchar', length: 20, nullable: true })
  deviceType: string | null; // 'mobile', 'desktop', 'tablet'

  @Column({ name: 'browser', type: 'varchar', length: 100, nullable: true })
  browser: string | null;

  @Column({ name: 'browser_version', type: 'varchar', length: 50, nullable: true })
  browserVersion: string | null;

  @Column({ name: 'os', type: 'varchar', length: 100, nullable: true })
  os: string | null;

  @Column({ name: 'os_version', type: 'varchar', length: 50, nullable: true })
  osVersion: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  // Comportamiento
  @Column({ name: 'is_new_user', type: 'boolean', default: true })
  isNewUser: boolean;

  @Column({ name: 'page_path', type: 'varchar', length: 500, nullable: true })
  pagePath: string | null;

  @Column({ name: 'product_id', type: 'varchar', length: 36, nullable: true })
  productId: string | null;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'page_views', type: 'int', default: 1 })
  pageViews: number;

  @Column({ name: 'bounce_event', type: 'boolean', default: false })
  bounceEvent: boolean;

  // Conversión
  @Column({ name: 'items_added_to_cart', type: 'int', default: 0 })
  itemsAddedToCart: number;

  @Column({ name: 'purchase_completed', type: 'boolean', default: false })
  purchaseCompleted: boolean;

  @Column({ name: 'purchase_value', type: 'decimal', precision: 12, scale: 0, nullable: true, transformer: clpTransformer })
  purchaseValue: number | null;

  @Column({ name: 'order_id', type: 'varchar', length: 36, nullable: true })
  orderId: string | null;

  // Metadata
  @Column({ name: 'tags', type: 'json', nullable: true })
  tags: Record<string, any> | null;

  @Column({ name: 'custom_data', type: 'json', nullable: true })
  customData: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;
}
