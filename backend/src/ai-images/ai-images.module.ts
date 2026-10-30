import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiImagesController } from './ai-images.controller';
import { AiImagesService } from './ai-images.service';
import { AiImageGeneration } from './ai-image-generation.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiImageGeneration, Product, Vendor])],
  controllers: [AiImagesController],
  providers: [AiImagesService],
})
export class AiImagesModule {}