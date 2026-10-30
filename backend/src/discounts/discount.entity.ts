import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('discount_codes')
export class DiscountCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ length: 60 }) code: string;
  @Column({ length: 150 }) name: string;
  @Column({ type: 'varchar', nullable: true, length: 36 }) vendorId: string | null;
  @Column({ type: 'int' }) percentage: number;
  @Column({ type: 'simple-json' }) categoryIds: string[];
  @Column({ type: 'simple-json' }) genreIds: string[];
  @Column({ type: 'simple-json' }) productIds: string[];
  @Column({ type: 'int', default: 0 }) minPurchase: number;
  @Column({ type: 'int', nullable: true }) maxDiscount: number | null;
  @Column({ type: 'int', default: 100 }) maxUses: number;
  @Column({ type: 'datetime' }) startsAt: Date;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ length: 20, default: 'active' }) status: string;
  @Column({ type: 'varchar', nullable: true, length: 255 }) customerEmail: string | null;
  @Index({ unique: true }) @Column({ type: 'varchar', nullable: true, length: 36 }) reviewId:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) resolution: string | null;
  @Column({ type: 'int', nullable: true }) originalRating: number | null;
  @Column({ type: 'text', nullable: true }) originalComment: string | null;
  @Column({ type: 'datetime', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) emailSentAt: Date | null;
  @Column({ type: 'datetime', nullable: true }) reviewUpdatedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('discount_uses')
@Index(['discountId', 'customerEmail'], { unique: true })
export class DiscountUse {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 36 }) discountId: string;
  @Index({ unique: true }) @Column({ length: 36 }) orderId: string;
  @Column({ length: 255 }) customerEmail: string;
  @Column({ type: 'int' }) amount: number;
  @CreateDateColumn() createdAt: Date;
}
