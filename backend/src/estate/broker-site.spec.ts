import {
  defaultBrokerDesign,
  readBrokerDesign,
  validateBrokerDesign,
} from './broker-site';
describe('Sitios independientes de anunciantes', () => {
  it('adapta la identidad existente sin copiar configuración del marketplace', () => {
    const d = defaultBrokerDesign({
      display_name: 'Corredor Uno',
      description: 'Asesoría local',
    });
    expect(d.hero_title).toBe('Corredor Uno');
    expect(d.about_text).toBe('Asesoría local');
    expect(d.sections.map((s) => s.id)).toEqual([
      'hero',
      'about',
      'listings',
      'contact',
    ]);
  });
  it('rechaza secciones ajenas y textos demasiado largos', () => {
    const d = defaultBrokerDesign();
    expect(() =>
      validateBrokerDesign({
        ...d,
        sections: d.sections.map((s) =>
          s.id === 'about' ? { id: 'publish', visible: true } : s,
        ),
      }),
    ).toThrow();
    expect(() =>
      validateBrokerDesign({ ...d, hero_title: 'X'.repeat(181) }),
    ).toThrow();
    expect(() => validateBrokerDesign({ ...d, contact_title: '' })).toThrow();
  });
  it('conserva orden, colores y contenido sin aceptar campos internos', () => {
    const d = defaultBrokerDesign();
    d.sections.reverse();
    const saved = validateBrokerDesign({
      ...d,
      user_id: 'other',
      status: 'approved',
    });
    expect(saved.sections[0].id).toBe('contact');
    expect(saved).not.toHaveProperty('user_id');
    expect(saved).not.toHaveProperty('status');
    expect(readBrokerDesign(JSON.stringify(saved), {})).toEqual(saved);
  });
  it('mantiene el sitio por defecto si no hay migración o el contenido es inválido', () => {
    expect(
      readBrokerDesign(undefined, { display_name: 'Mi corredor' }).hero_title,
    ).toBe('Mi corredor');
    expect(readBrokerDesign('{bad', {})).toEqual(defaultBrokerDesign());
  });
});
