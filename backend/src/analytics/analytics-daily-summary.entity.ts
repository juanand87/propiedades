import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('analytics_daily_summary')
@Index(['vendorId', 'summaryDate'])
@Unique(['vendorId', 'summaryDate'])
export class AnalyticsDailySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ name: 'summary_date', type: 'date' })
  summaryDate: Date;

  // Totales del día
  @Column({ name: 'total_sessions', type: 'int', default: 0 })
  totalSessions: number;

  @Column({ name: 'total_page_views', type: 'int', default: 0 })
  totalPageViews: number;

  @Column({ name: 'new_visitors', type: 'int', default: 0 })
  newVisitors: number;

  @Column({ name: 'returning_visitors', type: 'int', default: 0 })
  returningVisitors: number;

  @Column({ name: 'total_bounces', type: 'int', default: 0 })
  totalBounces: number;

  @Column({ name: 'bounce_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  bounceRate: number;

  // Duración promedio
  @Column({ name: 'avg_session_duration_seconds', type: 'int', default: 0 })
  avgSessionDurationSeconds: number;

  @Column({ name: 'avg_pages_per_session', type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgPagesPerSession: number;

  // Origen del tráfico (JSON)
  @Column({ name: 'traffic_sources', type: 'json', nullable: true })
  trafficSources: Record<string, number> | null;

  // Dispositivos (JSON)
  @Column({ name: 'device_breakdown', type: 'json', nullable: true })
  deviceBreakdown: Record<string, number> | null;

  // Navegadores (JSON)
  @Column({ name: 'browser_breakdown', type: 'json', nullable: true })
  browserBreakdown: Record<string, number> | null;

  // Regiones (JSON)
  @Column({ name: 'region_breakdown', type: 'json', nullable: true })
  regionBreakdown: Record<string, number> | null;

  // Conversión
  @Column({ name: 'total_items_added_to_cart', type: 'int', default: 0 })
  totalItemsAddedToCart: number;

  @Column({ name: 'total_purchases', type: 'int', default: 0 })
  totalPurchases: number;

  @Column({ name: 'total_revenue', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer })
  totalRevenue: number;

  @Column({ name: 'conversion_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  conversionRate: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
