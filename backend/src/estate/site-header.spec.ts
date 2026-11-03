import { defaultDesign, readDesign, validateDesign } from './site-design';
import { defaultBrokerDesign, validateBrokerDesign } from './broker-site';
import { validateHeaderHref } from './site-header';

describe('Cabeceras configurables e independientes', () => {
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
