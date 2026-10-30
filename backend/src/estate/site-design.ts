import { BadRequestException } from '@nestjs/common';
import { uuid } from './rules';

export const HOME_SECTIONS = ['hero', 'search', 'types', 'listings', 'publish'];
export const defaultDesign = (sections = HOME_SECTIONS) => ({
  primary_color: '#285d50',
  accent_color: '#c9964e',
  background_color: '#f8f8f3',
  text_color: '#203e38',
  logo_media_id: null as string | null,
  hero_media_id: null as string | null,
  hero_alt: 'Propiedad destacada en la portada',
  show_site_name: true,
  sections: sections.map((id) => ({ id, visible: true })),
});
function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function validateDesign(b: any, sections = HOME_SECTIONS) {
  if (!b || typeof b !== 'object')
    throw new BadRequestException('Diseño inválido.');
  const d = defaultDesign(sections);
  for (const key of [
    'primary_color',
    'accent_color',
    'background_color',
    'text_color',
  ] as const) {
    if (typeof b[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(b[key]))
      throw new BadRequestException(
        'Usa colores hexadecimales de seis dígitos.',
      );
    d[key] = b[key].toLowerCase();
  }
  if (contrast(d.primary_color, '#ffffff') < 4.5)
    throw new BadRequestException(
      'El color principal debe contrastar con el texto blanco de los botones. Elige un tono más oscuro.',
    );
  if (
    contrast(d.text_color, d.background_color) < 4.5 ||
    contrast(d.text_color, '#ffffff') < 4.5
  )
    throw new BadRequestException(
      'El texto debe contrastar con el fondo y las tarjetas blancas. Elige un texto más oscuro o un fondo más claro.',
    );
  for (const key of ['logo_media_id', 'hero_media_id'] as const)
    d[key] = b[key] ? uuid(b[key]) : null;
  if (typeof b.hero_alt !== 'string' || b.hero_alt.trim().length > 200)
    throw new BadRequestException(
      'La descripción de portada debe tener hasta 200 caracteres.',
    );
  d.hero_alt = b.hero_alt.trim() || defaultDesign().hero_alt;
  if (typeof b.show_site_name !== 'boolean')
    throw new BadRequestException('Indica si se muestra el nombre de marca.');
  d.show_site_name = b.show_site_name;
  if (
    !Array.isArray(b.sections) ||
    b.sections.length !== sections.length ||
    new Set(b.sections.map((s) => s?.id)).size !== sections.length ||
    b.sections.some(
      (s) => !sections.includes(s?.id) || typeof s.visible !== 'boolean',
    ) ||
    !b.sections.some((s) => s.visible)
  )
    throw new BadRequestException(
      'Incluye todas las secciones una vez y conserva al menos una visible.',
    );
  d.sections = b.sections.map((s) => ({ id: s.id, visible: s.visible }));
  return d;
}
export function readDesign(value: unknown) {
  try {
    return value
      ? validateDesign(typeof value === 'string' ? JSON.parse(value) : value)
      : defaultDesign();
  } catch {
    return defaultDesign();
  }
}
