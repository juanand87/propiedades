import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('falabella_order_syncs')
@Index(['vendorId', 'falabellaOrderId'], { unique: true })
export class FalabellaOrderSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ type: 'varchar', length: 100 })
  falabellaOrderId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null;

  @Column({ type: 'boolean', default: false })
  stockApplied: boolean;

  @Column({ type: 'boolean', default: false })
  stockRestored: boolean;

  @Column({ type: 'json', nullable: true })
  orderData: any;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
