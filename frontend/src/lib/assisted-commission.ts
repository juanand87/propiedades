export function assistedCommissionLabel(order: { splitDetails?: unknown; commissionPercentage?: unknown }) {
  let details: any = order.splitDetails;
  try { if (typeof details === 'string') details = JSON.parse(details); } catch { details = null; }
  return details?.assistedCommissionType === 'fixed' ? 'Comisión fija por venta' : `Comisión (${Number(order.commissionPercentage) || 0}%)`;
}
