import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('pos_shifts')
@Index(['vendorId', 'status'])
export class PosShift {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'vendor_id', type: 'varchar', length: 36 }) vendorId: string;
  @Column({ name: 'register_id', type: 'varchar', length: 36 }) registerId: string;
  @Column({ name: 'staff_id', type: 'varchar', length: 36 }) staffId: string;
  @Column({ type: 'varchar', length: 20, default: 'open' }) status: 'open' | 'closed';
  @Column({ name: 'opening_cash', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer }) openingCash: number;
  @Column({ name: 'expected_cash', type: 'decimal', precision: 12, scale: 0, nullable: true, transformer: clpTransformer }) expectedCash: number | null;
  @Column({ name: 'counted_cash', type: 'decimal', precision: 12, scale: 0, nullable: true, transformer: clpTransformer }) countedCash: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 0, nullable: true, transformer: clpTransformer }) difference: number | null;
  @Column({ name: 'cash_sales', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer }) cashSales: number;
  @Column({ name: 'debit_sales', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer }) debitSales: number;
  @Column({ name: 'credit_sales', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer }) creditSales: number;
  @Column({ name: 'transfer_sales', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer }) transferSales: number;
  @Column({ name: 'closing_note', type: 'text', nullable: true }) closingNote: string | null;
  @Column({ name: 'opened_at', type: 'datetime' }) openedAt: Date;
  @Column({ name: 'closed_at', type: 'datetime', nullable: true }) closedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
