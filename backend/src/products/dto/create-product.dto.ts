import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsArray, Min, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProductType, ProductCondition } from '../product.entity';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  descriptionGeneratedByAI?: boolean;

  @IsOptional()
  type?: ProductType;

  @IsOptional()
  @IsEnum(ProductCondition)
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
  tracklist?: string;

  @IsNumber()
  @IsOptional()
  mediaQuantity?: number;

  @IsString()
  @IsOptional()
  technicalSpecs?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @IsOptional()
  isOnSale?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  spotifyAlbumId?: string;

  @IsBoolean()
  @IsOptional()
  spotifyEnabled?: boolean;
}
