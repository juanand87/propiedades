import { IsString, IsOptional, IsBoolean, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PageBlockDTO {
  @IsString()
  id: string;

  @IsString()
  type: 'text' | 'grid' | 'slides' | 'image' | 'video' | 'imageText' | 'component' | 'carousel' | 'imageCarousel';

  @IsOptional()
  @IsNumber()
  row?: number;

  @IsOptional()
  @IsNumber()
  column?: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  gridConfig?: {
    displayMode: 'latest' | 'featured' | 'best-sellers' | 'specific-category';
    categoryId?: string;
    sortBy?: 'newest' | 'most-sold' | 'featured';
    columns: number;
    rows: number | null;
  };

  @IsOptional()
  @IsArray()
  slideIds?: string[];

  @IsOptional()
  @IsString()
  sliderId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @IsString()
  imageLink?: string;

  @IsOptional()
  @IsString()
  imageLinkTarget?: '_self' | '_blank';

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoType?: 'youtube' | 'vimeo' | 'custom';

  @IsOptional()
  @IsString()
  videoThumbnail?: string;

  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  buttonLink?: string;

  @IsOptional()
  @IsString()
  componentName?: string;

  @IsOptional()
  benefitsConfig?: {
    items: Array<{
      icon: 'truck' | 'shield' | 'payment';
      title: string;
      description: string;
    }>;
  };

  @IsOptional()
  carouselConfig?: {
    displayMode?: string;
    categoryId?: string;
    scrollSpeed?: string;
    visibleItems?: number;
    showDots?: boolean;
    autoAdvance?: boolean;
  };

  @IsOptional()
  imageCarouselConfig?: {
    images?: Array<{ url: string; link?: string; alt?: string }>;
    scrollSpeed?: string;
    imageHeight?: number;
    gap?: number;
  };
}

export class CreatePageDTO {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageBlockDTO)
  blocks?: PageBlockDTO[];

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isHomepage?: boolean;

  @IsOptional()
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;
}

export class UpdatePageDTO {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageBlockDTO)
  blocks?: PageBlockDTO[];

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isHomepage?: boolean;

  @IsOptional()
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;
}

export class PageDTO {
  id: string;
  title: string;
  slug: string;
  description?: string;
  blocks: PageBlockDTO[];
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  isHomepage: boolean;
  vendorId: string;
  createdAt: Date;
  updatedAt: Date;
  rowsConfig?: Array<{
    row: number;
    columns: number;
  }>;
}
