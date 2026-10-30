import { BadRequestException } from '@nestjs/common';
import { uuid } from './rules';

export const HOME_SECTIONS = ['hero', 'search', 'types', 'listings', 'publish'];
export const defaultDesign = (sections = HOME_SECTIONS) => ({
  primary_color: '#075ce5',
  accent_color: '#d9a553',
  background_color: '#f6f8fc',
  text_color: '#102b50',
  logo_media_id: null as string | null,
  hero_media_id: null as string | null,
  hero_alt: 'Propiedad destacada en la portada',
  hero_mode: 'image' as 'image' | 'slider',
  hero_slides: [] as { media_id: string; alt_text: string }[],
  hero_autoplay: true,
  hero_interval: 6,
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
  if (b.hero_mode !== undefined && !['image', 'slider'].includes(b.hero_mode))
    throw new BadRequestException(
      'Selecciona imagen o slider para la portada.',
    );
  d.hero_mode = b.hero_mode || 'image';
  if (b.hero_slides !== undefined) {
    if (!Array.isArray(b.hero_slides) || b.hero_slides.length > 8)
      throw new BadRequestException('El slider admite hasta 8 imágenes.');
    d.hero_slides = b.hero_slides.map((s) => {
      if (
        !s ||
        typeof s.alt_text !== 'string' ||
        s.alt_text.trim().length > 200
      )
        throw new BadRequestException(
          'Revisa los textos alternativos del slider.',
        );
      return {
        media_id: uuid(s.media_id),
        alt_text: s.alt_text.trim() || d.hero_alt,
      };
    });
    if (
      new Set(d.hero_slides.map((s) => s.media_id)).size !==
      d.hero_slides.length
    )
      throw new BadRequestException('No repitas imágenes en el slider.');
  }
  if (d.hero_mode === 'slider' && d.hero_slides.length < 2)
    throw new BadRequestException('Agrega al menos dos imágenes al slider.');
  if (b.hero_autoplay !== undefined && typeof b.hero_autoplay !== 'boolean')
    throw new BadRequestException(
      'La reproducción automática debe ser sí o no.',
    );
  d.hero_autoplay = b.hero_autoplay ?? true;
  if (
    b.hero_interval !== undefined &&
    (!Number.isInteger(b.hero_interval) ||
      b.hero_interval < 4 ||
      b.hero_interval > 12)
  )
    throw new BadRequestException(
      'El intervalo debe estar entre 4 y 12 segundos.',
    );
  d.hero_interval = b.hero_interval ?? 6;
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
export function designMediaIds(d: ReturnType<typeof defaultDesign>) {
  return [
    ...new Set(
      [
        d.logo_media_id,
        d.hero_media_id,
        ...d.hero_slides.map((s) => s.media_id),
      ].filter(Boolean),
    ),
  ] as string[];
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
