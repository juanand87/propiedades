import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  rut: string;

  // Authentication fields
  @Column({ nullable: true, select: false })
  password: string; // NULL for guests and OAuth users

  @Column({ nullable: true, unique: true })
  googleId: string; // Google OAuth ID

  // Saved address for registered customers
  @Column({ type: 'json', nullable: true })
  savedAddress: {
    address: string;
    commune: string;
    communeId?: number;
    region: string;
    regionId?: number;
    phone: string;
    rut: string;
  } | null;

  // Guest conversion tracking
  @Column({ type: 'boolean', default: false })
  convertedFromGuest: boolean;

  @Column({ type: 'timestamp', nullable: true })
  convertedAt: Date;

  // Estadísticas
  @Column({ name: 'total_orders', type: 'int', default: 0 })
  totalOrders: number;

  @Column({ name: 'total_spent', type: 'decimal', precision: 10, scale: 0, default: 0, transformer: clpTransformer })
  totalSpent: number;

  @Column({ name: 'first_order_at', type: 'timestamp', nullable: true })
  firstOrderAt: Date;

  @Column({ name: 'last_order_at', type: 'timestamp', nullable: true })
  lastOrderAt: Date;

  // Marketing/Preferencias
  @Column({ name: 'accepts_marketing', type: 'boolean', default: true })
  acceptsMarketing: boolean;

  @Column({ name: 'accepts_notifications', type: 'boolean', default: true })
  acceptsNotifications: boolean;

  // Segmentación
  @Column({ type: 'varchar', length: 20, default: 'new' })
  segment: string; // 'new', 'regular', 'vip', 'inactive'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relación con órdenes
  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];
}
