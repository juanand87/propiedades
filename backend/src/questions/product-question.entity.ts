import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductQuestionMessage } from './product-question-message.entity';

@Entity('product_questions')
export class ProductQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'varchar', length: 36, nullable: true })
  customerId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: User | null;

  @Column({ type: 'varchar', length: 20, default: 'mundobeat' })
  source: 'mundobeat' | 'mercadolibre';

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  externalQuestionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalBuyerId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  externalStatus: string | null;

  @Column({ type: 'enum', enum: ['pending', 'answered'], default: 'pending' })
  status: 'pending' | 'answered';

  @Column({
    type: 'enum',
    enum: ['awaiting_response', 'pending_review', 'reviewed', 'penalized', 'annulled'],
    default: 'awaiting_response',
  })
  reviewStatus: 'awaiting_response' | 'pending_review' | 'reviewed' | 'penalized' | 'annulled';

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @OneToMany(() => ProductQuestionMessage, (message) => message.question)
  messages: ProductQuestionMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
