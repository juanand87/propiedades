import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { FalabellaOrderSync } from './falabella-order-sync.entity';
import { FalabellaController } from './falabella.controller';
import { FalabellaWebhookController } from './falabella-webhook.controller';
import { FalabellaService } from './falabella.service';

@Module({
  imports: [TypeOrmModule.forFeature([VendorSettings, Product, Vendor, Order, OrderItem, FalabellaOrderSync])],
  controllers: [FalabellaController, FalabellaWebhookController],
  providers: [FalabellaService],
  exports: [FalabellaService],
})
export class FalabellaModule {}
