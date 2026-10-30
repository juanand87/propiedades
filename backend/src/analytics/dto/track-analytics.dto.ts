import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class TrackSessionDto {
  @IsString()
  vendorId: string;

  @IsString()
  sessionId: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  referrer?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  pagePath?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsNumber()
  @IsOptional()
  durationSeconds?: number;
}

export class TrackConversionDto {
  @IsString()
  sessionId: string;

  @IsNumber()
  @IsOptional()
  itemsAddedToCart?: number;

  @IsBoolean()
  @IsOptional()
  purchaseCompleted?: boolean;

  @IsNumber()
  @IsOptional()
  purchaseValue?: number;

  @IsString()
  @IsOptional()
  orderId?: string;
}
