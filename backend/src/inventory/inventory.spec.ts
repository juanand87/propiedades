import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  InventoryCover,
  InventoryEvent,
  InventoryFound,
  InventoryLine,
  InventorySession,
  InventoryStockSync,
} from './inventory.entity';
import { InventoryService } from './inventory.service';
import {
  inventoryConflict,
  cosineSimilarity,
  embeddingStorage,
} from './inventory-rules';
import { Product } from '../products/product.entity';
import { InventorySetupService } from './inventory-setup.service';

describe('inventory metadata and numeric rules', () => {
  it('validates all new entities with the MySQL driver without connecting', async () => {
    const db = new DataSource({
      type: 'mysql',
      database: 'metadata_test',
      entities: [
        InventorySession,
        InventoryLine,
        InventoryFound,
        InventoryEvent,
        InventoryCover,
        InventoryStockSync,
      ],
      synchronize: false,
    });
    await expect((db as any).buildMetadatas()).resolves.toBeUndefined();
    expect(
      db.getMetadata(InventoryLine).findColumnWithPropertyName('counted')
        ?.isNullable,
    ).toBe(true);
    expect(
      db.getMetadata(InventoryFound).findColumnWithPropertyName('productId')
        ?.type,
    ).toBe('varchar');
  });
  it('detects stock changes and changes even if stock later returns to its old value', () => {
    const line = {
      snapshotStock: 2,
      snapshotUpdatedAt: '2026-10-17T12:00:00Z',
    };
    expect(
      inventoryConflict(line, { stock: 2, updatedAt: line.snapshotUpdatedAt }),
    ).toBe(false);
    expect(
      inventoryConflict(line, { stock: 1, updatedAt: line.snapshotUpdatedAt }),
    ).toBe(true);
    expect(
      inventoryConflict(line, { stock: 2, updatedAt: '2026-10-17T12:01:00Z' }),
    ).toBe(true);
  });
  it('compares embeddings defensively and does not treat similarity as probability', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(-1);
    expect(cosineSimilarity([NaN], [1])).toBe(-1);
    expect(cosineSimilarity([0], [1])).toBe(-1);
  });
  it('stores a cover embedding in 2048 bytes using portable float32 encoding', () => {
    const vector = Array.from({ length: 512 }, (_, i) => Math.sin(i));
    const encoded = embeddingStorage.to(vector)!;
    expect(encoded.length).toBe(2048);
    expect(
      cosineSimilarity(vector, embeddingStorage.from(encoded)!),
    ).toBeCloseTo(1, 6);
    expect(embeddingStorage.from(Buffer.alloc(3))).toEqual([]);
    expect(embeddingStorage.from(null)).toBeNull();
  });
});

