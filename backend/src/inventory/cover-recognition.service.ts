import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { DataSource, In, LessThan, MoreThan, Not } from 'typeorm';
import axios from 'axios';
import sharp from 'sharp';
import { Product } from '../products/product.entity';
import { InventoryCover } from './inventory.entity';
import { InventorySetupService } from './inventory-setup.service';
import { cosineSimilarity } from './inventory-rules';

export const COVER_MODEL = 'Xenova/clip-vit-base-patch32';

@Injectable()
export class CoverRecognitionService {
  private extractor: Promise<any> | null = null;
  private busy = false;
  private nextCatalogScan = 0;
  private inferenceQueue = 0;
  private inferenceTail: Promise<void> = Promise.resolve();
  constructor(
    private readonly db: DataSource,
    private readonly setup: InventorySetupService,
  ) {}
  hash(url: string) {
    return createHash('sha256')
      .update(`${COVER_MODEL}:q8:${url}`)
      .digest('hex');
  }

  async status(vendorId?: string) {
    if (!(await this.setup.ready()))
      return { ready: false, counts: {}, enabled: false };
    const query = this.db
      .getRepository(InventoryCover)
      .createQueryBuilder('cover')
      .select('cover.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('cover.status');
    if (vendorId) query.where('cover.vendorId = :vendorId', { vendorId });
    const rows = await query.getRawMany();
    const [state] = await this.db.query(
      'SELECT indexingEnabled, scanCursor, lastError FROM inventory_system_state WHERE id = 1',
    );
    const failures = await this.db.getRepository(InventoryCover).find({
      where: { status: 'failed', ...(vendorId ? { vendorId } : {}) },
      select: ['productId', 'error'],
      take: 5,
    });
    return {
      ready: true,
      model: COVER_MODEL,
      enabled: Boolean(state?.indexingEnabled),
      scanning: Boolean(state?.scanCursor),
      lastError: state?.lastError || null,
      counts: Object.fromEntries(
        rows.map((row) => [row.status, Number(row.total)]),
      ),
      failures,
    };
  }

  async setEnabled(enabled: boolean, retry = false) {
    await this.setup.requireReady();
    await this.db.query(
      'UPDATE inventory_system_state SET indexingEnabled = ?, scanCursor = NULL, lastError = NULL WHERE id = 1',
      [enabled ? 1 : 0],
    );
    if (retry)
      await this.db
        .getRepository(InventoryCover)
        .update({ status: 'failed' }, { status: 'pending', error: null });
    return this.status();
  }

  async queueCatalogPage() {
    const [state] = await this.db.query(
      'SELECT scanCursor FROM inventory_system_state WHERE id = 1',
    );
    const products = await this.db.getRepository(Product).find({
      where: {
        status: Not('trash' as any),
        ...(state?.scanCursor ? { id: MoreThan(state.scanCursor) } : {}),
      },
      relations: ['vendor'],
      select: { id: true, images: true, vendor: { id: true } },
      order: { id: 'ASC' },
      take: 250,
    });
    const repository = this.db.getRepository(InventoryCover);
    const oldRows = products.length
      ? await repository.find({
          where: { productId: In(products.map((p) => p.id)) },
          select: ['productId', 'sourceHash'],
        })
      : [];
    const byId = new Map(oldRows.map((row) => [row.productId, row]));
    for (const product of products) {
      const imageUrl = product.images?.[0];
      if (!imageUrl || !product.vendor?.id) continue;
      const sourceHash = this.hash(imageUrl);
      const old = byId.get(product.id);
      if (old?.sourceHash === sourceHash) continue;
      await repository.upsert(
        {
          productId: product.id,
          vendorId: product.vendor.id,
          imageUrl,
          sourceHash,
          model: COVER_MODEL,
          status: 'pending',
          vector: null,
          error: null,
          claimedAt: null,
        },
        ['productId'],
      );
    }
    await this.db.query(
      'UPDATE inventory_system_state SET scanCursor = ? WHERE id = 1',
      [products.length === 250 ? products[products.length - 1].id : null],
    );
  }

  @Cron('*/20 * * * * *')
  async work() {
    if (this.busy || !(await this.setup.ready())) return;
    const [state] = await this.db.query(
      'SELECT indexingEnabled FROM inventory_system_state WHERE id = 1',
    );
    if (!state?.indexingEnabled) return;
    this.busy = true;
    try {
      if (Date.now() >= this.nextCatalogScan) {
        await this.queueCatalogPage();
        this.nextCatalogScan = Date.now() + 60000;
      }
      const repository = this.db.getRepository(InventoryCover);
      await repository.update(
        {
          status: 'processing',
          claimedAt: LessThan(new Date(Date.now() - 10 * 60000)),
        },
        { status: 'pending', claimedAt: null },
      );
      const pending = await repository.find({
        where: { status: 'pending' },
        take: 3,
      });
      for (const row of pending) {
        const claim = await repository.update(
          {
            productId: row.productId,
            status: 'pending',
            sourceHash: row.sourceHash,
          },
          { status: 'processing', claimedAt: new Date() },
        );
        if (!claim.affected) continue;
        try {
          const vector = await this.embed(await this.fetchCover(row.imageUrl));
          await repository.update(
            { productId: row.productId, sourceHash: row.sourceHash },
            { status: 'ready', vector, error: null, claimedAt: null },
          );
        } catch (error) {
          await repository.update(
            { productId: row.productId, sourceHash: row.sourceHash },
            {
              status: 'failed',
              error: String(error.message).slice(0, 1000),
              claimedAt: null,
            },
          );
        }
      }
    } catch (error) {
      await this.db
        .query('UPDATE inventory_system_state SET lastError = ? WHERE id = 1', [
          String(error.message).slice(0, 1000),
        ])
        .catch(() => undefined);
    } finally {
      this.busy = false;
    }
  }

  private async fetchCover(value: string): Promise<Buffer> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(
        'Portada sin URL HTTPS pública. Actualiza la imagen del producto.',
      );
    }
    const allowed = [
      'mundobeat.nyc3.cdn.digitaloceanspaces.com',
      'mundobeat.nyc3.digitaloceanspaces.com',
      'i.discogs.com',
    ];
    if (
      url.protocol !== 'https:' ||
      !allowed.includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      throw new Error(
        'Aloja esta portada en la biblioteca de imágenes de MundoBeat para indexarla.',
      );
    const response = await axios.get(url.toString(), {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }

  async embed(buffer: Buffer): Promise<number[]> {
    // Only one inference at a time, shared by indexing and phone searches.
    if (this.inferenceQueue >= 4)
      throw new ServiceUnavailableException(
        'El reconocimiento está ocupado. Reintenta en unos segundos.',
      );
    this.inferenceQueue++;
    let release!: () => void;
    const previous = this.inferenceTail;
    this.inferenceTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const library = await import('@huggingface/transformers');
      if (!this.extractor) {
        library.env.cacheDir =
          process.env.INVENTORY_MODEL_CACHE || './.cache/inventory-models';
        this.extractor = library
          .pipeline('image-feature-extraction', COVER_MODEL, {
            dtype: 'q8',
            device: 'cpu',
            session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
          })
          .catch((error) => {
            this.extractor = null;
            throw error;
          });
      }
      const { data, info } = await sharp(buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(512, 512, { fit: 'inside' })
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });
      const raw = new library.RawImage(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        info.channels as 3,
      );
      const extractor = await this.extractor;
      const output = await extractor(raw);
      const vector = Array.from(output.data as ArrayLike<number>, Number);
      if (
        vector.length !== 512 ||
        vector.some((value) => !Number.isFinite(value))
      )
        throw new Error('El modelo devolvió una representación inválida');
      const norm = Math.sqrt(
        vector.reduce((sum, value) => sum + value * value, 0),
      );
      if (!norm) throw new Error('El modelo devolvió una representación vacía');
      return vector.map((value) => value / norm);
    } finally {
      this.inferenceQueue--;
      release();
    }
  }

