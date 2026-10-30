import { canCompleteVendorManagedShipping, canVendorCancelOrder, getExternalShippingReleaseAmount, getVendorSettlement } from './vendor-settlement';
import { Order, OrderStatus } from './order.entity';

describe('MundoBeat transfers for assisted sales', () => {
  const sale: Partial<Order> = { orderSource: 'assisted_sale', status: OrderStatus.PROCESSING, vendorAmount: 6300 };
  it('does not owe the proceeds collected directly by the store', () => {
    expect(getVendorSettlement(sale)).toMatchObject({ marketplaceAmount: 0, transferStatus: 'not_applicable' });
  });
  it('owes only the recorded commission and shipping reimbursement on cancellation', () => {
    expect(getVendorSettlement({ ...sale, status: OrderStatus.CANCELLED, assistedReimbursementStatus: 'pending_payment', assistedReimbursementAmount: 4996 })).toMatchObject({ marketplaceAmount: 4996, transferStatus: 'pending' });
  });
  it('does not reimburse unpaid platform charges', () => {
    expect(getVendorSettlement({ ...sale, status: OrderStatus.CANCELLED, assistedReimbursementStatus: 'not_required' }).marketplaceAmount).toBe(0);
  });
  it('keeps shipping cancellation pending and does not invent a shipping refund', () => {
    expect(getVendorSettlement({ ...sale, status: OrderStatus.CANCELLED, assistedReimbursementStatus: 'pending_shipping_cancellation', assistedReimbursementAmount: 700 })).toMatchObject({ marketplaceAmount: 700, transferStatus: 'pending_shipping_cancellation' });
  });
  it('retains the reimbursement amount after transfer', () => {
    expect(getVendorSettlement({ ...sale, status: OrderStatus.CANCELLED, assistedReimbursementStatus: 'paid', assistedReimbursementAmount: 4996, vendorPaymentId: 'payment' })).toMatchObject({ marketplaceAmount: 4996, transferStatus: 'transferred' });
  });
  it('preserves ordinary cancellations with operational costs deducted', () => {
    expect(getVendorSettlement({ orderSource: 'marketplace', status: OrderStatus.CANCELLED, vendorAmount: 11927 }).marketplaceAmount).toBe(11927);
  });
});

describe('external shipping payout release', () => {
  const order: Partial<Order> = {
    shippingHandledBy: 'vendor',
    shippingCost: 4296,
    externalShippingPayoutAmount: 4296,
    externalShippingPayoutStatus: 'pending_delivery',
  };

  it('keeps the shipping amount retained while the order is shipped', () => {
    expect(getExternalShippingReleaseAmount(order, OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(0);
  });

  it('releases the charged shipping amount when delivery is confirmed', () => {
    expect(getExternalShippingReleaseAmount(order, OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(4296);
  });

  it('does not release the shipping amount a second time', () => {
    expect(getExternalShippingReleaseAmount(
      { ...order, externalShippingPayoutStatus: 'eligible' },
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
    )).toBe(0);
  });
});

describe('vendor-managed delivery confirmation', () => {
  const order: Partial<Order> = {
    status: OrderStatus.SHIPPED,
    shippingHandledBy: 'vendor',
    externalShippingCarrier: 'Starken',
    trackingNumber: '279980667',
  };

  it('allows completion after courier and tracking were registered', () => {
    expect(canCompleteVendorManagedShipping(order)).toBe(true);
  });

  it('rejects orders without manual tracking', () => {
    expect(canCompleteVendorManagedShipping({ ...order, trackingNumber: '' })).toBe(false);
  });

  it('rejects Envia.com and already delivered orders', () => {
    expect(canCompleteVendorManagedShipping({ ...order, shippingHandledBy: null })).toBe(false);
    expect(canCompleteVendorManagedShipping({ ...order, status: OrderStatus.DELIVERED })).toBe(false);
  });
});

describe('vendor cancellation rules', () => {
  it.each([OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.PROCESSING])(
    'allows cancellation before dispatch in status %s',
    (status) => expect(canVendorCancelOrder({ status })).toBe(true),
  );

  it.each([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REFUNDED])(
    'blocks cancellation in status %s',
    (status) => expect(canVendorCancelOrder({ status })).toBe(false),
  );

  it('blocks cancellation after a label or manual tracking is registered', () => {
    expect(canVendorCancelOrder({ status: OrderStatus.PROCESSING, enviaLabelUrl: 'label.pdf' })).toBe(false);
    expect(canVendorCancelOrder({ status: OrderStatus.PROCESSING, trackingNumber: '279980667' })).toBe(false);
    expect(canVendorCancelOrder({ status: OrderStatus.PROCESSING, externalShippingCarrier: 'Starken' })).toBe(false);
    expect(canVendorCancelOrder({ status: OrderStatus.PROCESSING }, true)).toBe(false);
  });
});
