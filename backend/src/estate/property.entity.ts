import { Column, Entity, PrimaryColumn } from 'typeorm';

// Explicit active metadata; legacy commerce entities are never registered.
@Entity('properties')
export class Property {
  @PrimaryColumn({ length: 36 }) id: string;
  @Column({ length: 36 }) advertiser_id: string;
  @Column({ length: 36 }) created_by: string;
  @Column({ length: 20 }) code: string;
  @Column({ length: 220 }) slug: string;
  @Column({ length: 180 }) title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'varchar', length: 400, nullable: true }) summary:
    | string
    | null;
  @Column({ length: 30 }) type_id: string;
  @Column({ length: 10 }) operation_type: string;
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  price_amount: string | null;
  @Column({ length: 3 }) price_unit: string;
  @Column({ type: 'int', nullable: true }) region_id: number | null;
  @Column({ type: 'int', nullable: true }) commune_id: number | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) neighborhood:
    | string
    | null;
  @Column({ length: 25 }) publication_status: string;
  @Column({ length: 20 }) availability: string;
}
