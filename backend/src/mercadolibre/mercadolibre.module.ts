import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadoLibreController } from './mercadolibre.controller';
import { MercadoLibreService } from './mercadolibre.service';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';
import { MercadoLibreOrderSync } from './mercadolibre-order-sync.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { ProductQuestion } from '../questions/product-question.entity';
import { ProductQuestionMessage } from '../questions/product-question-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Vendor, VendorSettings, MercadoLibreOrderSync, Order, OrderItem, ProductQuestion, ProductQuestionMessage]), forwardRef(() => MarketplaceModule), forwardRef(() => WoocommerceModule)],
  controllers: [MercadoLibreController],
  providers: [MercadoLibreService],
  exports: [MercadoLibreService],
})
export class MercadoLibreModule {}
