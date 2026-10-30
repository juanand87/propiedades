import { InventoryService } from './inventory.service';
import { InventoryEvent, InventoryLine, InventorySession, InventoryStockSync } from './inventory.entity';
import { Product } from '../products/product.entity';
import { inventoryConflict } from './inventory-rules';

describe('count and immediately add stock', () => {
  let service: InventoryService, manager: any, product: any, line: any, event: any;
  const request = { productId: 'album', mode: 'add-stock', quantity: 1,
    requestId: '00000000-0000-4000-8000-000000000001' };
  beforeEach(() => {
    const date = new Date('2026-10-17T12:00:00Z');
    product = { id: 'album', stock: 1, updatedAt: date, status: 'active' };
    line = { id: 'line', counted: 1, snapshotStock: 1, snapshotUpdatedAt: date };
    event = null;
    manager = {
      findOne: jest.fn(async (entity) => entity === Product ? product :
        entity === InventorySession ? { status: 'counting' } : null),
      findOneBy: jest.fn(async (entity) => entity === InventoryEvent ? event : line),
      create: jest.fn((entity, values) => ({ ...values })),
      save: jest.fn(async (entity, values) => {
        if (entity === InventoryEvent) event = values;
        if (entity === product) product.updatedAt = new Date('2026-10-17T12:01:00Z');
        return values ?? entity;
      }),
    };
    service = new InventoryService({ transaction: (fn) => fn(manager) } as any,
      {} as any, { requireReady: async () => {} } as any);
  });
  it.each([0, 1])('adds exactly one to stock %i and count, without leaving a final adjustment', async (stock) => {
    product.stock = line.snapshotStock = line.counted = stock;
    const result = await service.count('vendor', 'session', 'user', request);
    expect(result.stock).toBe(stock + 1);
    expect(result.counted).toBe(stock + 1);
    expect(line.snapshotStock).toBe(stock + 1);
    expect(inventoryConflict(line, product)).toBe(false);
    expect(line.selected).toBe(false);
    expect(manager.save).toHaveBeenCalledWith(InventoryStockSync, expect.objectContaining({
      id: request.requestId, status: 'pending', productId: 'album',
    }));
    expect(manager.findOne).toHaveBeenCalledWith(Product, expect.objectContaining({
      lock: { mode: 'pessimistic_write' },
    }));
  });
  it('does not repeat a committed operation on retry', async () => {
    await service.count('vendor', 'session', 'user', request);
    await service.count('vendor', 'session', 'user', request);
    expect(product.stock).toBe(2);
    expect(line.counted).toBe(2);
  });
  it('normal counting does not add stock', async () => {
    await service.count('vendor', 'session', 'user', { ...request, mode: 'add' });
    expect(product.stock).toBe(1);
    expect(line.counted).toBe(2);
  });
  it('rejects stock changed by a sale instead of overwriting it', async () => {
    product.stock = 0;
    await expect(service.count('vendor', 'session', 'user', request)).rejects.toThrow('El stock cambió');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('rejects stale red buttons when stock already covers the next unit', async () => {
    line.counted = 0;
    await expect(service.count('vendor', 'session', 'user', request)).rejects.toThrow('stock suficiente');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('only accepts a single unit for this command', async () => {
    await expect(service.count('vendor', 'session', 'user', { ...request, quantity: 2 })).rejects.toThrow('Cantidad');
  });
  it.each([0, 2, 5])('applies the physical total %i immediately and only once', async (counted) => {
    line.counted = counted;
    await service.reviewLine('vendor', 'session', 'album', { apply: true });
    expect(product.stock).toBe(counted);
    expect(line.snapshotStock).toBe(counted);
    expect(line.appliedStock).toBe(counted);
    expect(line.selected).toBe(false);
    expect(inventoryConflict(line, product)).toBe(false);
    const saves = manager.save.mock.calls.length;
    await service.reviewLine('vendor', 'session', 'album', { apply: true });
    expect(manager.save.mock.calls.length).toBe(saves + 1);
    expect(product.stock).toBe(counted);
  });
  it('does not apply an uncounted or conflicted product', async () => {
    line.counted = null;
    await expect(service.reviewLine('vendor', 'session', 'album', { apply: true })).rejects.toThrow('revisar');
    line.counted = 2;
    product.stock = 0;
    await expect(service.reviewLine('vendor', 'session', 'album', { apply: true })).rejects.toThrow('revisar');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
