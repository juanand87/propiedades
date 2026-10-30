import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mercadolibre_order_syncs')
@Index(['vendorId', 'mercadoLibreOrderId'], { unique: true })
export class MercadoLibreOrderSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vendorId: string;

  @Column({ type: 'varchar', length: 64 })
  mercadoLibreOrderId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null;

  @Column({ type: 'boolean', default: false })
  stockApplied: boolean;

  @Column({ type: 'boolean', default: false })
  stockRestored: boolean;

  @Column({ type: 'json', nullable: true })
  orderData: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
