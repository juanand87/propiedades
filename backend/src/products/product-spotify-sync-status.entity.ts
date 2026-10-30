import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export type SpotifySyncStatusType = 'discarded' | 'deleted';

@Entity('product_spotify_sync_status')
@Unique(['productId', 'vendorId'])
export class ProductSpotifySyncStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'product_id', type: 'varchar', length: 255 })
  productId: string;

  @Index()
  @Column({ name: 'vendor_id', type: 'varchar', length: 255 })
  vendorId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['discarded', 'deleted'],
  })
  status: SpotifySyncStatusType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
