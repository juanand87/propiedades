import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './page.entity';
import { Vendor } from '../vendors/vendor.entity';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Vendor])],
  providers: [PagesService],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
