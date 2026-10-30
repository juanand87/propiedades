import { BadRequestException } from '@nestjs/common';

export function validateSalesReceiptUrl(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.length > 4096) throw new Error();
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new BadRequestException('La boleta debe tener un enlace web HTTP o HTTPS válido');
  }
}
