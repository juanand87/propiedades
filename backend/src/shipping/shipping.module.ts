import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { BluexService } from './bluex.service';
import { EnviaService } from './envia.service';
import { EnviaController } from './envia.controller';
import { Region } from './region.entity';
import { Commune } from './commune.entity';
import { ShippingMethod } from './shipping-method.entity';
import { VendorShippingMethod } from './vendor-shipping-method.entity';
import { ShippingMethodCommune } from './shipping-method-commune.entity';
import { Vendor } from '../vendors/vendor.entity';
import { MarketplaceSettings } from '../marketplace/marketplace-settings.entity';
import { Order } from '../orders/order.entity';
import { OrderShipment } from '../orders/order-shipment.entity';
import { Product } from '../products/product.entity';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Region,
      Commune,
      ShippingMethod,
      VendorShippingMethod,
      ShippingMethodCommune,
      Vendor,
      MarketplaceSettings,
      Order,
      OrderShipment,
      Product,
    ]),
    forwardRef(() => WoocommerceModule),
  ],
  controllers: [ShippingController, EnviaController],
  providers: [ShippingService, BluexService, EnviaService],
  exports: [ShippingService, BluexService, EnviaService],
})
export class ShippingModule {}
