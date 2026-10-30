import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsArray, IsBoolean, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductType, ProductCondition, ProductStatus } from '../product.entity';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  tracklist?: string;

  @IsNumber()
  @IsOptional()
  mediaQuantity?: number;

  @IsString()
  @IsOptional()
  technicalSpecs?: string;

  @IsOptional()
  type?: ProductType;

  @IsEnum(ProductCondition)
  @IsOptional()
  condition?: ProductCondition;

  @IsString()
  @IsOptional()
  mediaGrade?: string;

  @IsString()
  @IsOptional()
  sleeveGrade?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsString()
  @IsOptional()
  vinylSize?: string; // "7", "10", "12", "LP" para vinilos

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  @Transform(({ value }) => Math.round(value))
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Math.round(value) : value)
  salePrice?: number;

  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Math.round(value) : value)
  wholesalePrice?: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  stock: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsOptional()
  imagesMeta?: any[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsString()
  @IsOptional()
  discogsId?: string;

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsString()
  @IsOptional()
  spotifyAlbumId?: string;

  @IsBoolean()
  @IsOptional()
  spotifyEnabled?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  descriptionGeneratedByAI?: boolean;

  @IsOptional()
  descriptionGeneratedAt?: Date;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  tracklist?: string;

  @IsString()
  @IsOptional()
  technicalSpecs?: string;

  @IsEnum(ProductType)
  @IsOptional()
  type?: ProductType;

  @IsEnum(ProductCondition)
  @IsOptional()
  condition?: ProductCondition;

  @IsString()
  @IsOptional()
  mediaGrade?: string;

  @IsString()
  @IsOptional()
  sleeveGrade?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsString()
  @IsOptional()
  vinylSize?: string; // "7", "10", "12", "LP" para vinilos

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Math.round(value) : value)
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Math.round(value) : value)
  salePrice?: number;

  @IsBoolean()
  @IsOptional()
  isOnSale?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => value ? Math.round(value) : value)
  wholesalePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsOptional()
  imagesMeta?: any[];

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsString()
  @IsOptional()
  discogsId?: string;

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsString()
  @IsOptional()
  spotifyAlbumId?: string;

  @IsBoolean()
  @IsOptional()
  spotifyEnabled?: boolean;
}
