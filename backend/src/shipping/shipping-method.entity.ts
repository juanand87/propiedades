import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('shipping_methods')
@Index(['code'], { unique: true })
export class ShippingMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'logo_url', length: 255, nullable: true })
  logoUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  config: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
