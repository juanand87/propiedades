import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DiscogsSearchDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  catno?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  per_page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;
}
