import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genre } from './genre.entity';
import { GenresService } from './genres.service';
import { GenresController } from './genres.controller';
import { Product } from '../products/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Genre, Product])],
  controllers: [GenresController],
  providers: [GenresService],
  exports: [GenresService],
})
export class GenresModule {}
