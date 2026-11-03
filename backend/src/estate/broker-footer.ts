import { BadRequestException } from '@nestjs/common';

export const BROKER_SOCIAL_DOMAINS: Record<string, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
  linkedin: ['linkedin.com', 'www.linkedin.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
};
export function defaultBrokerFooter() {
  return {
    footer_text: null as string | null,
    footer_contact_title: 'Hablemos de tu próximo lugar',
    footer_note: '',
    footer_contact: null as {
      phone: string;
      whatsapp: string;
      email: string;
    } | null,
    footer_socials: [] as { network: string; url: string }[],
  };
}
export function validateBrokerFooter(b: any) {
  const d = defaultBrokerFooter();
  for (const [key, max] of [
    ['footer_text', 600],
    ['footer_contact_title', 100],
    ['footer_note', 200],
  ] as const) {
    const value = b[key];
    if (value === undefined || (key === 'footer_text' && value === null))
      continue;
    if (typeof value !== 'string' || value.trim().length > max)
      throw new BadRequestException(
        'Revisa la longitud de los textos del footer.',
      );
    d[key] = value.trim();
  }
  if (b.footer_contact !== undefined && b.footer_contact !== null) {
    const c = b.footer_contact;
    if (typeof c !== 'object' || Array.isArray(c))
      throw new BadRequestException('Contacto del sitio inválido.');
    const contact = { phone: '', whatsapp: '', email: '' };
    for (const key of ['phone', 'whatsapp', 'email'] as const) {
      if (c[key] !== undefined && typeof c[key] !== 'string')
        throw new BadRequestException(
          'Revisa los datos de contacto del sitio.',
        );
      contact[key] = (c[key] || '').trim();
    }
    for (const key of ['phone', 'whatsapp'] as const) {
      const value = contact[key],
        digits = value.replace(/\D/g, '');
      if (
        value &&
        (value.length > 40 ||
          !/^[+\d ()-]+$/.test(value) ||
          digits.length < 6 ||
          digits.length > 15)
      )
        throw new BadRequestException(
          'Usa un teléfono válido, incluyendo el código de país para WhatsApp.',
        );
    }
    if (
      contact.email &&
      (contact.email.length > 190 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
    )
      throw new BadRequestException('El correo de contacto no es válido.');
    d.footer_contact = contact;
  }
  if (b.footer_socials !== undefined) {
    if (!Array.isArray(b.footer_socials) || b.footer_socials.length > 6)
      throw new BadRequestException(
        'Puedes publicar hasta seis redes sociales.',
      );
    const seen = new Set<string>();
    d.footer_socials = b.footer_socials.map((social: any) => {
      if (
        !social ||
        typeof social.network !== 'string' ||
        !Object.hasOwn(BROKER_SOCIAL_DOMAINS, social.network) ||
        seen.has(social.network) ||
        typeof social.url !== 'string' ||
        social.url.length > 500
      )
        throw new BadRequestException('Revisa las redes sociales del footer.');
      seen.add(social.network);
      let url: URL;
      try {
        url = new URL(social.url.trim());
      } catch {
        throw new BadRequestException(
          'Usa enlaces completos de redes sociales con https://.',
        );
      }
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !BROKER_SOCIAL_DOMAINS[social.network].includes(url.hostname)
      )
        throw new BadRequestException(
          'El enlace debe ser HTTPS y pertenecer a la red social seleccionada.',
        );
      return { network: social.network, url: url.href };
    });
  }
  return d;
}
