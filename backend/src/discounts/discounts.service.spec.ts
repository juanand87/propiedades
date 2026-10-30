import { DiscountsService } from './discounts.service';
import { DiscountCode, DiscountUse } from './discount.entity';
import { Order } from '../orders/order.entity';

describe('discount checkout validation', () => {
  const code = {
    id: 'coupon',
    code: 'TEST10',
    status: 'active',
    startsAt: new Date(Date.now() - 10000),
    expiresAt: new Date(Date.now() + 86400000),
    percentage: 10,
    minPurchase: 0,
    maxDiscount: null,
    maxUses: 2,
    categoryIds: [],
    genreIds: [],
    productIds: [],
    vendorId: 'store',
    customerEmail: 'buyer@example.com',
    reviewId: 'review',
    acceptedAt: new Date(),
  };
  const product = {
    id: 'product',
    vendor: { id: 'store' },
    status: 'active',
    stock: 3,
    price: 10000,
    isOnSale: false,
    categories: [],
    genres: [],
  };
  const data = {
    code: 'test10',
    email: 'BUYER@example.com',
    vendorId: 'store',
    items: [{ productId: 'product', quantity: 2, price: 1 }],
  };
  let manager: any;
  let service: DiscountsService;
  beforeEach(() => {
    manager = {
      findOneBy: jest
        .fn()
        .mockResolvedValueOnce({ ...code })
        .mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([{ ...product }]),
      countBy: jest.fn().mockResolvedValue(0),
    };
    service = new DiscountsService({} as any, {} as any, { manager } as any);
  });
  it('uses database prices instead of customer supplied prices', async () => {
    const result = await service.quote(data);
    expect(result.subtotal).toBe(20000);
    expect(result.discountAmount).toBe(2000);
    expect(result.discountedSubtotal).toBe(18000);
  });
  it('rejects a compensation code belonging to a different email', async () => {
    await expect(
      service.quote({ ...data, email: 'other@example.com' }),
    ).rejects.toThrow('otro comprador');
  });
  it('rejects use before acceptance and codes from other stores', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce({ ...code, acceptedAt: null });
    await expect(service.quote(data)).rejects.toThrow('Activa primero');
    manager.findOneBy.mockReset().mockResolvedValueOnce(code);
    await expect(
      service.quote({ ...data, vendorId: 'other-store' }),
    ).rejects.toThrow('otra tienda');
  });
  it('rejects unavailable stock and exhausted campaigns', async () => {
    manager.find.mockResolvedValue([{ ...product, stock: 1 }]);
    await expect(service.quote(data)).rejects.toThrow('no disponibles');
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce(code)
      .mockResolvedValue(null);
    manager.find.mockResolvedValue([product]);
    manager.countBy.mockResolvedValue(2);
    await expect(service.quote(data)).rejects.toThrow('agotó');
  });
  it('rejects a second order but permits retrying the original order', async () => {
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce(code)
      .mockResolvedValue({ orderId: 'original' });
    await expect(service.quote(data)).rejects.toThrow('Ya utilizaste');
    manager.findOneBy
      .mockReset()
      .mockResolvedValueOnce(code)
      .mockResolvedValue({ orderId: 'original' });
    await expect(
      service.quote({ ...data, orderId: 'original' }),
    ).resolves.toMatchObject({ discountAmount: 2000 });
  });
});

describe('discount reservation and payment amounts', () => {
  it('reserves under a lock and keeps shipping outside the discount', async () => {
    const order = {
      id: 'order',
      subtotal: 10000,
      total: 12000,
      shippingCost: 2000,
      tax: 0,
      commissionPercentage: 10,
    };
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 'code' }),
      findOneBy: jest.fn().mockResolvedValue(null),
      findOneByOrFail: jest.fn().mockResolvedValue(order),
      create: jest.fn((_type, value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const db = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new DiscountsService({} as any, {} as any, db as any);
    jest
      .spyOn(service, 'quote')
      .mockResolvedValue({
        code: 'TEST10',
        discountId: 'code',
        percentage: 10,
        subtotal: 10000,
        discountAmount: 1000,
        discountedSubtotal: 9000,
        prices: [],
      });
    await service.reserve(
      { code: 'TEST10', email: 'buyer@example.com' },
      'order',
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      DiscountCode,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      DiscountUse,
      expect.objectContaining({ orderId: 'order', amount: 1000 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      Order,
      expect.objectContaining({
        subtotal: 9000,
        total: 11000,
        shippingCost: 2000,
        commissionAmount: 900,
        vendorAmount: 8100,
      }),
    );
  });

  it('does not save a use or a discounted order when validation fails', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 'code' }),
      save: jest.fn(),
    };
    const service = new DiscountsService(
      {} as any,
      {} as any,
      { transaction: (callback: any) => callback(manager) } as any,
    );
    jest
      .spyOn(service, 'quote')
      .mockRejectedValue(new Error('El código agotó sus usos'));
    await expect(service.reserve({ code: 'TEST10' }, 'order')).rejects.toThrow(
      'agotó',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });
});
