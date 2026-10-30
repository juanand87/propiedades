import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum OrderHistoryAction {
  CREATED = 'created',
  ITEM_ADDED = 'item_added',
  ITEM_REMOVED = 'item_removed',
  ITEM_UPDATED = 'item_updated',
  STATUS_CHANGED = 'status_changed',
  NOTE_ADDED = 'note_added',
  STOCK_DECREMENTED = 'stock_decremented',
}

@Entity('order_history')
export class OrderHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'longtext', nullable: true })
  changedFields: string;

  @Column({ type: 'longtext', nullable: true })
  previousValues: any;

  @Column({ type: 'longtext', nullable: true })
  newValues: any;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Order, { lazy: false })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
