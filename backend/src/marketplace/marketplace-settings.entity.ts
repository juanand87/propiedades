import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('marketplace_settings')
export class MarketplaceSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'setting_key', unique: true })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text', nullable: true })
  settingValue: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
