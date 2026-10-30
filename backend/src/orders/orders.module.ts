import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderHistory } from './order-history.entity';
import { OrderShipment } from './order-shipment.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SalesReceiptDocumentsService } from './sales-receipt-documents.service';
import { Liquidacion } from '../liquidaciones/liquidacion.entity';
import { VendorPayment } from '../liquidaciones/vendor-payment.entity';
import { PaymentModule } from '../payment/payment.module';
import { AuthModule } from '../auth/auth.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { CustomersModule } from '../customers/customers.module';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { EmailModule } from '../email/email.module';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';
import { OrderRefund } from './order-refund.entity';
import { PosModule } from '../pos/pos.module';
import { VendorReview } from '../reviews/vendor-review.entity';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderHistory, OrderShipment, OrderRefund, User, Product, Vendor, VendorSettings, Liquidacion, VendorPayment, SmtpSettings, VendorReview]),
    forwardRef(() => PaymentModule),
    forwardRef(() => AuthModule),
    EmailTemplatesModule,
    EmailModule,
    CustomersModule,
    forwardRef(() => WoocommerceModule),
    MercadoLibreModule,
    PosModule,
    DiscountsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, SalesReceiptDocumentsService],
  exports: [TypeOrmModule, OrdersService],
})
export class OrdersModule {}
