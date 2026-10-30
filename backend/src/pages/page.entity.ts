import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vendor } from '../vendors/vendor.entity';

export interface PageBlock {
  id: string;
  type: 'text' | 'grid' | 'slides' | 'image' | 'video' | 'imageText' | 'component' | 'carousel' | 'imageCarousel';
  columns?: number; // 1-4
  row?: number;
  column?: number;
  // Text block
  text?: string;
  // Grid block
  gridConfig?: {
    displayMode: 'latest' | 'featured' | 'best-sellers' | 'specific-category';
    categoryId?: string;
    sortBy?: 'newest' | 'most-sold' | 'featured';
    columns: number;
    rows: number | null;
  };
  // Slides block
  slideIds?: string[];
  sliderId?: string;
  // Image block
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageLinkTarget?: '_self' | '_blank';
  // Video block
  videoUrl?: string;
  videoType?: 'youtube' | 'vimeo' | 'custom';
  videoThumbnail?: string;
  // ImageText block
  backgroundImage?: string;
  title?: string;
  buttonText?: string;
  buttonLink?: string;
  // Component block
  componentName?: string;
  benefitsConfig?: {
    items: Array<{
      icon: 'truck' | 'shield' | 'payment';
      title: string;
      description: string;
    }>;
  };
  // Carousel (products) block
  carouselConfig?: {
    displayMode?: string;
    categoryId?: string;
    scrollSpeed?: string;
    visibleItems?: number;
    showDots?: boolean;
    autoAdvance?: boolean;
  };
  // Image Carousel block
  imageCarouselConfig?: {
    images?: Array<{ url: string; link?: string; alt?: string }>;
    scrollSpeed?: string;
    imageHeight?: number;
    gap?: number;
  };
}

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  blocks: PageBlock[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle?: string;

  @Column({ type: 'text', nullable: true })
  metaDescription?: string;

  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @Column({ type: 'boolean', default: false })
  isHomepage: boolean;

  @Column({ type: 'json', nullable: true })
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;

  @ManyToOne(() => Vendor, (vendor) => vendor.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'uuid' })
  vendorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
