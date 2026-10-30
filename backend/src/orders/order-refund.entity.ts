import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('order_refunds')
export class OrderRefund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @OneToOne(() => Order, (order) => order.refund, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'decimal', precision: 14, scale: 0, transformer: clpTransformer })
  amount: number;

  @Index()
  @Column({ type: 'varchar', length: 40, default: 'pending_submission' })
  status: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  paykuStatus: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paykuTransactionId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  paykuRefundId: string | null;

  @Column({ type: 'longtext', nullable: true })
  paykuResponse: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  notificationsSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
