import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Edition } from './edition.entity';
import { EditionsService } from './editions.service';
import { EditionsController } from './editions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Edition])],
  controllers: [EditionsController],
  providers: [EditionsService],
  exports: [EditionsService],
})
export class EditionsModule {}
