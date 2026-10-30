import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pos_registers')
@Index(['vendorId', 'code'], { unique: true })
export class PosRegister {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'vendor_id', type: 'varchar', length: 36 }) vendorId: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 50 }) code: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
