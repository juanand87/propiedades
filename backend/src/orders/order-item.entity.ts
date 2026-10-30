import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../products/product.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  productId: string | null;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  vendorId: string | null;

  @Column()
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, transformer: clpTransformer })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, transformer: clpTransformer })
  subtotal: number;

  @Column({ nullable: true })
  productTitle: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productImage: string;

  // Relaciones
  @ManyToOne(() => Order, (order) => order.items)
  order: Order;

  @ManyToOne(() => Product, (product) => product.orderItems, { nullable: true, onDelete: 'SET NULL' })
  product: Product;
}
