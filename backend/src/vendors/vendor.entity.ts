import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { VendorSettings } from './vendor-settings.entity';
import { Page } from '../pages/page.entity';
import { Category } from '../categories/category.entity';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  storeName: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  banner: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  paymentEmail: string;

  // Datos privados usados para la facturación de comisiones del marketplace.
  @Column({ name: 'taxpayer_type', type: 'varchar', nullable: true, length: 20, select: false })
  taxpayerType: string | null;

  @Column({ name: 'billing_rut', type: 'varchar', nullable: true, length: 20, select: false })
  billingRut: string | null;

  @Column({ name: 'billing_legal_name', type: 'varchar', nullable: true, length: 255, select: false })
  billingLegalName: string | null;

  @Column({ name: 'billing_business_activity', type: 'varchar', nullable: true, length: 255, select: false })
  billingBusinessActivity: string | null;

  @Column({ name: 'billing_address', type: 'varchar', nullable: true, length: 255, select: false })
  billingAddress: string | null;

  @Column({ name: 'billing_region', type: 'varchar', nullable: true, length: 100, select: false })
  billingRegion: string | null;

  @Column({ name: 'billing_commune', type: 'varchar', nullable: true, length: 100, select: false })
  billingCommune: string | null;

  @Column({ name: 'billing_email', type: 'varchar', nullable: true, length: 255, select: false })
  billingEmail: string | null;

  @Column({ name: 'payku_client_id', nullable: true })
  paykuClientId: string;

  @Column({ name: 'payku_affiliation_token', nullable: true })
  paykuAffiliationToken: string;

  @Column({ name: 'discogs_token', nullable: true })
  discogsToken: string;

  @Column({ name: 'spotify_client_id', nullable: true })
  spotifyClientId: string;

  @Column({ name: 'spotify_client_secret', nullable: true })
  spotifyClientSecret: string;

  @Column({ name: 'spotify_refresh_token', type: 'varchar', nullable: true, length: 1000 })
  spotifyRefreshToken: string | null;

  @Column({ name: 'spotify_user_id', type: 'varchar', nullable: true, length: 255 })
  spotifyUserId: string | null;

  @Column({ name: 'spotify_playlist_id', type: 'varchar', nullable: true, length: 255 })
  spotifyPlaylistId: string | null;

  @Column({ name: 'paykuNotifyUrl', nullable: true, length: 500 })
  paykuNotifyUrl: string;

  @Column({ name: 'paykuReturnUrl', nullable: true, length: 500 })
  paykuReturnUrl: string;

  @Column({ name: 'paykuCancelUrl', nullable: true, length: 500 })
  paykuCancelUrl: string;

  // SMTP Configuration
  @Column({ name: 'smtpHost', nullable: true, length: 255 })
  smtpHost: string;

  @Column({ name: 'smtpPort', nullable: true })
  smtpPort: number;

  @Column({ name: 'smtpSecure', nullable: true, default: false })
  smtpSecure: boolean;

  @Column({ name: 'smtpUser', nullable: true, length: 255 })
  smtpUser: string;

  @Column({ name: 'smtpPassword', nullable: true, length: 255 })
  smtpPassword: string;

  @Column({ name: 'smtpFromEmail', nullable: true, length: 255 })
  smtpFromEmail: string;

  @Column({ name: 'smtpFromName', nullable: true, length: 255 })
  smtpFromName: string;

  // Envia.com Configuration
  @Column({ name: 'envia_enabled', default: false })
  enviaEnabled: boolean;

  @Column({ name: 'envia_origin_name', nullable: true, length: 255 })
  enviaOriginName: string;

  @Column({ name: 'envia_origin_phone', nullable: true, length: 50 })
  enviaOriginPhone: string;

  @Column({ name: 'envia_origin_street', nullable: true, length: 255 })
  enviaOriginStreet: string;

  @Column({ name: 'envia_origin_number', nullable: true, length: 50 })
  enviaOriginNumber: string;

  @Column({ name: 'envia_origin_city', nullable: true, length: 100 })
  enviaOriginCity: string;

  @Column({ name: 'envia_origin_state', nullable: true, length: 10 })
  enviaOriginState: string;

  @Column({ name: 'envia_origin_country', nullable: true, length: 5, default: 'CL' })
  enviaOriginCountry: string;

  @Column({ name: 'envia_origin_postal_code', nullable: true, length: 20 })
  enviaOriginPostalCode: string;

  @Column({ name: 'envia_origin_region_id', type: 'int', nullable: true })
  enviaOriginRegionId: number;

  @Column({ name: 'envia_origin_commune_id', type: 'int', nullable: true })
  enviaOriginCommuneId: number;

  @Column({ name: 'envia_enabled_carriers', type: 'json', nullable: true })
  enviaEnabledCarriers: string[]; // ['chilexpress', 'correoschile']

  @Column({ name: 'envia_carrier_settings', type: 'json', nullable: true })
  enviaCarrierSettings: Record<string, { enabled: boolean; priority: number; markup: number; customLabel?: string }>;

  @Column({ name: 'envia_default_package_type', nullable: true, length: 50, default: 'box' })
  enviaDefaultPackageType: string;

  @Column({ name: 'envia_default_weight_unit', nullable: true, length: 5, default: 'KG' })
  enviaDefaultWeightUnit: string;

  @Column({ name: 'envia_default_length_unit', nullable: true, length: 5, default: 'CM' })
  enviaDefaultLengthUnit: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'rating_count', type: 'int', unsigned: true, default: 0 })
  ratingCount: number;

  @Column({ type: 'json', nullable: true })
  homePageConfig: {
    type: 'grid' | 'blocks';
    pageId?: string;
  };

  @Column({ type: 'text', nullable: true })
  shortDescriptionTemplate: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  customDomain: string | null;

  @Column({ type: 'boolean', default: false })
  customDomainVerified: boolean;

  @Column({ name: 'ai_image_generation_enabled', type: 'boolean', default: false })
  aiImageGenerationEnabled: boolean;

  @Column({ type: 'datetime', nullable: true })
  customDomainVerifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relaciones
  @OneToOne(() => User, (user) => user.vendor)
  @JoinColumn()
  user: User;

  @OneToMany(() => Product, (product) => product.vendor)
  products: Product[];

  @OneToOne(() => VendorSettings, (settings) => settings.vendor)
  settings: VendorSettings;

  @OneToMany(() => Page, (page) => page.vendor)
  pages: Page[];

  // Categorías activas del vendor (relación muchos a muchos)
  @ManyToMany(() => Category)
  @JoinTable({
    name: 'vendor_categories',
    joinColumn: { name: 'vendorId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];
}
