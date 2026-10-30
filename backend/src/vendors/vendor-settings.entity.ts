import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

@Entity('vendor_settings')
export class VendorSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  vendorId: string;

  // Discogs Integration
  @Column({ nullable: true })
  discogsApiKey: string;

  @Column({ nullable: true })
  discogsApiSecret: string;

  // General Settings
  @Column({ nullable: true })
  marketplaceUrl: string;

  @Column({ nullable: true })
  customDomain: string;

  @Column({ nullable: true })
  companyLegalName: string;

  @Column({ nullable: true })
  taxId: string;

  @Column({ nullable: true })
  companyAddress: string;

  // Business settings
  @Column({ default: false })
  isWholesaleEnabled: boolean;

  @Column({ default: false })
  publishInMarketplace: boolean;

  // Commission settings (managed by marketplace admin) - nullable for backward compatibility
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 10.00 })
  commissionPercentage: number; // % de comisión para ventas normales

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 5.00 })
  wholesaleCommissionPercentage: number; // % de comisión para ventas mayoristas

  @Column({ name: 'assisted_commission_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true, default: 10.00 })
  assistedCommissionPercentage: number; // % de comisión para ventas asistidas

  @Column({ name: 'assisted_commission_type', type: 'varchar', length: 16, default: 'percentage' })
  assistedCommissionType: 'percentage' | 'fixed';

  @Column({ name: 'assisted_commission_fixed_amount', type: 'decimal', precision: 10, scale: 0, default: 0 })
  assistedCommissionFixedAmount: number;

  @Column({ nullable: true, default: true })
  isWholesaleEnabledByAdmin: boolean; // Si el admin permite modo mayorista a este vendor

  // Design settings
  @Column({ type: 'int', default: 1 })
  headerType: number; // 1, 2, or 3

  @Column({ type: 'json', nullable: true })
  headerConfig: any; // { logo, socialLinks, topBar, searchEnabled, etc }

  @Column({ type: 'json', nullable: true })
  topBarPhrases: any; // { phrases: string[], enableRotating: boolean, rotationSpeed: number, scrollSpeed: number }

  @Column({ type: 'json', nullable: true })
  slides: any; // [{ type: 'image'|'video', url, title, description, link, order }]

  // Hero Slider Configuration (estilo MercadoLibre)
  @Column({ type: 'json', nullable: true })
  heroSliderConfig: any; // { enabled, sliderId, overlayCards: { enabled, items: [{ icon, title, description, linkType, linkUrl }] }, autoplay, interval }

  @Column({ type: 'int', default: 4 })
  productGridColumns: number; // 1-5

  @Column({ type: 'json', nullable: true })
  colors: any; // { primary, secondary, accent, background }

  @Column({ nullable: true, default: 'default' })
  colorTheme: string; // Theme ID: 'default', 'forest', 'sunset', 'ocean', etc.

  @Column({ type: 'json', nullable: true })
  customColors: any; // Override colors: { primary, secondary, accent, bgSite, bgPage }

  @Column({ type: 'json', nullable: true })
  footerConfig: any; // { enabled, rows: [{ id, enabled, columns, items: [{ type, title, content, imageUrl, linkUrl, videoUrl, mapEmbed }] }] }

  @Column({ type: 'json', nullable: true })
  menuConfig: any; // { mainMenu: [], lateralMenu: [] }

  // Product Description Templates
  @Column({ type: 'text', nullable: true })
  shortDescriptionTemplate: string;

  @Column({ type: 'text', nullable: true })
  technicalSpecsTemplate: string;

  @Column({ type: 'text', nullable: true })
  descriptionTemplate: string;

  // Gemini AI Integration
  @Column({ nullable: true })
  geminiApiKey: string;

  @Column({ type: 'text', nullable: true })
  geminiPrompt: string;

  @Column({ default: false })
  geminiEnabled: boolean;

  // Product Page Configuration
  @Column({ type: 'json', nullable: true })
  productPageSections: any; // Legacy field

  @Column({ type: 'json', nullable: true })
  productPageLayout: any; // { left: [], rightTop: [], bottom: [] } - Legacy multi-area

  @Column({ type: 'json', nullable: true })
  productPageRightColumnOrder: any; // Simplified: [{ id, name, enabled, order }]

  @Column({ type: 'json', nullable: true })
  productPageTabsOrder: any; // Tabs order: [{ id, name, enabled, order }]

  @Column({ type: 'json', nullable: true })
  productInfoBar: any; // Info bar config: { enabled: boolean, leftFields: string[], rightFields: string[] }

  // Product Grid Category Display Configuration
  @Column({ type: 'json', nullable: true })
  productGridCategoryDisplay: any; // { mode: 'none'|'icon'|'name', position: 'top-left'|'top-right'|'bottom-left'|'bottom-right' }

  // Spotify Integration
  @Column({ default: false })
  spotifyEnabled: boolean;

  @Column({ nullable: true })
  spotifyClientId: string;

  @Column({ nullable: true })
  spotifyClientSecret: string;

  // Policies (JSON)
  @Column({ type: 'json', nullable: true })
  policies: any;

  // Notifications (JSON)
  @Column({ type: 'json', nullable: true })
  emailSettings: any;

  @Column({ type: 'json', nullable: true })
  notificationSettings: any;

  // Other settings
  @Column({ type: 'json', nullable: true })
  shippingSettings: any;

  // Grid Configuration
  @Column({ type: 'json', nullable: true })
  gridConfig: any; // [{ type: 'homepage'|'category', columns, rows, displayMode, categoryId, sortBy, isActive, order }]

  // Menus Configuration
  @Column({ type: 'json', nullable: true })
  menus: any; // { principal: [], secundario: [], lateral: { enabled, position, items }, footer: [] }

  // Custom Menus Configuration (new structure)
  @Column({ type: 'json', nullable: true })
  customMenus: any; // { principal: { items: [] }, secundario: { items: [] }, lateral: { items: [] }, footer: { items: [] }, custom: [{id, name, isFixed, items}] }

  // Filters Configuration
  @Column({ type: 'json', nullable: true })
  filters: any; // { enabled, position, showInCatalog, showInProductDetail, showInGenrePages, showInFormatPages, categories: { mode, selected } }

  // Banners Configuration
  @Column({ type: 'json', nullable: true })
  banners: any; // [{ id, name, type: 'grid'|'image'|'title', position: 'top'|'middle'|'bottom', order, isActive, config, visibility }]

  // Product Image Settings
  @Column({ default: false })
  imageRolloverEnabled: boolean; // Enable hover effect to show second image

  // Payku Integration (Vendor affiliation)
  @Column({ nullable: true })
  paykuIdentifier: string; // Identificador de afiliación de Payku

  @Column({ nullable: true })
  paykuPublicToken: string; // Token público de afiliación de Payku

  // WooCommerce Integration
  @Column({ nullable: true })
  wooClientKey: string;

  @Column({ nullable: true })
  wooClientSecret: string;

  @Column({ nullable: true })
  wooStoreUrl: string;

  @Column({ length: 500, nullable: true })
  wooStoreIdentity: string;

  @Column({ nullable: true })
  wooWebhookSecret: string;

  // WooCommerce Sync Settings
  @Column({ default: false })
  wooAutoSync: boolean;

  @Column({ type: 'json', nullable: true })
  wooCategoryMapping: Record<string, string>; // { mundobeatCategoryId: woocommerceCategoryId }

  // Mercado Libre Integration. Application credentials live in environment variables;
  // tokens below belong to the individual vendor account.
  @Column({ nullable: true })
  mercadoLibreUserId: string;

  @Column({ type: 'text', nullable: true })
  mercadoLibreAccessToken: string;

  @Column({ type: 'text', nullable: true })
  mercadoLibreRefreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  mercadoLibreTokenExpiresAt: Date;

  @Column({ nullable: true, default: 'MLC' })
  mercadoLibreSiteId: string;

  @Column({ type: 'varchar', nullable: true })
  mercadoLibreOAuthState: string | null;

  @Column({ type: 'json', nullable: true })
  mercadoLibreConfig: any;

  // Falabella Seller Center Integration. Each vendor manages its own credentials.
  @Column({ nullable: true })
  falabellaUserId: string;

  @Column({ type: 'text', nullable: true })
  falabellaApiKey: string;

  @Column({ nullable: true, default: 'cl' })
  falabellaCountry: string;

  @Column({ type: 'json', nullable: true })
  falabellaConfig: any;

  // Marketplace Paris / Cencosud Integration. Each vendor manages its own API key.
  @Column({ type: 'text', nullable: true })
  parisApiKey: string;

  @Column({ type: 'char', length: 64, nullable: true })
  parisConnectionKey: string;

  @Column({ type: 'json', nullable: true })
  parisConfig: any;

  // Onboarding
  @Column({ default: false })
  onboardingCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relación inversa
  @OneToOne(() => Vendor, (vendor) => vendor.settings)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;
}
