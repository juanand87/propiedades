import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Format } from './format.entity';
import { FormatsService } from './formats.service';
import { FormatsController } from './formats.controller';
import { Product } from '../products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Format, Product])],
  controllers: [FormatsController],
  providers: [FormatsService],
  exports: [FormatsService],
})
export class FormatsModule {}
