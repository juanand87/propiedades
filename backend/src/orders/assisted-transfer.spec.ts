import { OrdersService } from './orders.service';
import { PaymentController } from '../payment/payment.controller';

describe('buyer payment for assisted sales', () => {
  let service: any;
  let order: any;
  beforeEach(() => {
    order = { id: 'order', status: 'pending', orderSource: 'assisted_sale', paymentStatus: 'customer_transfer_pending', assistedSaleStatus: 'awaiting_customer_transfer', commissionStatus: 'pending' };
    service = Object.create(OrdersService.prototype);
    service.findOneForVendor = jest.fn(async () => order);
    service.ordersRepository = { save: jest.fn(async value => value) };
    service.addHistory = jest.fn();
    service.updateStatus = jest.fn(async (_id, status) => { order.status = status; return order; });
  });
  it('marks only the buyer payment as received without creating a platform charge', async () => {
    const result = await service.receiveAssistedTransfer('order', 'store', { transferReference: ' 123 ' });
    expect(result.status).toBe('paid');
    expect(result.customerTransferReference).toBe('123');
    expect(result.customerTransferConfirmedAt).toBeInstanceOf(Date);
    expect(result.paymentStatus).toBe('customer_transfer_pending');
    expect(result.commissionStatus).toBe('pending');
    expect(service.updateStatus).not.toHaveBeenCalled();
  });
  it('does not duplicate confirmation history', async () => {
    await service.receiveAssistedTransfer('order', 'store', { transferReference: '123' });
    await service.receiveAssistedTransfer('order', 'store', { transferReference: '456' });
    expect(service.addHistory).toHaveBeenCalledTimes(1);
    expect(order.customerTransferReference).toBe('123');
  });
  it('recovers legacy pending orders with a recorded transfer', async () => {
    order.customerTransferConfirmedAt = new Date();
    await service.receiveAssistedTransfer('order', 'store', { transferReference: '123' });
    expect(order.status).toBe('paid');
  });
  it.each(['cancelled', 'delivered', 'shipped', 'refunded'])('rejects confirmation for %s orders', async status => {
    order.status = status;
    await expect(service.receiveAssistedTransfer('order', 'store', { transferReference: '123' })).rejects.toThrow();
  });
  it.each([{}, { transferReference: '' }, { transferReference: ' ' }])('accepts an omitted or empty optional reference %j', async dto => {
    const result = await service.receiveAssistedTransfer('order', 'store', dto);
    expect(result.status).toBe('paid');
    expect(result.customerTransferReference).toBeNull();
    expect(result.customerTransferConfirmedAt).toBeInstanceOf(Date);
  });
  it('rejects other sale types', async () => {
    order.orderSource = 'marketplace';
    await expect(service.receiveAssistedTransfer('order', 'store', { transferReference: '123' })).rejects.toThrow();
  });
  it('enforces vendor ownership', async () => {
    service.findOneForVendor.mockRejectedValue(new Error('Unauthorized'));
    await expect(service.receiveAssistedTransfer('order', 'another-store', { transferReference: '123' })).rejects.toThrow('Unauthorized');
    expect(service.ordersRepository.save).not.toHaveBeenCalled();
  });
  it('requires receipt confirmation before processing', async () => {
    await expect(service.startAssistedProcessing('order', 'store')).rejects.toThrow();
    await service.receiveAssistedTransfer('order', 'store', { transferReference: '123' });
    await service.startAssistedProcessing('order', 'store');
    await service.startAssistedProcessing('order', 'store');
    expect(order.status).toBe('processing');
    expect(service.updateStatus).toHaveBeenCalledTimes(1);
    expect(order.paymentStatus).toBe('customer_transfer_pending');
  });
});

describe('assisted platform payment callbacks', () => {
  it.each(['success', 'failed', 'cancelled'])('keeps preparation status on platform payment %s', async status => {
    const controller: any = Object.create(PaymentController.prototype);
    const order = { id: 'order', orderNumber: 'ORD-1', orderSource: 'assisted_sale', status: 'processing', total: 10000, paymentTransactionId: 'payment' };
    controller.ordersService = {
      findAll: jest.fn(async () => [order]), findOne: jest.fn(async () => order),
      update: jest.fn(), updateStatus: jest.fn(), addHistory: jest.fn(),
    };
    controller.paykuService = { getTransactionStatus: async () => ({ status, order: 'ORD-1' }) };
    const result = await controller.paykuWebhook('', { status, payment_key: 'payment', order: 'ORD-1' }, { headers: {}, connection: { remoteAddress: '35.188.95.14' } });
    expect(result.success).toBe(true);
    expect(order.status).toBe('processing');
    expect(controller.ordersService.updateStatus).not.toHaveBeenCalled();
  });
});
