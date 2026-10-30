import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductImportController } from './product-import.controller';
import { ProductImportService } from './product-import.service';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Category } from '../categories/category.entity';
import { Format } from '../formats/format.entity';
import { Edition } from '../editions/edition.entity';
import { Genre } from '../genres/genre.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Vendor, VendorSettings, Category, Format, Edition, Genre]),
  ],
  controllers: [ProductImportController],
  providers: [ProductImportService],
  exports: [ProductImportService],
})
export class ProductImportModule {}
