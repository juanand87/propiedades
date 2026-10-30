import { IsNotEmpty, IsString, IsArray, IsNumber, IsOptional, ValidateNested, IsEmail } from 'class-validator';
import { Type, Transform } from 'class-transformer';

class PosOrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  price: number;
}

export class CreatePosOrderDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items: PosOrderItemDto[];

  @IsNotEmpty()
  @IsString()
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  subtotal: number;

  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => Number(value))
  total: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  receivedAmount?: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
