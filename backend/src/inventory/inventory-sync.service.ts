import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { InventoryStockSync } from './inventory.entity';
import { InventorySetupService } from './inventory-setup.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class InventorySyncService {
  private busy = false;
  constructor(
    private readonly db: DataSource,
    private readonly setup: InventorySetupService,
    private readonly products: ProductsService,
  ) {}

  @Cron('*/30 * * * * *')
  async work() {
    if (this.busy || !(await this.setup.ready())) return;
    this.busy = true;
    try {
      const jobs = this.db.getRepository(InventoryStockSync);
      await jobs.update(
        {
          status: 'processing',
          claimedAt: LessThan(new Date(Date.now() - 10 * 60000)),
          attempts: LessThan(3),
        },
        { status: 'pending' },
      );
      await jobs.update(
        {
          status: 'processing',
          claimedAt: LessThan(new Date(Date.now() - 10 * 60000)),
          attempts: 3,
        },
        {
          status: 'failed',
          error:
            'La sincronización no terminó. Revisa los canales y reintenta.',
        },
      );
      const batch = await jobs.find({
        where: { status: 'pending', attempts: LessThan(3) },
        take: 3,
      });
      for (const job of batch) {
        const claimedAt = new Date();
        const result = await jobs.update(
          { id: job.id, status: 'pending' },
          { status: 'processing', claimedAt, attempts: () => 'attempts + 1' },
        );
        if (!result.affected) continue;
        try {
          // Read current commercial stock, not an obsolete count snapshot.
          await this.products.syncInventoryStock(job.productId, job.vendorId);
          await jobs.update(
            { id: job.id, status: 'processing', claimedAt },
            { status: 'processed', error: null },
          );
        } catch (error) {
          await jobs.update(
            { id: job.id, status: 'processing', claimedAt },
            {
              status: job.attempts + 1 >= 3 ? 'failed' : 'pending',
              error: String(error.message).slice(0, 1000),
            },
          );
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
