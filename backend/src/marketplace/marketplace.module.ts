import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceSettings } from './marketplace-settings.entity';
import { MarketplacePaymentMethod } from './marketplace-payment-method.entity';
import { VendorPaymentMethod } from './vendor-payment-method.entity';
import { SmtpSettings } from './smtp-settings.entity';
import { SmtpSettingsController } from './smtp-settings.controller';
import { SmtpSettingsService } from './smtp-settings.service';
import { Vendor } from '../vendors/vendor.entity';
import { PaymentModule } from '../payment/payment.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceSettings,
      MarketplacePaymentMethod,
      VendorPaymentMethod,
      SmtpSettings,
      Vendor,
    ]),
    PaymentModule,
    EmailModule,
  ],
  controllers: [MarketplaceController, SmtpSettingsController],
  providers: [MarketplaceService, SmtpSettingsService],
  exports: [MarketplaceService, SmtpSettingsService],
})
export class MarketplaceModule {}
