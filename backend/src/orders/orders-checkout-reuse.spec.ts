import { OrdersService } from './orders.service';
import { OrderStatus } from './order.entity';

describe('checkout pending order lookup', () => {
  let service: any;
  let query: any;
  let repository: any;

  beforeEach(() => {
    query = {};
    for (const method of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy'])
      query[method] = jest.fn(() => query);
    query.getOne = jest.fn().mockResolvedValue({ id: 'pending-order' });
    repository = { createQueryBuilder: jest.fn(() => query) };
    service = Object.create(OrdersService.prototype);
    service.ordersRepository = repository;
  });

  it('compares discount and order IDs using the same explicit collation', async () => {
    const result = await service.findRecentPendingReusableOrder(
      { vendorId: 'store', email: ' Buyer@Example.com ' }, 'marketplace', 4,
    );
    expect(result).toEqual({ id: 'pending-order' });
    expect(query.andWhere).toHaveBeenCalledWith(
      'NOT EXISTS (SELECT 1 FROM discount_uses discount_use WHERE discount_use.orderId COLLATE utf8mb4_unicode_ci = order.id COLLATE utf8mb4_unicode_ci)',
    );
    expect(query.where).toHaveBeenCalledWith('order.vendorId = :vendorId', { vendorId: 'store' });
    expect(query.andWhere).toHaveBeenCalledWith('order.orderSource = :orderSource', { orderSource: 'marketplace' });
    expect(query.andWhere).toHaveBeenCalledWith('order.status = :status', { status: OrderStatus.PENDING });
    expect(query.andWhere).toHaveBeenCalledWith('LOWER(order.customerEmail) = :customerEmail', { customerEmail: 'buyer@example.com' });
    expect(query.andWhere).toHaveBeenCalledWith('order.createdAt >= :reuseSince', { reuseSince: expect.any(Date) });
    expect(query.orderBy).toHaveBeenCalledWith('order.createdAt', 'DESC');
  });

  it('returns null when no eligible pending order exists', async () => {
    query.getOne.mockResolvedValue(null);
    await expect(service.findRecentPendingReusableOrder(
      { vendorId: 'store', email: 'buyer@example.com' }, 'marketplace', 4,
    )).resolves.toBeNull();
  });

  it('does not search for a reusable order without a buyer email', async () => {
    await expect(service.findRecentPendingReusableOrder(
      { vendorId: 'store', email: ' ' }, 'marketplace', 4,
    )).resolves.toBeNull();
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does not hide other database errors', async () => {
    query.getOne.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.findRecentPendingReusableOrder(
      { vendorId: 'store', email: 'buyer@example.com' }, 'marketplace', 4,
    )).rejects.toThrow('Database unavailable');
  });
});
