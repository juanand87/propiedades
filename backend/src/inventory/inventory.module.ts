import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from '../vendors/vendor.entity';
import { ProductsModule } from '../products/products.module';
import { StorageModule } from '../storage/storage.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventorySetupService } from './inventory-setup.service';
import { CoverRecognitionService } from './cover-recognition.service';
import { InventorySyncService } from './inventory-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor]), ProductsModule, StorageModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventorySetupService,
    CoverRecognitionService,
    InventorySyncService,
  ],
})
export class InventoryModule {}
