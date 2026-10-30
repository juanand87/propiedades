import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EmailTemplateCategory {
  SYSTEM = 'system',
  ORDERS_MARKETPLACE = 'orders_marketplace',
  ORDERS_VENDOR = 'orders_vendor',
  PRODUCTS = 'products',
  BASE = 'base',
}

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: EmailTemplateCategory,
  })
  category: EmailTemplateCategory;

  @Column({ type: 'varchar', length: 50, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  variables: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
