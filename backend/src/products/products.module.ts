import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { GenresModule } from '../genres/genres.module';
import { FormatsModule } from '../formats/formats.module';
import { EditionsModule } from '../editions/editions.module';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Genre } from '../genres/genre.entity';
import { Format } from '../formats/format.entity';
import { Edition } from '../editions/edition.entity';
import { WoocommerceModule } from '../woocommerce/woocommerce.module';
import { SkuCountersModule } from '../sku-counters/sku-counters.module';
import { ProductSpotifyTrack } from './product-spotify-track.entity';
import { ProductSpotifySyncStatus } from './product-spotify-sync-status.entity';
import { ProductImportModule } from '../product-import/product-import.module';
import { StorageModule } from '../storage/storage.module';
import { OrderItem } from '../orders/order-item.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, User, Vendor, Genre, Format, Edition, ProductSpotifyTrack, ProductSpotifySyncStatus, OrderItem]),
    GenresModule,
    FormatsModule,
    EditionsModule,
    SkuCountersModule,
    StorageModule,
    AnalyticsModule,
    forwardRef(() => WoocommerceModule),
    forwardRef(() => ProductImportModule),
    MercadoLibreModule,
  ],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
