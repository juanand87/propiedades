import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liquidacion } from './liquidacion.entity';
import { VendorPayment } from './vendor-payment.entity';
import { Order } from '../orders/order.entity';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionesController } from './liquidaciones.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Liquidacion, VendorPayment, Order]),
    OrdersModule,
  ],
  providers: [LiquidacionesService],
  controllers: [LiquidacionesController],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
