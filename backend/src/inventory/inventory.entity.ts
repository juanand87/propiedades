import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { embeddingStorage } from './inventory-rules';

@Entity('inventory_sessions')
export class InventorySession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 36 }) vendorId: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'simple-json' }) scope: {
    categoryId?: string;
    genreId?: number;
    type?: string;
  };
  @Column({ type: 'varchar', length: 20, default: 'counting' }) status: string;
  @Column({ type: 'varchar', length: 36 }) createdBy: string;
  @CreateDateColumn({ type: 'datetime', precision: 6 }) createdAt: Date;
  @Column({ type: 'datetime', nullable: true }) completedAt: Date | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) completedBy:
    | string
    | null;
}

@Entity('inventory_lines')
@Index(['sessionId', 'productId'], { unique: true })
export class InventoryLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 36 }) sessionId: string;
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'int' }) snapshotStock: number;
  @Column({ type: 'datetime', precision: 6 }) snapshotUpdatedAt: Date;
  @Column({ type: 'int', nullable: true }) counted: number | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'boolean', default: false }) selected: boolean;
  @Column({ type: 'int', nullable: true }) appliedStock: number | null;
  @Column({ type: 'varchar', length: 36, nullable: true }) countedBy:
    | string
    | null;
}

@Entity('inventory_found')
export class InventoryFound {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 36 }) sessionId: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) barcode:
    | string
    | null;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'text', nullable: true }) photoUrl: string | null;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) productId:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
}

@Entity('inventory_events')
export class InventoryEvent {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) sessionId: string;
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'varchar', length: 36 }) userId: string;
  @Column({ type: 'int' }) quantity: number;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'varchar', length: 10 }) mode: string;
}

@Entity('inventory_cover_embeddings')
export class InventoryCover {
  @PrimaryColumn({ type: 'varchar', length: 36 }) productId: string;
  @Index() @Column({ type: 'varchar', length: 36 }) vendorId: string;
  @Column({ type: 'char', length: 64 }) sourceHash: string;
  @Column({ type: 'text' }) imageUrl: string;
  @Column({ type: 'varchar', length: 120 }) model: string;
  @Column({ type: 'varchar', length: 20 }) status: string;
  @Column({ type: 'blob', nullable: true, transformer: embeddingStorage })
  vector: number[] | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'datetime', nullable: true }) claimedAt: Date | null;
}

@Entity('inventory_stock_sync')
export class InventoryStockSync {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Index() @Column({ type: 'varchar', length: 36 }) sessionId: string;
  @Column({ type: 'varchar', length: 36 }) productId: string;
  @Column({ type: 'varchar', length: 36 }) vendorId: string;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'datetime', precision: 6, nullable: true })
  claimedAt: Date | null;
}