describe('inventory counting and closing', () => {
  let manager: any,
    service: InventoryService,
    session: any,
    product: any,
    line: any,
    event: any,
    found: any,
    sync: any;
  const requestId = '11111111-1111-4111-8111-111111111111';
  beforeEach(() => {
    session = { id: 'session', vendorId: 'vendor', status: 'counting' };
    product = {
      id: 'product',
      title: 'Album',
      vendor: { id: 'vendor' },
      stock: 4,
      status: 'active',
      updatedAt: new Date('2026-10-17T12:00:00Z'),
    };
    line = {
      id: 'line',
      sessionId: 'session',
      productId: 'product',
      counted: null,
      snapshotStock: 4,
      snapshotUpdatedAt: product.updatedAt,
      selected: false,
    };
    event = null;
    found = {
      id: 'found',
      sessionId: 'session',
      quantity: 2,
      status: 'pending',
    };
    manager = {
      findOne: jest.fn(async (entity, options) => {
        if (entity === InventorySession)
          return options.where.vendorId === session.vendorId ? session : null;
        if (entity === Product)
          return options.where.vendor.id === product.vendor.id ? product : null;
        return null;
      }),
      findOneBy: jest.fn(async (entity) =>
        entity === InventoryEvent
          ? event
          : entity === InventoryFound
            ? found
            : line,
      ),
      create: jest.fn((entity, value) => Object.assign(new entity(), value)),
      save: jest.fn(async (...args) => {
        const value = args[args.length - 1];
        if (args[0] === InventoryEvent) event = value;
        return value;
      }),
      countBy: jest.fn().mockResolvedValue(0),
      find: jest.fn(async () => (line.selected ? [line] : [])),
    };
    sync = { syncInventoryStock: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryService(
      { transaction: (callback) => callback(manager), manager } as any,
      {} as any,
      { requireReady: async () => {} } as any,
    );
  });
  it('counts physical stock without changing sale stock; repeated request is idempotent', async () => {
    const data = { productId: 'product', quantity: 1, mode: 'add', requestId };
    await service.count('vendor', 'session', 'user', data);
    await service.count('vendor', 'session', 'user', data);
    expect(line.counted).toBe(1);
    expect(product.stock).toBe(4);
    expect(sync.syncInventoryStock).not.toHaveBeenCalled();
    expect(manager.findOne).toHaveBeenCalledWith(
      InventorySession,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });
  it('preserves counted zero and rejects negative or fractional counts', async () => {
    await service.count('vendor', 'session', 'user', {
      productId: 'product',
      quantity: 0,
      mode: 'set',
      requestId,
    });
    expect(line.counted).toBe(0);
    await expect(
      service.count('vendor', 'session', 'user', {
        quantity: -1,
        mode: 'set',
        requestId,
      }),
    ).rejects.toThrow('Cantidad inválida');
    await expect(
      service.count('vendor', 'session', 'user', {
        quantity: 1.5,
        mode: 'add',
        requestId,
      }),
    ).rejects.toThrow('Cantidad inválida');
  });
  it('rejects a missing product instead of querying the first product in a store', async () => {
    await expect(
      service.count('vendor', 'session', 'user', {
        quantity: 1,
        mode: 'add',
        requestId,
      }),
    ).rejects.toThrow('Producto inválido');
    await expect(
      service.resolveFound('vendor', 'session', 'found', 'user', {}),
    ).rejects.toThrow('Producto inválido');
  });
  it('does not reuse the same request for a different quantity', async () => {
    await service.count('vendor', 'session', 'user', {
      productId: 'product',
      quantity: 1,
      mode: 'add',
      requestId,
    });
    await expect(
      service.count('vendor', 'session', 'user', {
        productId: 'product',
        quantity: 2,
        mode: 'add',
        requestId,
      }),
    ).rejects.toThrow('ya utilizado');
  });
  it('rejects another store and closed counts', async () => {
    await expect(
      service.count('other', 'session', 'user', {
        quantity: 1,
        mode: 'add',
        requestId,
      }),
    ).rejects.toThrow('no encontrado');
    session.status = 'completed';
    await expect(
      service.count('vendor', 'session', 'user', {
        quantity: 1,
        mode: 'add',
        requestId,
      }),
    ).rejects.toThrow('cerrado');
  });
  it('does not select uncounted or conflicted products', async () => {
    await expect(
      service.reviewLine('vendor', 'session', 'product', { selected: true }),
    ).rejects.toThrow('Vuelve a revisar');
    line.counted = 2;
    product.stock = 3;
    await expect(
      service.reviewLine('vendor', 'session', 'product', { selected: true }),
    ).rejects.toThrow('Vuelve a revisar');
  });
  it('links unknown physical products only once', async () => {
    await service.resolveFound('vendor', 'session', 'found', 'user', {
      productId: 'product',
    });
    await service.resolveFound('vendor', 'session', 'found', 'user', {
      productId: 'product',
    });
    expect(line.counted).toBe(2);
    expect(found.status).toBe('linked');
    expect(product.stock).toBe(4);
  });
  it('requires a reason to dismiss an unidentified product', async () => {
    await expect(
      service.resolveFound('vendor', 'session', 'found', 'user', {
        dismiss: true,
      }),
    ).rejects.toThrow('Indica por qué');
  });
  it('requires review and no unresolved unknown products before closure', async () => {
    await expect(
      service.changeStatus('vendor', 'session', 'user', 'completed'),
    ).rejects.toThrow('Revisa los ajustes');
    session.status = 'review';
    manager.countBy.mockResolvedValue(1);
    await expect(
      service.changeStatus('vendor', 'session', 'user', 'completed'),
    ).rejects.toThrow('Resuelve');
  });
  it('refuses stale stock on closure before synchronizing', async () => {
    session.status = 'review';
    line.counted = 2;
    line.selected = true;
    product.stock = 3;
    await expect(
      service.changeStatus('vendor', 'session', 'user', 'completed'),
    ).rejects.toThrow('cambió durante');
    expect(sync.syncInventoryStock).not.toHaveBeenCalled();
    expect(product.stock).toBe(3);
  });
  it('applies only selected quantities, records actor and syncs after transaction', async () => {
    session.status = 'review';
    line.counted = 0;
    line.selected = true;
    const result = await service.changeStatus(
      'vendor',
      'session',
      'user',
      'completed',
    );
    expect(product.stock).toBe(0);
    expect(line.appliedStock).toBe(0);
    expect(result.adjusted).toBe(1);
    expect(session.completedBy).toBe('user');
    expect(manager.save).toHaveBeenCalledWith(
      InventoryStockSync,
      expect.objectContaining({
        productId: 'product',
        vendorId: 'vendor',
        status: 'pending',
      }),
    );
    expect(sync.syncInventoryStock).not.toHaveBeenCalled();
  });
  it('cancellation never applies differences', async () => {
    line.selected = true;
    line.counted = 0;
    await service.changeStatus('vendor', 'session', 'user', 'cancelled');
    expect(product.stock).toBe(4);
    expect(sync.syncInventoryStock).not.toHaveBeenCalled();
  });
});

describe('web inventory setup', () => {
  it('returns a precondition error, not server unavailability, before setup', async () => {
    const service = new InventorySetupService({
      query: async () => {
        throw Object.assign(new Error('Missing table'), {
          code: 'ER_NO_SUCH_TABLE',
        });
      },
    } as any);
    try {
      await service.requireReady();
      throw new Error('Expected preparation error');
    } catch (error) {
      expect(error.getStatus()).toBe(412);
      expect(error.message).toContain('pendiente de preparación');
    }
  });
  it('uses fixed DDL under an advisory lock and never changes product tables', async () => {
    const runner = {
      connect: jest.fn(),
      query: jest
        .fn()
        .mockImplementation(async (sql: string) =>
          sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [],
        ),
      release: jest.fn(),
    };
    const service = new InventorySetupService({
      createQueryRunner: () => runner,
      query: async () => [{ schemaVersion: 1 }],
    } as any);
    await service.install();
    expect(
      runner.query.mock.calls.some(([sql]) =>
        /CREATE TABLE IF NOT EXISTS inventory_lines/.test(sql),
      ),
    ).toBe(true);
    expect(
      runner.query.mock.calls.some(([sql]) =>
        /UPDATE products|DROP TABLE|DELETE FROM/.test(sql),
      ),
    ).toBe(false);
    expect(runner.release).toHaveBeenCalled();
  });
});
