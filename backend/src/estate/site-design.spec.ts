import {
  defaultDesign,
  readDesign,
  validateDesign,
  designMediaIds,
} from './site-design';
import { randomUUID } from 'node:crypto';

describe('Diseño público: datos seguros y legibles', () => {
  const slides = () => [
    { media_id: randomUUID(), alt_text: 'Terraza' },
    { media_id: randomUUID(), alt_text: 'Jardín' },
  ];
  it('valida un slider y conserva su orden sin aceptar URLs externas', () => {
    const gallery = slides();
    const d = validateDesign({
      ...defaultDesign(),
      hero_mode: 'slider',
      hero_slides: gallery.map((s) => ({
        ...s,
        url: 'https://other.invalid/photo',
      })),
    });
    expect(d.hero_slides).toEqual(gallery);
    expect(designMediaIds(d)).toEqual(gallery.map((s) => s.media_id));
  });
  it('rechaza menos de dos imágenes, más de ocho y referencias repetidas', () => {
    const gallery = slides();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        hero_mode: 'slider',
        hero_slides: gallery.slice(0, 1),
      }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        hero_mode: 'slider',
        hero_slides: Array.from({ length: 9 }, () => slides()[0]),
      }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        hero_mode: 'slider',
        hero_slides: [gallery[0], gallery[0]],
      }),
    ).toThrow();
  });
  it('limita velocidad, modo y descripciones del slider', () => {
    expect(() =>
      validateDesign({ ...defaultDesign(), hero_interval: 1 }),
    ).toThrow();
    expect(() =>
      validateDesign({ ...defaultDesign(), hero_interval: 6.5 }),
    ).toThrow();
    expect(() =>
      validateDesign({ ...defaultDesign(), hero_autoplay: 'true' }),
    ).toThrow();
    expect(() =>
      validateDesign({ ...defaultDesign(), hero_mode: 'video' }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        hero_slides: [{ media_id: randomUUID(), alt_text: 'a'.repeat(201) }],
      }),
    ).toThrow();
  });
  it('preserva colores guardados antes de incorporar el slider', () => {
    const d: any = { ...defaultDesign(), primary_color: '#285d50' };
    delete d.hero_mode;
    delete d.hero_slides;
    delete d.hero_autoplay;
    delete d.hero_interval;
    expect(validateDesign(d).primary_color).toBe('#285d50');
    expect(validateDesign(d).hero_mode).toBe('image');
    expect(validateDesign(d).hero_slides).toEqual([]);
  });
  it('comprueba cada imagen seleccionada una sola vez', () => {
    const gallery = slides();
    const d = validateDesign({
      ...defaultDesign(),
      hero_slides: gallery,
      logo_media_id: gallery[0].media_id,
      hero_media_id: gallery[1].media_id,
    });
    expect(designMediaIds(d)).toHaveLength(2);
  });
  it('mantiene el diseño original sin migración ni configuración', () => {
    expect(readDesign(undefined)).toEqual(defaultDesign());
    expect(readDesign('{invalid')).toEqual(defaultDesign());
  });
  it('acepta reordenar y ocultar secciones sin perderlas', () => {
    const d = defaultDesign();
    d.sections.reverse();
    d.sections[0].visible = false;
    expect(validateDesign(d).sections).toEqual(d.sections);
  });
  it('rechaza CSS y colores ilegibles', () => {
    expect(() =>
      validateDesign({ ...defaultDesign(), primary_color: 'red;}' }),
    ).toThrow();
    expect(() =>
      validateDesign({ ...defaultDesign(), primary_color: '#ffffff' }),
    ).toThrow('contrastar');
    expect(() =>
      validateDesign({ ...defaultDesign(), text_color: '#eeeeee' }),
    ).toThrow('contrastar');
  });
  it('rechaza secciones duplicadas, ajenas o todas ocultas', () => {
    const d = defaultDesign();
    expect(() =>
      validateDesign({ ...d, sections: d.sections.map(() => d.sections[0]) }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...d,
        sections: d.sections.map((s) => ({ ...s, visible: false })),
      }),
    ).toThrow();
    expect(() =>
      validateDesign({
        ...d,
        sections: [...d.sections.slice(1), { id: 'script', visible: true }],
      }),
    ).toThrow();
  });
  it('solo devuelve campos reconocidos y recorta textos alternativos', () => {
    const d = validateDesign({
      ...defaultDesign(),
      hero_alt: ' Casa ',
      injected: 'unsafe',
    });
    expect(d.hero_alt).toBe('Casa');
    expect(d).not.toHaveProperty('injected');
  });
});
