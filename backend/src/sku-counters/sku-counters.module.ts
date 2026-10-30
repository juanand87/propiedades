import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkuCounter } from './sku-counter.entity';
import { SkuGeneratorService } from './sku-generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([SkuCounter])],
  providers: [SkuGeneratorService],
  exports: [SkuGeneratorService],
})
export class SkuCountersModule {}
