import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { Product } from '../products/product.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [TypeOrmModule, CategoriesService],
})
export class CategoriesModule {}
