import { IsNotEmpty, IsString, IsEmail, IsArray, IsNumber, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsNotEmpty()
  @IsString()
  vendorId: string;

  @IsOptional()
  @IsString()
  vendorSlug?: string;

  @IsOptional()
  @IsString()
  originHostname?: string; // Hostname desde donde se inició el pago (para returnUrl correcto)

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNotEmpty()
  @IsString()
  shippingName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  shippingPhone: string;

  @IsNotEmpty()
  @IsString()
  shippingAddress: string;

  @IsOptional()
  @IsString()
  shippingNumber?: string;

  @IsNotEmpty()
  @IsString()
  shippingCity: string;

  @IsNotEmpty()
  @IsString()
  shippingCountry: string;

  @IsOptional()
  @IsString()
  shippingRegion?: string;

  @IsOptional()
  @IsString()
  shippingCommune?: string;

  @IsOptional()
  @IsNumber()
  shippingRegionId?: number;

  @IsOptional()
  @IsNumber()
  shippingCommuneId?: number;

  @IsNotEmpty()
  @IsString()
  shippingRut: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  shippingMethodCode?: string;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  paykuMethod?: string; // Specific Payku payment method code ('4' = Khipu, '5' = Mach, '6' = Etpay, '8' = Pago, '9' = Hites, '10' = Fintoc)

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  paymentTransactionId?: string;
  
  // Envia.com fields
  @IsOptional()
  @IsString()
  enviaCarrier?: string;

  @IsOptional()
  @IsString()
  enviaService?: string;

  @IsOptional()
  @IsString()
  enviaServiceDescription?: string;

  @IsOptional()
  @IsNumber()
  enviaQuotedPrice?: number;

  @IsNotEmpty()
  @IsNumber()
  subtotal: number;

  @IsOptional()
  @IsNumber()
  shippingCost?: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsNotEmpty()
  @IsNumber()
  total: number;

  // Marketplace commission tracking
  @IsOptional()
  @IsString()
  orderSource?: 'marketplace' | 'direct_store' | 'custom_domain' | 'assisted_sale';

  // Flag to defer payment creation (used for multi-vendor orders)
  @IsOptional()
  deferPaymentCreation?: boolean;

  // Flag to indicate this order is part of a multi-vendor group
  @IsOptional()
  isMultiVendorOrder?: boolean;

  // Optional: Pre-generated order number (for multi-vendor shared orders)
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;
}
