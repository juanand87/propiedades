import { InventoryService } from './inventory.service';
import { InventoryLine, InventorySession } from './inventory.entity';
import { Product } from '../products/product.entity';

describe('count totals returned with inventory search', () => {
  let service: InventoryService, lines: any, manager: any, products: any;
  beforeEach(() => {
    manager = {
      findOne: jest.fn(async (entity, options) =>
        entity === InventorySession && options.where.vendorId === 'vendor'
          ? { id: 'session', vendorId: 'vendor', status: 'counting' }
          : null,
      ),
    };
    lines = {
      find: jest.fn().mockResolvedValue([
        { productId: 'album', counted: 2 },
        { productId: 'zero', counted: null },
      ]),
    };
    const builder: any = {};
    for (const method of ['where', 'andWhere', 'orderBy', 'take'])
      builder[method] = jest.fn(() => builder);
    builder.getMany = jest.fn().mockResolvedValue([
      { id: 'album', stock: 1 },
      { id: 'zero', stock: 0 },
      { id: 'new', stock: 1 },
    ]);
    products = { createQueryBuilder: () => builder };
    const db = {
      manager,
      getRepository: jest.fn((entity) =>
        entity === InventoryLine ? lines : entity === Product ? products : null,
      ),
    };
    service = new InventoryService(
      db as any,
      {} as any,
      { requireReady: async () => {} } as any,
    );
  });
  it('returns persisted totals rather than totals from only the visible page', async () => {
    const result = await service.search('vendor', 'session', 'album');
    expect(
      result.map((product) => [product.id, product.inventoryCount]),
    ).toEqual([
      ['album', 2],
      ['zero', 0],
      ['new', 0],
    ]);
    expect(lines.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 'session' }),
        select: ['productId', 'counted'],
      }),
    );
  });
  it('rejects a count lookup belonging to another store', async () => {
    await expect(
      service.getCounts('other-store', 'session', ['album']),
    ).rejects.toThrow('Conteo no encontrado');
    expect(lines.find).not.toHaveBeenCalled();
  });
});
