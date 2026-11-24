import { BadRequestException, ForbiddenException } from '@nestjs/common';
export function invitationToken(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new BadRequestException('Invitación inválida.');
  return value;
}
export function invitedEmail(account: string, invited: string) {
  if (account.trim().toLowerCase() !== invited.trim().toLowerCase())
    throw new ForbiddenException(
      'Inicia sesión con el correo al que se envió la invitación.',
    );
}
const editable = new Set([
  'title',
  'description',
  'price_amount',
  'price_unit',
  'bedrooms',
  'bathrooms',
  'built_area',
  'land_area',
  'parking',
  'neighborhood',
]);
export function proposalChanges(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Cambios inválidos.');
  const entries = Object.entries(input);
  if (!entries.length || entries.length > editable.size)
    throw new BadRequestException('Indica los cambios.');
  for (const [key, value] of entries) {
    if (
      !editable.has(key) ||
      !(
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number'
      ) ||
      (typeof value === 'number' && !Number.isFinite(value)) ||
      (typeof value === 'string' &&
        value.length > (key === 'description' ? 10000 : 200))
    )
      throw new BadRequestException(
        'Solo puedes modificar los datos descriptivos autorizados.',
      );
  }
  return Object.fromEntries(entries) as Record<string, string | number | null>;
}
