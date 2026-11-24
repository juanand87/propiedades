import { BadRequestException } from '@nestjs/common';
import { visitInstant } from './visit-rules';
export const taskKinds = ['call', 'send_info', 'coordinate_visit', 'other'];
export function taskDeadline(date: unknown, time: unknown, now = Date.now()) {
  const result = visitInstant(date, time);
  if (result.getTime() <= now || result.getTime() > now + 365 * 86400000)
    throw new BadRequestException(
      'Selecciona una fecha y hora futuras, dentro de los próximos 365 días.',
    );
  return result;
}
