import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vendor_reviews')
@Index(['orderId', 'vendorId'], { unique: true })
export class VendorReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  orderId: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ name: 'order_number', type: 'varchar', length: 100 })
  orderNumber: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'submitted' | 'expired';

  @Column({ name: 'email_count', type: 'tinyint', unsigned: true, default: 0 })
  emailCount: number;

  @Column({ name: 'first_email_sent_at', type: 'datetime', nullable: true })
  firstEmailSentAt: Date | null;

  @Column({ name: 'last_email_sent_at', type: 'datetime', nullable: true })
  lastEmailSentAt: Date | null;

  @Column({ name: 'last_email_attempt_at', type: 'datetime', nullable: true })
  lastEmailAttemptAt: Date | null;

  @Column({ name: 'last_email_error', type: 'text', nullable: true })
  lastEmailError: string | null;

  @Column({ name: 'next_email_at', type: 'datetime', nullable: true })
  nextEmailAt: Date | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'editable_until', type: 'datetime', nullable: true })
  editableUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
