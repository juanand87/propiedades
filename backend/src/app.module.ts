import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { GenresModule } from './genres/genres.module';
import { FormatsModule } from './formats/formats.module';
import { EditionsModule } from './editions/editions.module';
import { PagesModule } from './pages/pages.module';
import { MediaModule } from './media/media.module';
import { ShippingModule } from './shipping/shipping.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { PaymentModule } from './payment/payment.module';
import { CustomersModule } from './customers/customers.module';
import { ProductImportModule } from './product-import/product-import.module';
import { EmailTemplatesModule } from './email-templates/email-templates.module';
import { StorageModule } from './storage/storage.module';
import { WoocommerceModule } from './woocommerce/woocommerce.module';
import { LiquidacionesModule } from './liquidaciones/liquidaciones.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiImagesModule } from './ai-images/ai-images.module';
import { QuestionsModule } from './questions/questions.module';
import { MercadoLibreModule } from './mercadolibre/mercadolibre.module';
import { FalabellaModule } from './falabella/falabella.module';
import { ParisModule } from './paris/paris.module';
import { BillingModule } from './billing/billing.module';
import { PosModule } from './pos/pos.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DiscountsModule } from './discounts/discounts.module';
import { InventoryModule } from './inventory/inventory.module';
import { installNetworkIsolation, validateProjectEnvironment } from './config/project-isolation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (env) => {
        validateProjectEnvironment(env);
        installNetworkIsolation(env);
        return env;
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // DESHABILITADO para evitar pérdida de datos - usar migraciones manuales
        logging: false, // Deshabilitado para reducir logs
        charset: 'utf8mb4',
      }),
    }),
    ScheduleModule.forRoot({ cronJobs: process.env.SCHEDULED_JOBS_ENABLED === 'true', intervals: false, timeouts: false }),
    UsersModule,
    VendorsModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    AuthModule,
    GenresModule,
    FormatsModule,
    EditionsModule,
    PagesModule,
    MediaModule,
    ShippingModule,
    MarketplaceModule,
    PaymentModule,
    CustomersModule,
    ProductImportModule,
    EmailTemplatesModule,
    StorageModule,
    WoocommerceModule,
    LiquidacionesModule,
    AnalyticsModule,
    AiImagesModule,
    QuestionsModule,
    MercadoLibreModule,
    FalabellaModule,
    ParisModule,
    BillingModule,
    PosModule,
    ReviewsModule,
    DiscountsModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
