import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountCode, DiscountUse } from './discount.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscountCode, DiscountUse, Product, Vendor]),
  ],
  providers: [DiscountsService],
  controllers: [DiscountsController],
  exports: [DiscountsService],
})
export class DiscountsModule {}
