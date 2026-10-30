import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('vendor_applications')
export class VendorApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Personal/company info
  @Column()
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column()
  rut: string;

  @Column({ name: 'taxpayer_type', nullable: true, length: 20 })
  taxpayerType: string;

  @Column({ name: 'legal_name', nullable: true, length: 255 })
  legalName: string;

  @Column({ nullable: true })
  storeName: string;

  @Column({ type: 'text', nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  cityCode: string;

  @Column({ type: 'int', nullable: true })
  cityId: number;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  regionCode: string;

  @Column({ nullable: true, length: 20 })
  postalCode: string;

  @Column({ type: 'int', nullable: true })
  regionId: number;

  // Catalog info
  @Column({ type: 'text', nullable: true })
  catalogDescription: string;

  @Column({ nullable: true })
  estimatedProducts: string;

  @Column({ nullable: true })
  mainFormats: string; // "vinilos, cds, cassettes"

  // Bank info
  @Column({ nullable: true })
  bankName: string;

  @Column({ nullable: true })
  bankAccountType: string;

  @Column({ nullable: true })
  bankAccountNumber: string;

  // Extra
  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  @Column({ nullable: true })
  adminNotes: string;

  @Column({ nullable: true })
  reviewedByEmail: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
