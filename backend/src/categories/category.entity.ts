import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  format: string;

  @Column({ default: true })
  usesMusicMetadata: boolean;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Dimensiones para envío (heredadas por productos)
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  weight: number; // Peso en kilogramos

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  height: number; // Alto en centímetros

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  width: number; // Ancho en centímetros

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  depth: number; // Profundidad en centímetros

  // Categoría padre para sub-categorías
  @Column({ nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
