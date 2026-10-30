import { Type, Transform } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class AssistedOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  quantity: number;
}

export class CreateAssistedOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistedOrderItemDto)
  items: AssistedOrderItemDto[];

  @IsString()
  @IsIn(['whatsapp', 'email', 'instagram', 'phone', 'other'])
  channel: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  customerRut: string;

  @IsString()
  @IsNotEmpty()
  shippingAddress: string;

  @IsOptional()
  @IsString()
  shippingNumber?: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  shippingRegionId: number;

  @IsString()
  shippingRegion: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  shippingCommuneId: number;

  @IsString()
  shippingCommune: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmAssistedTransferDto {
  @IsOptional()
  @IsString()
  transferReference?: string;

  @IsOptional()
  @IsString()
  originHostname?: string;
}
