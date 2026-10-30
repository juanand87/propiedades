import { defaultDesign, readDesign, validateDesign } from './site-design';

describe('Diseño público: datos seguros y legibles', () => {
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
