import { randomUUID } from 'node:crypto';
import { defaultDesign, readDesign, validateDesign } from './site-design';
import { defaultBrokerDesign, validateBrokerDesign } from './broker-site';
describe('Textos editables de portada y por foto', () => {
  const copy = {
    title: 'Una casa para tu historia',
    subtitle: 'Consulta y coordina una visita.',
  };
  it('mantiene el texto anterior cuando no hay personalización', () => {
    const old: any = defaultDesign();
    delete old.hero_copy;
    expect(readDesign(JSON.stringify(old)).hero_copy).toBeNull();
    expect(defaultBrokerDesign().hero_copy).toBeNull();
  });
  it('valida textos comunes y textos propios sin aceptar campos internos', () => {
    const slides = [
      {
        media_id: randomUUID(),
        alt_text: 'Terraza',
        copy: { ...copy, title: ' Foto propia ', owner_id: 'otro' },
      },
      { media_id: randomUUID(), alt_text: 'Jardín' },
    ];
    const d = validateDesign({
      ...defaultDesign(),
      hero_mode: 'slider',
      hero_copy: copy,
      hero_slides: slides,
    });
    expect(d.hero_slides[0].copy).toEqual({ ...copy, title: 'Foto propia' });
    expect(d.hero_slides[1].copy).toBeUndefined();
    expect(readDesign(JSON.stringify(d))).toEqual(d);
    expect(
      validateBrokerDesign({ ...defaultBrokerDesign(), hero_copy: copy })
        .hero_copy,
    ).toEqual(copy);
  });
  it('conserva los textos al reordenar o reemplazar las imágenes', () => {
    const first = { media_id: randomUUID(), alt_text: 'Una foto', copy };
    const second = { media_id: randomUUID(), alt_text: 'Otra foto' };
    const d = validateDesign({
      ...defaultDesign(),
      hero_mode: 'slider',
      hero_slides: [second, { ...first, media_id: randomUUID() }],
    });
    expect(d.hero_slides[1].copy).toEqual(copy);
    expect(
      validateDesign({
        ...d,
        hero_slides: d.hero_slides.map((s) => ({ ...s, copy: null })),
      }).hero_slides.every((s) => s.copy == null),
    ).toBe(true);
  });
  it('rechaza textos inválidos y admite descripción vacía', () => {
    for (const bad of [
      [],
      true,
      { title: '', subtitle: '' },
      { title: 'x'.repeat(181), subtitle: '' },
      { title: 'Casa', subtitle: 'x'.repeat(401) },
      { title: 'Casa', subtitle: null },
    ]) {
      expect(() =>
        validateDesign({ ...defaultDesign(), hero_copy: bad }),
      ).toThrow();
      expect(() =>
        validateDesign({
          ...defaultDesign(),
          hero_slides: [
            { media_id: randomUUID(), alt_text: 'Foto', copy: bad },
          ],
        }),
      ).toThrow();
    }
    expect(
      validateDesign({
        ...defaultDesign(),
        hero_copy: { title: 'Casa', subtitle: '' },
      }).hero_copy?.subtitle,
    ).toBe('');
  });
});
