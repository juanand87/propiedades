import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { SmtpSettings } from '../marketplace/smtp-settings.entity';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { VendorReview } from './vendor-review.entity';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VendorReview, Order, Vendor, VendorSettings, SmtpSettings]),
    EmailModule,
    DiscountsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
