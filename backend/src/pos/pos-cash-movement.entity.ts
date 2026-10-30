import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('pos_cash_movements')
@Index(['shiftId', 'createdAt'])
export class PosCashMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'vendor_id', type: 'varchar', length: 36 }) vendorId: string;
  @Column({ name: 'shift_id', type: 'varchar', length: 36 }) shiftId: string;
  @Column({ name: 'staff_id', type: 'varchar', length: 36 }) staffId: string;
  @Column({ type: 'varchar', length: 20 }) type: 'income' | 'withdrawal';
  @Column({ type: 'decimal', precision: 12, scale: 0, transformer: clpTransformer }) amount: number;
  @Column({ type: 'varchar', length: 255 }) reason: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
