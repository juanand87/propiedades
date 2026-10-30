import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type Actor = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  advertiser_id?: string;
  advertiser_status?: string;
};
export const text = (v: unknown, max = 255) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';
export function uploadName(value: unknown) {
  const raw = text(value, 400);
  if ([...raw].every((c) => c.charCodeAt(0) <= 255)) {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD')) return text(decoded, 180) || 'Fotografía';
  }
  return text(raw, 180) || 'Fotografía';
}
export const isAdmin = (u: Actor) => u.role === 'admin';
export function admin(u: Actor) {
  if (!isAdmin(u))
    throw new ForbiddenException('Acceso exclusivo de administración.');
}
export function uuid(v: unknown) {
  const s = text(v, 36);
  if (!/^[a-f0-9-]{36}$/i.test(s))
    throw new BadRequestException('Identificador inválido.');
  return s;
}
export function decimal(
  v: unknown,
  name: string,
  optional = true,
): string | null {
  if (v === '' || v === undefined || v === null) {
    if (optional) return null;
    throw new BadRequestException(`Falta ${name}.`);
  }
  const s = String(v);
  if (!/^\d{1,14}(\.\d{1,4})?$/.test(s) || Number(s) <= 0)
    throw new BadRequestException(
      `${name} debe ser un número positivo con hasta 4 decimales.`,
    );
  return s;
}
export function integer(v: unknown, max = 1000): number | null {
  if (v === '' || v === undefined || v === null) return null;
  if (!/^\d+$/.test(String(v)) || Number(v) > max)
    throw new BadRequestException('Cantidad fuera de rango.');
  return Number(v);
}
export function choice(v: unknown, options: string[], fallback?: string) {
  const s = text(v, 50) || fallback;
  if (!s || !options.includes(s))
    throw new BadRequestException('Opción inválida.');
  return s;
}
export function email(v: unknown) {
  const s = text(v).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new BadRequestException('Correo inválido.');
  return s;
}
export function ownership(u: Actor, advertiserId: string) {
  if (!isAdmin(u) && u.advertiser_id !== advertiserId)
    throw new ForbiddenException('Esta publicación no te pertenece.');
}
export function transition(current: string, next: string, u: Actor) {
  const allowed: Record<string, string[]> = {
    draft: ['pending_review', 'archived'],
    pending_review: ['draft', 'archived'],
    published: ['paused', 'archived'],
    paused: ['pending_review', 'archived'],
    rejected: ['draft', 'pending_review', 'archived'],
    archived: ['draft'],
  };
  if (
    isAdmin(u) &&
    ['published', 'rejected', 'paused', 'archived', 'draft'].includes(next)
  )
    return;
  if (!(allowed[current] || []).includes(next))
    throw new BadRequestException('Transición de publicación no permitida.');
}
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
