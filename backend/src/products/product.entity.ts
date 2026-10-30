import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { Category } from '../categories/category.entity';
import { OrderItem } from '../orders/order-item.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';
import { Genre } from '../genres/genre.entity';
import { Format } from '../formats/format.entity';
import { Edition } from '../editions/edition.entity';

export enum ProductType {
  VINYL = 'vinyl',
  CD = 'cd',
  CASSETTE = 'cassette',
  MERCH = 'merchandise',
  EQUIPMENT = 'equipment',
}

export enum ProductCondition {
  NEW = 'new',
  USED = 'used',
}

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRASH = 'trash',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: false })
  descriptionGeneratedByAI: boolean;

  @Column({ type: 'timestamp', nullable: true })
  descriptionGeneratedAt: Date;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({
    type: 'enum',
    enum: ProductType,
    nullable: true,
  })
  type: ProductType;

  @Column({
    type: 'enum',
    enum: ProductCondition,
    default: ProductCondition.NEW,
  })
  condition: ProductCondition;

  // Escala Goldmine (para discos usados)
  @Column({ nullable: true })
  mediaGrade: string; // M, NM, VG+, VG, G+, G, P

  @Column({ nullable: true })
  sleeveGrade: string; // M, NM, VG+, VG, G+, G, P

  // Información musical
  @Column({ nullable: true })
  artist: string;

  @Column({ nullable: true })
  album: string;

  @Column({ nullable: true })
  label: string;

  @Column({ nullable: true })
  year: number;

  @Column({ nullable: true })
  genre: string; // Deprecated - mantener por compatibilidad

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  format: string; // Deprecated - mantener por compatibilidad. TEXT para soportar box sets con formatos largos

  @Column({ nullable: true, length: 10 })
  vinylSize: string; // Para vinilos: "7", "10", "12", "LP"

  @Column({ type: 'text', nullable: true })
  tracklist: string;

  @Column({ nullable: true })
  albumType: string;

  @Column({ nullable: true })
  packageType: string;

  @Column({ type: 'int', nullable: true })
  mediaQuantity: number;

  @Column({ default: false })
  hasBonusTracks: boolean;

  @Column({ nullable: true })
  catalogNumber: string;

  @Column({ nullable: true })
  albumVersion: string;

  @Column({ type: 'int', nullable: true })
  totalDurationMinutes: number;

  @Column({ nullable: true })
  includedAccessories: string;

  @Column({ type: 'text', nullable: true })
  technicalSpecs: string;

  // Información del producto
  @Column({ type: 'decimal', precision: 10, scale: 0, transformer: clpTransformer })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  salePrice: number;

  @Column({ default: false })
  isOnSale: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  wholesalePrice: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'simple-array', nullable: true })
  images: string[];

  @Column({ type: 'json', nullable: true })
  imagesMeta: any;

  // Dimensiones y peso para cálculo de envío
  // Si es NULL, hereda el valor de la categoría
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  weight: number; // Peso en kg

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  height: number; // Alto en cm

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  width: number; // Ancho en cm

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  depth: number; // Profundidad en cm

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  // Estadísticas de producto
  @Column({ default: 0 })
  viewCount: number; // Visitas a la página del producto

  @Column({ default: 0 })
  cartCount: number; // Veces que fue agregado al carrito

  // Integración con Discogs
  @Column({ nullable: true })
  discogsId: string;

  // Integración con Spotify
  @Column({ nullable: true })
  spotifyAlbumId: string;

  @Column({ default: true })
  spotifyEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Vendor, (vendor) => vendor.products)
  vendor: Vendor;

  @ManyToMany(() => Category)
  @JoinTable()
  categories: Category[];

  @ManyToMany(() => Genre, (genre) => genre.products)
  @JoinTable({
    name: 'product_genres',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genreId', referencedColumnName: 'id' },
  })
  genres: Genre[];

  @ManyToMany(() => Format, (format) => format.products)
  @JoinTable({
    name: 'product_formats',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'formatId', referencedColumnName: 'id' },
  })
  formats: Format[];

  @ManyToMany(() => Edition, (edition) => edition.products)
  @JoinTable({
    name: 'product_editions',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'editionId', referencedColumnName: 'id' },
  })
  editions: Edition[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  // WooCommerce Integration
  @Column({ nullable: true })
  woocommerceId: string;

  @Column({ nullable: true })
  mercadoLibreItemId: string;

  @Column({ nullable: true })
  mercadoLibreUserProductId: string;

  @Column({ nullable: true })
  mercadoLibreCategoryId: string;

  @Column({ nullable: true, length: 40 })
  mercadoLibreStatus: string;

  @Column({ type: 'text', nullable: true })
  mercadoLibreStatusDetail: string;

  @Column({ type: 'timestamp', nullable: true })
  mercadoLibreStatusUpdatedAt: Date;

  @Column({ nullable: true })
  parisProductId: string;

  @Column({ nullable: true })
  parisVariantSku: string;

  @Column({ nullable: true })
  falabellaFeedId: string;

  @Column({ type: 'timestamp', nullable: true })
  falabellaSyncedAt: Date;
}
