import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Product, ProductStatus } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import {
  InventoryEvent,
  InventoryFound,
  InventoryLine,
  InventorySession,
  InventoryStockSync,
} from './inventory.entity';
import { InventorySetupService } from './inventory-setup.service';
import { inventoryConflict } from './inventory-rules';
import { randomUUID } from 'crypto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    private readonly setup: InventorySetupService,
  ) {}

  async vendorForUser(userId: string) {
    if (typeof userId !== 'string' || !userId)
      throw new NotFoundException('Usuario no encontrado');
    const vendor = await this.vendors.findOne({
      where: { user: { id: userId } },
    });
    if (!vendor) throw new NotFoundException('Tienda no encontrada');
    return vendor.id;
  }

  private async session(
    manager: EntityManager,
    id: string,
    vendorId: string,
    writable = false,
  ) {
    const session = await manager.findOne(InventorySession, {
      where: { id, vendorId },
      ...(writable ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!session) throw new NotFoundException('Conteo no encontrado');
    if (writable && !['counting', 'review'].includes(session.status))
      throw new BadRequestException('El conteo ya está cerrado');
    return session;
  }

  async list(vendorId: string) {
    await this.setup.requireReady();
    return this.db
      .getRepository(InventorySession)
      .find({ where: { vendorId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async verifySession(vendorId: string, id: string) {
    await this.setup.requireReady();
    const session = await this.session(this.db.manager, id, vendorId);
    if (!['counting', 'review'].includes(session.status))
      throw new BadRequestException('El conteo ya está cerrado');
    return session;
  }

  async retrySync(vendorId: string, id: string) {
    await this.setup.requireReady();
    const session = await this.session(this.db.manager, id, vendorId);
    if (session.status !== 'completed')
      throw new BadRequestException('El conteo no está finalizado');
    await this.db
      .getRepository(InventoryStockSync)
      .update(
        { sessionId: id, vendorId, status: 'failed' },
        { status: 'pending', attempts: 0, error: null, claimedAt: null },
      );
    return { queued: true };
  }

  async getFound(vendorId: string, id: string, foundId: string) {
    await this.verifySession(vendorId, id);
    const found = await this.db
      .getRepository(InventoryFound)
      .findOneBy({ id: foundId, sessionId: id });
    if (!found || found.status !== 'pending')
      throw new BadRequestException(
        'Este registro ya fue resuelto o descartado',
      );
    return found;
  }

  async create(vendorId: string, userId: string, data: any) {
    await this.setup.requireReady();
    const name = String(data.name || '').trim();
    if (!name || name.length > 150)
      throw new BadRequestException('Indica un nombre de hasta 150 caracteres');
    const scope = {
      categoryId: data.categoryId || undefined,
      genreId: data.genreId ? Number(data.genreId) : undefined,
      type: data.type || undefined,
    };
    if (
      scope.categoryId &&
      (typeof scope.categoryId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(scope.categoryId))
    )
      throw new BadRequestException('Categoría inválida');
    if (
      scope.genreId !== undefined &&
      (!Number.isSafeInteger(scope.genreId) || scope.genreId < 1)
    )
      throw new BadRequestException('Género inválido');
    if (
      scope.type &&
      !['cd', 'vinyl', 'cassette', 'merchandise', 'equipment'].includes(
        scope.type,
      )
    )
      throw new BadRequestException('Formato inválido');
    return this.db.transaction(async (manager) => {
      const session = await manager.save(
        InventorySession,
        manager.create(InventorySession, {
          vendorId,
          createdBy: userId,
          name,
          scope,
          status: 'counting',
        }),
      );
      const query = manager
        .getRepository(Product)
        .createQueryBuilder('p')
        .where('p.vendorId = :vendorId', { vendorId })
        .andWhere('p.status <> :trash', { trash: ProductStatus.TRASH });
      if (scope.type) query.andWhere('p.type = :type', { type: scope.type });
      if (scope.categoryId)
        query.innerJoin('p.categories', 'c', 'c.id = :categoryId', {
          categoryId: scope.categoryId,
        });
      if (scope.genreId)
        query.innerJoin('p.genres', 'g', 'g.id = :genreId', {
          genreId: scope.genreId,
        });
      const products = await query
        .select(['p.id', 'p.stock', 'p.updatedAt'])
        .getMany();
      for (let i = 0; i < products.length; i += 200) {
        await manager.save(
          InventoryLine,
          products.slice(i, i + 200).map((product) =>
            manager.create(InventoryLine, {
              sessionId: session.id,
              productId: product.id,
              snapshotStock: product.stock,
              snapshotUpdatedAt: product.updatedAt,
              counted: null,
              selected: false,
            }),
          ),
        );
      }
      return session;
    });
  }

  async detail(vendorId: string, id: string, query: any = {}) {
    await this.setup.requireReady();
    const session = await this.session(this.db.manager, id, vendorId);
    const allLines = await this.db
      .getRepository(InventoryLine)
      .findBy({ sessionId: id });
    const products = allLines.length
      ? await this.db.getRepository(Product).find({
          where: {
            id: In(allLines.map((line) => line.productId)),
            vendor: { id: vendorId },
          },
          select: [
            'id',
            'title',
            'artist',
            'sku',
            'barcode',
            'stock',
            'status',
            'images',
            'condition',
            'mediaGrade',
            'sleeveGrade',
            'format',
            'year',
            'updatedAt',
          ],
        })
      : [];
    const map = new Map(products.map((product) => [product.id, product]));
    let lines = allLines.map((line) => {
      const product = map.get(line.productId);
      return {
        ...line,
        product,
        difference:
          line.counted === null ? null : line.counted - line.snapshotStock,
        conflict:
          ['counting', 'review'].includes(session.status) &&
          (!product ||
            product.status === 'trash' ||
            inventoryConflict(line, product)),
      };
    });
    const summary = {
      total: lines.length,
      counted: lines.filter((line) => line.counted !== null).length,
      differences: lines.filter(
        (line) => line.difference !== null && line.difference !== 0,
      ).length,
      conflicts: lines.filter((line) => line.counted !== null && line.conflict)
        .length,
      selected: lines.filter((line) => line.selected).length,
    };
    const search = String(query.search || '')
      .toLowerCase()
      .trim();
    if (search)
      lines = lines.filter((line) =>
        [line.product?.title, line.product?.sku, line.product?.barcode].some(
          (value) =>
            String(value || '')
              .toLowerCase()
              .includes(search),
        ),
      );
    if (query.filter === 'uncounted')
      lines = lines.filter((line) => line.counted === null);
    if (query.filter === 'differences')
      lines = lines.filter(
        (line) => line.difference !== null && line.difference !== 0,
      );
    if (query.filter === 'conflicts')
      lines = lines.filter((line) => line.counted !== null && line.conflict);
    const total = lines.length;
    const page = Math.max(1, Number(query.page) || 1);
    const syncJobs = await this.db
      .getRepository(InventoryStockSync)
      .find({ where: { sessionId: id }, select: ['id', 'status', 'error'] });
    return {
      session,
      summary,
      lines: lines.slice((page - 1) * 50, page * 50),
      total,
      page,
      found: await this.db
        .getRepository(InventoryFound)
        .findBy({ sessionId: id }),
      syncJobs,
    };
  }

  async search(vendorId: string, id: string, term: string) {
    await this.setup.requireReady();
    await this.session(this.db.manager, id, vendorId);
    if (!term?.trim()) return [];
    const text = term.trim().slice(0, 150);
    const products = await this.db
      .getRepository(Product)
      .createQueryBuilder('p')
      .where('p.vendorId = :vendorId', { vendorId })
      .andWhere('p.status <> :trash', { trash: 'trash' })
      .andWhere(
        '(p.barcode = :exact OR p.sku = :exact OR p.title LIKE :search)',
        { exact: text, search: `%${text}%` },
      )
      .orderBy(
        'CASE WHEN p.barcode = :exact THEN 0 WHEN p.sku = :exact THEN 1 ELSE 2 END',
        'ASC',
      )
      .take(20)
      .getMany();
    const counts = await this.getCounts(
      vendorId,
      id,
      products.map((product) => product.id),
    );
    return products.map((product) => ({
      ...product,
      inventoryCount: counts[product.id] ?? 0,
    }));
  }

  async getCounts(
    vendorId: string,
    id: string,
    productIds: string[],
  ): Promise<Record<string, number>> {
    await this.setup.requireReady();
    await this.session(this.db.manager, id, vendorId);
    if (!productIds.length) return {};
    const lines = await this.db
      .getRepository(InventoryLine)
      .find({
        where: { sessionId: id, productId: In(productIds) },
        select: ['productId', 'counted'],
      });
    return Object.fromEntries(
      lines.map((line) => [line.productId, Number(line.counted ?? 0)]),
    );
  }

  private async line(
    manager: EntityManager,
    sessionId: string,
    productId: string,
    vendorId: string,
    lockProduct = false,
  ) {
    if (
      typeof productId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,36}$/.test(productId)
    )
      throw new BadRequestException('Producto inválido');
    const product = await manager.findOne(Product, {
      where: { id: productId, vendor: { id: vendorId } },
      ...(lockProduct ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!product || product.status === 'trash')
      throw new NotFoundException('Producto no disponible en esta tienda');
    let line = await manager.findOneBy(InventoryLine, { sessionId, productId });
    if (!line)
      line = manager.create(InventoryLine, {
        sessionId,
        productId,
        snapshotStock: product.stock,
        snapshotUpdatedAt: product.updatedAt,
        counted: null,
        selected: false,
      });
    return { line, product };
  }

  async count(vendorId: string, id: string, userId: string, data: any) {
    await this.setup.requireReady();
    const quantity = Number(data.quantity);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 1000000 ||
      !['add', 'set', 'add-stock'].includes(data.mode) ||
      (data.mode === 'add-stock' && quantity !== 1)
    )
      throw new BadRequestException('Cantidad inválida');
    if (!/^[0-9a-f-]{36}$/i.test(data.requestId || ''))
      throw new BadRequestException('Identificador de lectura inválido');
    return this.db.transaction(async (manager) => {
      await this.session(manager, id, vendorId, true);
      const previous = await manager.findOneBy(InventoryEvent, {
        id: data.requestId,
      });
      if (previous) {
        if (
          previous.sessionId !== id ||
          previous.productId !== data.productId ||
          previous.quantity !== quantity ||
          previous.mode !== data.mode
        )
          throw new BadRequestException(
            'Identificador de lectura ya utilizado',
          );
        const saved = await manager.findOneBy(InventoryLine, {
          sessionId: id,
          productId: data.productId,
        });
        const product = await manager.findOne(Product, {
          where: { id: data.productId, vendor: { id: vendorId } },
        });
        return { ...saved, stock: product?.stock };
      }
      const { line, product } = await this.line(manager, id, data.productId, vendorId, true);
      if (data.mode === 'add-stock') {
        if (inventoryConflict(line, product))
          throw new ConflictException('El stock cambió. Revisa este producto antes de agregar una unidad.');
        if (Number(line.counted || 0) + 1 <= product.stock)
          throw new ConflictException('El producto ya tiene stock suficiente. Vuelve a buscarlo para continuar contando.');
        if (product.stock >= 1000000)
          throw new BadRequestException('Stock demasiado alto');
        product.stock += 1;
        const updated = await manager.save(product);
        // Advance the baseline by the applied unit, preserving earlier differences.
        line.snapshotStock += 1;
        line.snapshotUpdatedAt = updated.updatedAt;
        await manager.save(InventoryStockSync, manager.create(InventoryStockSync, {
          id: data.requestId,
          sessionId: id,
          productId: product.id,
          vendorId,
          status: 'pending',
          attempts: 0,
        }));
      }
      line.counted =
        data.mode !== 'set' ? Number(line.counted || 0) + quantity : quantity;
      if (line.counted > 1000000)
        throw new BadRequestException('Cantidad demasiado alta');
      line.countedBy = userId;
      line.selected = false;
      const saved = await manager.save(line);
      await manager.save(
        InventoryEvent,
        manager.create(InventoryEvent, {
          id: data.requestId,
          sessionId: id,
          productId: data.productId,
          userId,
          quantity,
          mode: data.mode,
        }),
      );
      return { ...saved, stock: product.stock };
    });
  }

  async reviewLine(vendorId: string, id: string, productId: string, data: any) {
    await this.setup.requireReady();
    return this.db.transaction(async (manager) => {
      await this.session(manager, id, vendorId, true);
      const { line, product } = await this.line(
        manager,
        id,
        productId,
        vendorId,
        true,
      );
      if (data.apply === true) {
        if (data.recheck === true || line.counted === null || inventoryConflict(line, product))
          throw new ConflictException('Vuelve a revisar este producto antes de aplicar el ajuste');
        if (product.stock !== line.counted) {
          product.stock = line.counted;
          const updated = await manager.save(product);
          line.snapshotStock = updated.stock;
          line.snapshotUpdatedAt = updated.updatedAt;
          line.appliedStock = updated.stock;
          await manager.save(InventoryStockSync, manager.create(InventoryStockSync, {
            id: randomUUID(), sessionId: id, productId, vendorId,
            status: 'pending', attempts: 0,
          }));
        }
        line.selected = false;
        return manager.save(line);
      }
      if (typeof data.note === 'string')
        line.note = data.note.trim().slice(0, 1000);
      if (data.recheck === true) {
        line.snapshotStock = product.stock;
        line.snapshotUpdatedAt = product.updatedAt;
        line.selected = false;
      }
      if (typeof data.selected === 'boolean') {
        if (
          data.selected &&
          (line.counted === null || inventoryConflict(line, product))
        )
          throw new ConflictException(
            'Vuelve a revisar este producto antes de seleccionar el ajuste',
          );
        line.selected = data.selected;
      }
      return manager.save(line);
    });
  }

  async addFound(vendorId: string, id: string, data: any, photoUrl?: string) {
    await this.setup.requireReady();
    const quantity = Number(data.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000)
      throw new BadRequestException('Cantidad inválida');
    if (!/^[0-9a-f-]{36}$/i.test(data.requestId || ''))
      throw new BadRequestException('Identificador de registro inválido');
    return this.db.transaction(async (manager) => {
      await this.session(manager, id, vendorId, true);
      const previous = await manager.findOneBy(InventoryFound, {
        id: data.requestId,
      });
      if (previous) {
        if (previous.sessionId !== id)
          throw new BadRequestException(
            'Identificador de registro ya utilizado',
          );
        return previous;
      }
      return manager.save(
        InventoryFound,
        manager.create(InventoryFound, {
          id: data.requestId,
          sessionId: id,
          title: String(data.title || 'Producto sin identificar').slice(0, 255),
          barcode:
            String(data.barcode || '')
              .trim()
              .slice(0, 150) || null,
          quantity,
          photoUrl: photoUrl || null,
          note: String(data.note || '').slice(0, 1000) || null,
          status: 'pending',
        }),
      );
    });
  }

  async resolveFound(
    vendorId: string,
    id: string,
    foundId: string,
    userId: string,
    data: any,
  ) {
    await this.setup.requireReady();
    return this.db.transaction(async (manager) => {
      await this.session(manager, id, vendorId, true);
      const found = await manager.findOneBy(InventoryFound, {
        id: foundId,
        sessionId: id,
      });
      if (!found) throw new NotFoundException('Registro no encontrado');
      if (found.status !== 'pending') return found;
      if (data.dismiss === true) {
        if (!String(data.note || '').trim())
          throw new BadRequestException(
            'Indica por qué se descarta este registro',
          );
        found.status = 'dismissed';
        found.note = String(data.note).trim().slice(0, 1000);
      } else {
        const { line } = await this.line(manager, id, data.productId, vendorId);
        line.counted = Number(line.counted || 0) + found.quantity;
        line.countedBy = userId;
        line.selected = false;
        if (line.counted > 1000000)
          throw new BadRequestException('Cantidad demasiado alta');
        await manager.save(line);
        found.status = 'linked';
        found.productId = data.productId;
      }
      return manager.save(found);
    });
  }

  async changeStatus(
    vendorId: string,
    id: string,
    userId: string,
    status: string,
  ) {
    await this.setup.requireReady();
    if (!['counting', 'review', 'completed', 'cancelled'].includes(status))
      throw new BadRequestException('Estado inválido');
    const changed: string[] = [];
    const result = await this.db.transaction(async (manager) => {
      const session = await this.session(manager, id, vendorId, true);
      if (status === 'completed') {
        if (session.status !== 'review')
          throw new BadRequestException(
            'Revisa los ajustes antes de cerrar el conteo',
          );
        if (
          await manager.countBy(InventoryFound, {
            sessionId: id,
            status: 'pending',
          })
        )
          throw new BadRequestException(
            'Resuelve o descarta los productos sin ficha antes de cerrar',
          );
        const lines = await manager.find(InventoryLine, {
          where: { sessionId: id, selected: true },
          order: { productId: 'ASC' },
        });
        for (const line of lines) {
          const product = await manager.findOne(Product, {
            where: { id: line.productId, vendor: { id: vendorId } },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !product ||
            product.status === 'trash' ||
            line.counted === null ||
            inventoryConflict(line, product)
          )
            throw new ConflictException(
              `El producto ${product?.title || line.productId} cambió durante el conteo. Revisa las diferencias antes de confirmar.`,
            );
          product.stock = line.counted;
          await manager.save(product);
          line.appliedStock = line.counted;
          await manager.save(line);
          await manager.save(
            InventoryStockSync,
            manager.create(InventoryStockSync, {
              id: line.id,
              sessionId: id,
              productId: product.id,
              vendorId,
              status: 'pending',
              attempts: 0,
            }),
          );
          changed.push(product.id);
        }
        session.completedAt = new Date();
      }
      if (status === 'cancelled') session.completedAt = new Date();
      if (['completed', 'cancelled'].includes(status))
        session.completedBy = userId;
      session.status = status;
      return manager.save(session);
    });
    return {
      session: result,
      adjusted: changed.length,
      queued: changed.length,
    };
  }
}
