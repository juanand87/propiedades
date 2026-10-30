import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorSettings } from '../vendors/vendor-settings.entity';
import { Product } from '../products/product.entity';
import { ParisController } from './paris.controller';
import { ParisService } from './paris.service';

@Module({
  imports: [TypeOrmModule.forFeature([VendorSettings, Product])],
  controllers: [ParisController],
  providers: [ParisService],
  exports: [ParisService],
})
export class ParisModule {}
