/**
 * Formatea un precio en formato chileno: $20.000 (sin decimales)
 */
export function formatPrice(price: unknown): string {
  const amount = Number(price);
  const rounded = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$${rounded.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Formatea una moneda con prefijo
 */
export function formatCurrency(amount: unknown, currency: string = 'CLP'): string {
  const numericAmount = Number(amount);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericAmount) ? Math.round(numericAmount) : 0);
}
