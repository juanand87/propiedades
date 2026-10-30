import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PosStaffRole = 'cashier' | 'supervisor';

@Entity('pos_staff')
@Index(['vendorId', 'username'], { unique: true })
export class PosStaff {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'vendor_id', type: 'varchar', length: 36 }) vendorId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 80 }) username: string;
  @Column({ name: 'pin_hash', type: 'varchar', length: 255, select: false }) pinHash: string;
  @Column({ type: 'varchar', length: 20, default: 'cashier' }) role: PosStaffRole;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
