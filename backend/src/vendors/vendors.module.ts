import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { Vendor } from './vendor.entity';
import { VendorSettings } from './vendor-settings.entity';
import { VendorCategorySettings } from './vendor-category-settings.entity';
import { VendorApplication } from './vendor-application.entity';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { Page } from '../pages/page.entity';
import { Product } from '../products/product.entity';
import { ProductSpotifyTrack } from '../products/product-spotify-track.entity';
import { ProductSpotifySyncStatus } from '../products/product-spotify-sync-status.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { VendorShippingMethod } from '../shipping/vendor-shipping-method.entity';
import { MediaFile } from '../media/media-file.entity';
import { MediaFolder } from '../media/media-folder.entity';
import { CustomerProfile } from '../customers/customer-profile.entity';
import { DiscogsService } from './discogs.service';
import { PagesModule } from '../pages/pages.module';
import { EmailModule } from '../email/email.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, VendorSettings, VendorCategorySettings, VendorApplication, Category, User, Page, Product, ProductSpotifyTrack, ProductSpotifySyncStatus, Order, OrderItem, VendorShippingMethod, MediaFile, MediaFolder, CustomerProfile]),
    PagesModule,
    EmailModule,
    forwardRef(() => MarketplaceModule),
    EmailTemplatesModule,
  ],
  providers: [VendorsService, DiscogsService],
  controllers: [VendorsController],
  exports: [VendorsService, DiscogsService],
})
export class VendorsModule {}