  async search(vendorId: string, buffer: Buffer) {
    await this.setup.requireReady();
    const repository = this.db.getRepository(InventoryCover);
    const total = await repository.countBy({
      vendorId,
      status: 'ready',
      model: COVER_MODEL,
    });
    if (!total)
      throw new ServiceUnavailableException(
        'Esta tienda aún no tiene portadas indexadas. Solicita preparar el reconocimiento desde el panel de administración.',
      );
    let vector: number[];
    try {
      vector = await this.embed(buffer);
    } catch (error) {
      throw new BadRequestException(
        `No se pudo analizar la foto: ${String(error.message).slice(0, 200)}`,
      );
    }
    let candidates: { row: InventoryCover; similarity: number }[] = [];
    for (let offset = 0; offset < total; offset += 250) {
      const rows = await repository.find({
        where: { vendorId, status: 'ready', model: COVER_MODEL },
        take: 250,
        skip: offset,
        order: { productId: 'ASC' },
      });
      candidates.push(
        ...rows.map((row) => ({
          row,
          similarity: cosineSimilarity(vector, row.vector || []),
        })),
      );
      candidates.sort((a, b) => b.similarity - a.similarity);
      candidates = candidates.slice(0, 20);
    }
    const products = await this.db.getRepository(Product).find({
      where: {
        id: In(candidates.map((item) => item.row.productId)),
        vendor: { id: vendorId },
        status: Not('trash' as any),
      },
    });
    return {
      indexed: total,
      matches: candidates
        .filter((item) => {
          const product = products.find((p) => p.id === item.row.productId);
          return (
            product &&
            this.hash(product.images?.[0] || '') === item.row.sourceHash
          );
        })
        .slice(0, 5)
        .map((item) => ({
          product: products.find((p) => p.id === item.row.productId),
          similarity: Number(item.similarity.toFixed(4)),
        })),
    };
  }
}
