import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { FlowService } from './flow.service';
import { PaykuService } from './payku.service';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';
import { MarketplacePaymentMethod } from '../marketplace/marketplace-payment-method.entity';
import { Vendor } from '../vendors/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketplacePaymentMethod, Vendor]),
    forwardRef(() => OrdersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => WoocommerceModule),
  ],
  controllers: [PaymentController],
  providers: [FlowService, PaykuService],
  exports: [FlowService, PaykuService],
})
export class PaymentModule {}
