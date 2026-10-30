import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { Region } from './region.entity';

@Entity('communes')
@Index(['regionId', 'name'], { unique: true })
export class Commune {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'region_id' })
  regionId: number;

  @ManyToOne(() => Region, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 10, nullable: true })
  code: string;

  @Column({ name: 'envia_postal_code', length: 10, nullable: true })
  enviaPostalCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
