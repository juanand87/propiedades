import { BadRequestException } from '@nestjs/common';
import { defaultDesign, validateDesign } from './site-design';

export const BROKER_SECTIONS = ['hero', 'about', 'listings', 'contact'];
export function defaultBrokerDesign(profile: any = {}) {
  return {
    ...defaultDesign(BROKER_SECTIONS),
    logo_media_id: profile.logo_media_id || null,
    hero_title: profile.display_name || 'Tu próximo lugar comienza aquí.',
    hero_subtitle: 'Propiedades, asesoría y atención personalizada.',
    about_title: 'Conócenos',
    about_text: profile.description || '',
    listings_title: 'Nuestras propiedades',
    contact_title: 'Conversemos',
  };
}
export function validateBrokerDesign(b: any) {
  const core = validateDesign(b, BROKER_SECTIONS);
  const fields: Record<string, number> = {
    hero_title: 180,
    hero_subtitle: 400,
    about_title: 100,
    about_text: 4000,
    listings_title: 100,
    contact_title: 100,
  };
  const content: Record<string, string> = {};
  for (const [key, max] of Object.entries(fields)) {
    if (typeof b[key] !== 'string' || b[key].trim().length > max)
      throw new BadRequestException(
        'Revisa la longitud de los textos del sitio.',
      );
    content[key] = b[key].trim();
    if (key !== 'about_text' && key !== 'hero_subtitle' && !content[key])
      throw new BadRequestException('Completa los títulos de las secciones.');
  }
  return {
    ...core,
    hero_title: content.hero_title,
    hero_subtitle: content.hero_subtitle,
    about_title: content.about_title,
    about_text: content.about_text,
    listings_title: content.listings_title,
    contact_title: content.contact_title,
  };
}
export function readBrokerDesign(value: unknown, profile: any) {
  try {
    return value
      ? validateBrokerDesign(
          typeof value === 'string' ? JSON.parse(value) : value,
        )
      : defaultBrokerDesign(profile);
  } catch {
    return defaultBrokerDesign(profile);
  }
}
