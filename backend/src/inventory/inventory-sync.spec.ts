import { InventorySyncService } from './inventory-sync.service';

describe('durable inventory channel sync', () => {
  let repository: any,
    service: InventorySyncService,
    products: any,
    jobs: any[];
  beforeEach(() => {
    jobs = [
      { id: 'line', productId: 'product', vendorId: 'vendor', attempts: 0 },
    ];
    repository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn(async () => jobs),
    };
    products = { syncInventoryStock: jest.fn().mockResolvedValue(undefined) };
    service = new InventorySyncService(
      { getRepository: () => repository } as any,
      { ready: async () => true } as any,
      products,
    );
  });
  it('claims the persisted job and processes current product stock', async () => {
    await service.work();
    expect(products.syncInventoryStock).toHaveBeenCalledWith(
      'product',
      'vendor',
    );
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'line', status: 'pending' }),
      expect.objectContaining({ status: 'processing' }),
    );
    expect(repository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'line', status: 'processing' }),
      { status: 'processed', error: null },
    );
  });
  it('does not process a job claimed by another worker', async () => {
    repository.update.mockResolvedValue({ affected: 0 });
    await service.work();
    expect(products.syncInventoryStock).not.toHaveBeenCalled();
  });
  it('keeps failures pending and stops after three unexpected errors', async () => {
    products.syncInventoryStock.mockRejectedValue(
      new Error('Temporary integration failure'),
    );
    await service.work();
    expect(repository.update).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'pending',
      error: 'Temporary integration failure',
    });
    jobs[0].attempts = 2;
    await service.work();
    expect(repository.update).toHaveBeenLastCalledWith(expect.anything(), {
      status: 'failed',
      error: 'Temporary integration failure',
    });
  });
});
