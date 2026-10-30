import { OrdersService } from './orders.service';
import { VendorsService } from '../vendors/vendors.service';

describe('assisted sale commission', () => {
  let service: any;
  let settings: any;
  const vendor = { id: 'store', slug: 'store' };
  beforeEach(() => {
    settings = { assistedCommissionPercentage: 5 };
    service = Object.create(OrdersService.prototype);
    const query: any = { getMany: jest.fn().mockResolvedValue([{ id: 'record', vendor, stock: 10, price: 10000 }]) };
    for (const method of ['leftJoinAndSelect', 'where']) query[method] = jest.fn(() => query);
    service.productsRepository = { createQueryBuilder: () => query };
    service.vendorSettingsRepository = { findOne: async () => settings };
    service.create = jest.fn().mockResolvedValue({ id: 'order' });
    service.ordersRepository = { save: jest.fn() };
    service.findOne = jest.fn(async () => service.ordersRepository.save.mock.calls[0][0]);
  });
  const create = (service: any, quantity = 3) => service.createAssistedOrder({ items: [{ productId: 'record', quantity }] }, vendor);

  it('keeps existing percentage settings and rounds CLP', async () => {
    const order = await create(service);
    expect(order.commissionAmount).toBe(1500);
    expect(order.commissionPercentage).toBe(5);
    expect(JSON.parse(order.splitDetails).assistedCommissionType).toBe('percentage');
  });
  it.each([1, 3])('charges the fixed fee once for %i units', async quantity => {
    settings = { assistedCommissionType: 'fixed', assistedCommissionFixedAmount: 1200, assistedCommissionPercentage: 5 };
    const order = await create(service, quantity);
    expect(order.commissionAmount).toBe(1200);
    expect(order.marketplaceCommission).toBe(1200);
    expect(order.vendorAmount).toBe(quantity * 10000 - 1200);
    expect(order.commissionPercentage).toBe(0);
    expect(JSON.parse(order.splitDetails).assistedCommissionType).toBe('fixed');
  });
  it('allows a zero fixed fee', async () => {
    settings = { assistedCommissionType: 'fixed', assistedCommissionFixedAmount: 0 };
    expect((await create(service)).commissionAmount).toBe(0);
  });
  it('charges the stored fee after settings change and adds shipping separately', async () => {
    service.findOneForVendor = async () => ({ id: 'order', status: 'paid', customerTransferConfirmedAt: new Date(), orderSource: 'assisted_sale', commissionAmount: 1200, commissionPercentage: 0, subtotal: 30000, enviaCarrier: 'carrier', enviaService: 'service', enviaQuotedPrice: 4000, splitDetails: JSON.stringify({ assistedCommissionType: 'fixed' }) });
    service.vendorsRepository = { findOne: async () => vendor };
    service.paykuService = { createMarketplaceTransaction: jest.fn().mockResolvedValue({ url: 'https://example.com/pay', transactionId: 'transaction' }) };
    service.addHistory = jest.fn();
    const result = await service.confirmAssistedTransfer('order', 'store', { transferReference: '123' });
    expect(result.chargeAmount).toBe(5200);
    expect(JSON.parse(result.order.splitDetails).assistedCommissionType).toBe('fixed');
    expect(service.paykuService.createMarketplaceTransaction).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 5200 }));
  });
});

describe('admin assisted commission validation', () => {
  const service: any = Object.create(VendorsService.prototype);
  service.vendorsRepository = { findOne: async () => ({ settings: {} }) };
  service.settingsRepository = { save: jest.fn() };
  it.each([
    { assistedCommissionType: 'invalid' },
    { assistedCommissionFixedAmount: -1 },
    { assistedCommissionFixedAmount: 1.5 },
    { assistedCommissionFixedAmount: null },
    { assistedCommissionPercentage: 101 },
    { assistedCommissionPercentage: Number.NaN },
  ])('rejects invalid settings %j', async settings => {
    await expect(service.updateVendorSettings('store', settings)).rejects.toThrow();
  });
  it('saves both commission modes without changing other settings', async () => {
    await service.updateVendorSettings('store', { assistedCommissionType: 'fixed', assistedCommissionFixedAmount: 1500 });
    expect(service.settingsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ assistedCommissionType: 'fixed', assistedCommissionFixedAmount: 1500 }));
  });
});
