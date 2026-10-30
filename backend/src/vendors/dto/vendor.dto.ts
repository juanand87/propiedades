import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  storeName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  storeName?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  banner?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  shortDescriptionTemplate?: string;

  @IsString()
  @IsOptional()
  spotifyClientId?: string;

  @IsString()
  @IsOptional()
  spotifyClientSecret?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  @IsString()
  @IsOptional()
  taxpayerType?: string;

  @IsString()
  @IsOptional()
  billingRut?: string;

  @IsString()
  @IsOptional()
  billingLegalName?: string;

  @IsString()
  @IsOptional()
  billingBusinessActivity?: string;

  @IsString()
  @IsOptional()
  billingAddress?: string;

  @IsString()
  @IsOptional()
  billingRegion?: string;

  @IsString()
  @IsOptional()
  billingCommune?: string;

  @IsString()
  @IsOptional()
  billingEmail?: string;
}
