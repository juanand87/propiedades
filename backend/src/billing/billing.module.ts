import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { VendorInvoice } from './vendor-invoice.entity';
import { EmailModule } from '../email/email.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VendorInvoice, Order, Vendor]),
    EmailModule,
    MarketplaceModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
