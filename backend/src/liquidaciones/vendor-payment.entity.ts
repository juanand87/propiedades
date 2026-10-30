import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { clpTransformer } from '../common/transformers/clp.transformer';

@Entity('vendor_payments')
export class VendorPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendorEmail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendorStoreName: string | null;

  @Column({ type: 'varchar', length: 255 })
  numeroTransferencia: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comprobante: string | null; // URL del archivo subido

  @Column({ type: 'text', nullable: true })
  comprobanteNota: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 0, transformer: clpTransformer })
  valorDepositado: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, transformer: clpTransformer })
  valorEsperado: number;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'confirmed' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ name: 'fecha_pago', type: 'datetime', nullable: true })
  fechaPago: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
