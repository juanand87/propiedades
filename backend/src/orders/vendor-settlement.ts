import { OrderStatus, type Order } from './order.entity';

export function canCompleteVendorManagedShipping(order: Partial<Order>) {
  return order.shippingHandledBy === 'vendor'
    && order.status === OrderStatus.SHIPPED
    && Boolean(String(order.externalShippingCarrier || '').trim())
    && Boolean(String(order.trackingNumber || '').trim());
}

export function canVendorCancelOrder(order: Partial<Order>, hasLinkedShipment = false) {
  const cancellableStatuses: Array<OrderStatus | string> = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
  ];
  const hasShippingCommitment = Boolean(
    order.enviaLabelUrl
    || order.enviaTrackingNumber
    || order.enviaShipmentId
    || order.trackingNumber
    || order.externalShippingCarrier
    || order.shippingHandledBy === 'vendor'
    || hasLinkedShipment,
  );
  return cancellableStatuses.includes(String(order.status)) && !hasShippingCommitment;
}

export function getExternalShippingReleaseAmount(
  order: Partial<Order>,
  previousStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  if (
    nextStatus !== OrderStatus.DELIVERED
    || previousStatus === OrderStatus.DELIVERED
    || order.shippingHandledBy !== 'vendor'
    || order.externalShippingPayoutStatus !== 'pending_delivery'
  ) return 0;
  return Math.max(0, Number(order.externalShippingPayoutAmount ?? order.shippingCost) || 0);
}

/** Amount owed by MundoBeat, independent of the original sale and Payku settlement. */
export function getVendorSettlement(order: Partial<Order>) {
  const assisted = order.orderSource === 'assisted_sale';
  const reimbursement = assisted && order.status === 'cancelled';
  const amount = assisted
    ? reimbursement && ['pending_payment', 'pending_shipping_cancellation', 'paid'].includes(order.assistedReimbursementStatus || '')
      ? Number(order.assistedReimbursementAmount) || 0
      : 0
    : Number(order.vendorAmount) || 0;
  return {
    marketplaceAmount: amount,
    settlementConcept: assisted ? reimbursement ? 'assisted_reimbursement' : 'direct_collection' : 'sale_settlement',
    transferStatus: assisted && amount === 0
      ? 'not_applicable'
      : order.vendorPaymentId ? 'transferred'
        : reimbursement && order.assistedReimbursementStatus === 'pending_shipping_cancellation'
          ? 'pending_shipping_cancellation' : 'pending',
  };
}
