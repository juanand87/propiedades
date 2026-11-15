import { BadRequestException, ForbiddenException } from '@nestjs/common';
export type VisitState =
  | 'requested'
  | 'proposed'
  | 'confirmed'
  | 'cancelled'
  | 'rejected'
  | 'completed';
export const visitLabels: Record<VisitState, string> = {
  requested: 'Visita solicitada',
  proposed: 'Nuevo horario propuesto',
  confirmed: 'Visita confirmada',
  cancelled: 'Visita cancelada',
  rejected: 'Visita rechazada',
  completed: 'Visita realizada',
};
const format = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function santiagoParts(value: Date) {
  const p = Object.fromEntries(
    format.formatToParts(value).map((part) => [part.type, part.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function visitInstant(date: unknown, time: unknown) {
  if (
    typeof date !== 'string' ||
    typeof time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new BadRequestException('Selecciona una fecha y hora válidas.');
  const [y, m, d] = date.split('-').map(Number),
    [h, min] = time.split(':').map(Number),
    naive = Date.UTC(y, m - 1, d, h, min),
    check = new Date(naive);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  )
    throw new BadRequestException('La fecha no existe.');
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = naive + offset * 60000,
      p = santiagoParts(new Date(candidate));
    if (p.date === date && p.time === time) matches.push(candidate);
  }
  if (matches.length !== 1)
    throw new BadRequestException(
      'Ese horario coincide con un cambio de hora en Santiago. Selecciona otro horario.',
    );
  return new Date(matches[0]);
}
export const sqlVisitTime = (date: Date) =>
  date.toISOString().slice(0, 19).replace('T', ' ');
export function validateVisitWindow(date: Date, now = Date.now()) {
  if (date.getTime() < now + 3600000 || date.getTime() > now + 180 * 86400000)
    throw new BadRequestException(
      'Elige un horario entre una hora y 180 días desde ahora.',
    );
}
export function nextVisitState(
  state: VisitState,
  action: unknown,
  actorId: string,
  buyerId: string,
  sellerId: string,
  proposerId: string,
  isAdmin = false,
): VisitState {
  const participant = actorId === buyerId || actorId === sellerId;
  if (!participant && !(isAdmin && action === 'cancel'))
    throw new ForbiddenException('Esta visita no te pertenece.');
  if (
    action === 'cancel' &&
    ['requested', 'proposed', 'confirmed'].includes(state)
  )
    return 'cancelled';
  if (action === 'complete' && state === 'confirmed' && actorId === sellerId)
    return 'completed';
  if (['requested', 'proposed'].includes(state)) {
    if (action === 'propose' && participant) return 'proposed';
    if (action === 'accept' && actorId !== proposerId) return 'confirmed';
    if (action === 'reject' && actorId !== proposerId) return 'rejected';
  }
  throw new BadRequestException(
    'Esta acción no está disponible para el estado actual de la visita.',
  );
}
