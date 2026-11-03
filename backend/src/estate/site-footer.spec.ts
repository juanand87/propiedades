import { defaultDesign, readDesign, validateDesign } from './site-design';
import { defaultBrokerDesign } from './broker-site';

describe('Footer del sitio principal', () => {
  it('conserva el diseño anterior y sus textos predeterminados', () => {
    const old: any = defaultDesign();
    for (const key of Object.keys(old).filter((key) =>
      key.startsWith('footer_'),
    ))
      delete old[key];
    const saved = readDesign(JSON.stringify(old));
    expect(saved.primary_color).toBe(old.primary_color);
    expect(saved.footer_text).toBeNull();
    expect(saved.footer_note).toContain('Las consultas y visitas');
    expect(saved.footer_contact).toBeNull();
  });
  it('guarda textos, contactos y redes sin alterar los defaults de corredores', () => {
    const saved = validateDesign({
      ...defaultDesign(),
      footer_text: ' Portal principal ',
      footer_note: ' Sitio oficial ',
      footer_contact: {
        phone: '+56 9 4444 4444',
        whatsapp: '',
        email: 'portal@qa.invalid',
      },
      footer_socials: [
        { network: 'facebook', url: 'https://www.facebook.com/qa-portal/' },
      ],
    });
    expect(readDesign(JSON.stringify(saved))).toEqual(saved);
    expect(saved.footer_text).toBe('Portal principal');
    expect(saved.footer_contact?.email).toBe('portal@qa.invalid');
    expect(defaultBrokerDesign().footer_contact).toBeNull();
    expect(defaultBrokerDesign().footer_note).toBe('');
  });
  it('rechaza redes inseguras también en el diseño global', () => {
    expect(() =>
      validateDesign({
        ...defaultDesign(),
        footer_socials: [{ network: 'facebook', url: 'javascript:alert(1)' }],
      }),
    ).toThrow();
  });
});
