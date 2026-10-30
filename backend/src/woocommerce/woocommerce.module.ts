import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WoocommerceService } from './woocommerce.service';
import { WoocommerceController } from './woocommerce.controller';
import { WoocommerceWebhookController } from './woocommerce-webhook.controller';
import { WoocommercePluginController } from './woocommerce-plugin.controller';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Category } from '../categories/category.entity';
import { Format } from '../formats/format.entity';
import { VendorsModule } from '../vendors/vendors.module';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { ShippingModule } from '../shipping/shipping.module';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Vendor, VendorSettings, Category, Format, Order, OrderItem, SmtpSettings]),
    forwardRef(() => VendorsModule),
    forwardRef(() => ShippingModule),
    EmailModule,
  ],
  controllers: [WoocommerceController, WoocommerceWebhookController, WoocommercePluginController],
  providers: [WoocommerceService],
  exports: [WoocommerceService],
})
export class WoocommerceModule {}
