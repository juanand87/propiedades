import { defaultDesign, readDesign, validateDesign } from './site-design';
import { defaultBrokerDesign, validateBrokerDesign } from './broker-site';
import { validateHeaderHref } from './site-header';

describe('Cabeceras configurables e independientes', () => {
  it('conserva el estilo automático cuando el diseño es anterior', () => {
    expect(
      readDesign(
        JSON.stringify({ ...defaultDesign(), header_style: undefined }),
      ).header_style,
    ).toBeNull();
  });
  it('valida tamaños, colores y elimina campos internos del estilo', () => {
    const style = {
      logo_height: 64,
      height: 112,
      background_color: '#102B50',
      text_color: '#FFFFFF',
      hover_color: '#F1CC88',
      button_color: null,
      button_text_color: null,
    };
    const saved = validateBrokerDesign({
      ...defaultBrokerDesign(),
      header_style: { ...style, owner_id: 'otro' },
    });
    expect(saved.header_style).toEqual({
      ...style,
      background_color: '#102b50',
      text_color: '#ffffff',
      hover_color: '#f1cc88',
    });
    expect(
      readDesign(JSON.stringify({ ...defaultDesign(), header_style: style }))
        .header_style?.height,
    ).toBe(112);
    for (const value of [
      [],
      'bad',
      { ...style, height: 63 },
      { ...style, height: 145 },
      { ...style, logo_height: 23 },
      { ...style, logo_height: 81 },
      { ...style, height: 80.5 },
      { ...style, logo_height: '40' },
      { ...style, text_color: 'red' },
      { ...style, background_color: '#fff;background:url(x)' },
    ]) {
      expect(() =>
        validateDesign({ ...defaultDesign(), header_style: value }),
      ).toThrow();
    }
  });
  it('conserva el menú automático de diseños anteriores', () => {
    const old: any = defaultDesign();
    delete old.header_links;
    delete old.header_button;
    const read = readDesign(JSON.stringify(old));
    expect(read.header_links).toBeNull();
    expect(read.header_button).toBeNull();
    expect(read.primary_color).toBe(old.primary_color);
  });
  it('conserva orden, textos y nueva pestaña sin aceptar campos internos', () => {
    const saved = validateDesign({
      ...defaultDesign(),
      header_links: [
        {
          label: ' Primero ',
          href: '/propiedades',
          new_tab: false,
          id: 'interno',
        },
        {
          label: 'Segundo',
          href: 'https://ejemplo.cl/contacto',
          new_tab: true,
        },
      ],
      header_button: {
        label: 'Consultar',
        href: 'https://wa.me/56912345678',
        new_tab: true,
        visible: true,
        user_id: 'otro',
      },
    });
    expect(saved.header_links?.map((link) => link.label)).toEqual([
      'Primero',
      'Segundo',
    ]);
    expect(saved.header_links?.[0]).not.toHaveProperty('id');
    expect(saved.header_button).not.toHaveProperty('user_id');
    expect(readDesign(JSON.stringify(saved))).toEqual(saved);
    expect(defaultBrokerDesign().header_links).toBeNull();
  });
  it('admite anclas del corredor, menús vacíos y botones ocultos', () => {
    const saved = validateBrokerDesign({
      ...defaultBrokerDesign(),
      header_links: [],
      header_button: {
        label: 'Consultar',
        href: '#contacto',
        new_tab: false,
        visible: false,
      },
    });
    expect(saved.header_links).toEqual([]);
    expect(saved.header_button?.visible).toBe(false);
    expect(validateHeaderHref('#propiedades')).toBe('#propiedades');
    expect(validateHeaderHref('/propiedades?type_id=house')).toContain(
      'type_id=house',
    );
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    '//ejemplo.cl',
    '/%2fejemplo.cl',
    '/\\ejemplo.cl',
    '/%5cevil',
    'https://user:pass@ejemplo.cl',
    'http://ejemplo.cl',
    'https://ejemplo.cl:8080',
    '/ruta\nmaliciosa',
    '/ruta%0amaliciosa',
    'https://ejemplo.cl/%0dtest',
    '#',
    'propiedades',
  ])('rechaza destinos inseguros o malformados: %s', (href) =>
    expect(() => validateHeaderHref(href)).toThrow(),
  );
  it('valida longitudes, tipos y cantidad máxima de enlaces', () => {
    const item = { label: 'Enlace', href: '/propiedades', new_tab: false };
    for (const header_links of [
      Array(7).fill(item),
      [{ ...item, label: '' }],
      [{ ...item, label: 'X'.repeat(41) }],
      [{ ...item, new_tab: 'true' }],
      {},
    ])
      expect(() =>
        validateDesign({ ...defaultDesign(), header_links }),
      ).toThrow();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        header_button: { ...item, visible: 'false' },
      }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        header_button: { ...item, visible: true, href: 'X'.repeat(501) },
      }),
    ).toThrow();
  });
});
