import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { clpTransformer } from '../common/transformers/clp.transformer';

export enum VendorInvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  VOIDED = 'voided',
}

export interface InvoiceOrderSnapshot {
  id: string;
  orderNumber: string;
  createdAt: string;
  commission: number;
}

export interface BillingSnapshot {
  taxpayerType: string | null;
  rut: string | null;
  legalName: string | null;
  businessActivity: string | null;
  address: string | null;
  region: string | null;
  commune: string | null;
  email: string | null;
}

@Index(['vendorId', 'periodStart', 'periodEnd'])
@Entity('vendor_invoices')
export class VendorInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 40, nullable: true, unique: true })
  invoiceNumber: string | null;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ type: 'varchar', length: 20, default: VendorInvoiceStatus.DRAFT })
  status: VendorInvoiceStatus;

  @Column({ name: 'order_count', type: 'int', default: 0 })
  orderCount: number;

  @Column({ name: 'commission_total', type: 'decimal', precision: 12, scale: 0, transformer: clpTransformer })
  commissionTotal: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 0, default: 0, transformer: clpTransformer })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 0, transformer: clpTransformer })
  totalAmount: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, default: 'compensated' })
  paymentMethod: string;

  @Column({ name: 'billing_snapshot', type: 'json', nullable: true })
  billingSnapshot: BillingSnapshot | null;

  @Column({ name: 'order_details', type: 'json', nullable: true })
  orderDetails: InvoiceOrderSnapshot[] | null;

  @Column({ name: 'issued_at', type: 'datetime', nullable: true })
  issuedAt: Date | null;

  @Column({ name: 'voided_at', type: 'datetime', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @Column({ name: 'created_by_id', type: 'varchar', length: 36, nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
