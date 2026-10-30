import { IsArray, IsString, IsNumber, IsBoolean, IsEnum, IsOptional } from 'class-validator';

enum GridType {
  HOMEPAGE = 'homepage',
  CATEGORY = 'category',
}

enum DisplayMode {
  SPECIFIC_CATEGORY = 'specific-category',
  LATEST = 'latest',
  FEATURED = 'featured',
  BEST_SELLERS = 'best-sellers',
}

enum SortBy {
  NEWEST = 'newest',
  MOST_SOLD = 'most-sold',
  FEATURED = 'featured',
}

export class UpdateGridConfigDto {
  @IsArray()
  gridConfig: {
    id?: string;
    type: GridType;
    columns: number;
    rows: number | null;
    displayMode: DisplayMode;
    categoryId?: string;
    sortBy?: SortBy;
    isActive: boolean;
    order: number;
  }[];
}

export class CreateGridDto {
  @IsEnum(GridType)
  type: GridType;

  @IsNumber()
  columns: number;

  @IsOptional()
  @IsNumber()
  rows: number | null;

  @IsEnum(DisplayMode)
  displayMode: DisplayMode;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}
