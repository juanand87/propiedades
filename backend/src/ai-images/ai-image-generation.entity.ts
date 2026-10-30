import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

export enum AiImageGenerationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('ai_image_generations')
export class AiImageGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  productId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 120 })
  scenario: string;

  @Column({ type: 'varchar', length: 120 })
  style: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  decoration: string | null;

  @Column({ type: 'varchar', length: 40, default: '1024x1024' })
  size: string;

  @Column({ type: 'longtext' })
  prompt: string;

  @Column({ name: 'source_image_url', type: 'text', nullable: true })
  sourceImageUrl: string | null;

  @Column({ name: 'generated_image_url', type: 'longtext', nullable: true })
  generatedImageUrl: string | null;

  @Column({ type: 'enum', enum: AiImageGenerationStatus, default: AiImageGenerationStatus.PENDING })
  status: AiImageGenerationStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'product_snapshot', type: 'json', nullable: true })
  productSnapshot: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}