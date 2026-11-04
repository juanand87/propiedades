import { BadRequestException } from '@nestjs/common';
export type HeaderLink = { label: string; href: string; new_tab: boolean };
export type HeaderOverlay = {
  enabled: boolean;
  cover_text_color: string;
  scroll_background_color: string;
  scroll_text_color: string;
};
export type HeaderStyle = {
  logo_height: number;
  height: number;
  background_color: string | null;
  text_color: string | null;
  hover_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
};
export function defaultHeader() {
  return {
    header_sticky: false,
    header_overlay: null as HeaderOverlay | null,
    header_shrink: false,
    header_shrink_percent: 75,
    header_style: null as HeaderStyle | null,
    header_links: null as HeaderLink[] | null,
    header_button: null as (HeaderLink & { visible: boolean }) | null,
  };
}
export function validateHeaderHref(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new BadRequestException('Revisa los destinos de la cabecera.');
  const href = value.trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    throw new BadRequestException('El enlace de la cabecera no es válido.');
  }
  if (
    /[\u0000-\u0020\u007f\\]/.test(href) ||
    /[\u0000-\u001f\u007f\\]/.test(decoded) ||
    href.startsWith('//') ||
    decoded.startsWith('//')
  )
    throw new BadRequestException(
      'Usa rutas del sitio o enlaces HTTPS completos en la cabecera.',
    );
  if (href.startsWith('#')) {
    if (!/^#[a-zA-Z0-9_-]+$/.test(href))
      throw new BadRequestException('El destino de la sección no es válido.');
    return href;
  }
  let url: URL;
  try {
    url = new URL(href, 'https://sitio.invalid');
  } catch {
    throw new BadRequestException('El enlace de la cabecera no es válido.');
  }
  if (href.startsWith('/')) {
    if (url.origin !== 'https://sitio.invalid')
      throw new BadRequestException('La ruta de la cabecera no es válida.');
    return href;
  }
  if (
    !/^https:\/\//i.test(href) ||
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.port
  )
    throw new BadRequestException(
      'Los enlaces externos de la cabecera deben usar HTTPS y no incluir credenciales.',
    );
  return url.href;
}
function link(value: any): HeaderLink {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    value.label.trim().length > 40 ||
    (value.new_tab !== undefined && typeof value.new_tab !== 'boolean')
  )
    throw new BadRequestException(
      'Completa los textos de la cabecera, con un máximo de 40 caracteres.',
    );
  return {
    label: value.label.trim(),
    href: validateHeaderHref(value.href),
    new_tab: value.new_tab ?? false,
  };
}
export function validateHeader(b: any) {
  const d = defaultHeader();
  if (b.header_sticky !== undefined && typeof b.header_sticky !== 'boolean')
    throw new BadRequestException(
      'Indica si la cabecera queda fija al desplazarse.',
    );
  d.header_sticky = b.header_sticky ?? false;
  if (b.header_overlay != null) {
    const o = b.header_overlay;
    if (
      typeof o !== 'object' ||
      Array.isArray(o) ||
      typeof o.enabled !== 'boolean'
    )
      throw new BadRequestException('Revisa la transparencia de la cabecera.');
    const colors: Record<string, string> = {};
    for (const key of [
      'cover_text_color',
      'scroll_background_color',
      'scroll_text_color',
    ] as const) {
      if (typeof o[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(o[key]))
        throw new BadRequestException(
          'Usa colores de seis dígitos para la cabecera transparente.',
        );
      colors[key] = o[key].toLowerCase();
    }
    d.header_overlay = {
      enabled: o.enabled,
      cover_text_color: colors.cover_text_color,
      scroll_background_color: colors.scroll_background_color,
      scroll_text_color: colors.scroll_text_color,
    };
  }
  if (b.header_shrink !== undefined && typeof b.header_shrink !== 'boolean')
    throw new BadRequestException(
      'Indica si la cabecera se reduce al desplazarse.',
    );
  if (
    b.header_shrink_percent !== undefined &&
    (!Number.isInteger(b.header_shrink_percent) ||
      b.header_shrink_percent < 65 ||
      b.header_shrink_percent > 90)
  )
    throw new BadRequestException(
      'El tamaño reducido de la cabecera debe estar entre 65 y 90 %.',
    );
  d.header_shrink = b.header_shrink ?? false;
  d.header_shrink_percent = b.header_shrink_percent ?? 75;
  if (b.header_style != null) {
    const s = b.header_style;
    if (typeof s !== 'object' || Array.isArray(s))
      throw new BadRequestException('Revisa el estilo de la cabecera.');
    if (
      !Number.isInteger(s.logo_height) ||
      s.logo_height < 24 ||
      s.logo_height > 80 ||
      !Number.isInteger(s.height) ||
      s.height < 64 ||
      s.height > 144
    )
      throw new BadRequestException(
        'La cabecera admite logos de 24 a 80 px y alturas de 64 a 144 px.',
      );
    const style: HeaderStyle = {
      logo_height: s.logo_height,
      height: s.height,
      background_color: null,
      text_color: null,
      hover_color: null,
      button_color: null,
      button_text_color: null,
    };
    for (const key of [
      'background_color',
      'text_color',
      'hover_color',
      'button_color',
      'button_text_color',
    ] as const) {
      if (s[key] == null) continue;
      if (typeof s[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(s[key]))
        throw new BadRequestException(
          'Usa colores de seis dígitos en la cabecera.',
        );
      style[key] = s[key].toLowerCase();
    }
    d.header_style = style;
  }
  if (b.header_links !== undefined && b.header_links !== null) {
    if (!Array.isArray(b.header_links) || b.header_links.length > 6)
      throw new BadRequestException(
        'El menú de la cabecera admite hasta seis enlaces.',
      );
    d.header_links = b.header_links.map(link);
  }
  if (b.header_button !== undefined && b.header_button !== null) {
    if (typeof b.header_button.visible !== 'boolean')
      throw new BadRequestException('Indica si se muestra el botón principal.');
    d.header_button = {
      ...link(b.header_button),
      visible: b.header_button.visible,
    };
  }
  return d;
}
