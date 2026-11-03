import {
  defaultBrokerDesign,
  readBrokerDesign,
  validateBrokerDesign,
} from './broker-site';
import { validateBrokerFooter } from './broker-footer';

describe('Footer personalizable de inmobiliarias', () => {
  it('conserva diseños anteriores y hereda los contactos sin sobrescribirlos', () => {
    const design: any = defaultBrokerDesign({ display_name: 'Casa Uno' });
    for (const key of Object.keys(design).filter((key) =>
      key.startsWith('footer_'),
    ))
      delete design[key];
    const read = readBrokerDesign(JSON.stringify(design), {});
    expect(read.hero_title).toBe('Casa Uno');
    expect(read.footer_contact).toBeNull();
    expect(read.footer_socials).toEqual([]);
    expect(read.footer_text).toBeNull();
  });
  it('normaliza el contenido permitido e ignora campos internos', () => {
    const design = validateBrokerDesign({
      ...defaultBrokerDesign(),
      footer_text: ' Mi marca ',
      footer_note: ' Cita previa ',
      footer_contact: {
        phone: '+56 9 1234 5678',
        whatsapp: '+56 9 1234 5678',
        email: ' hola@ejemplo.cl ',
        user_id: 'otro',
      },
      footer_socials: [
        { network: 'instagram', url: 'https://www.instagram.com/casa/' },
      ],
      status: 'approved',
    });
    expect(design.footer_text).toBe('Mi marca');
    expect(design.footer_note).toBe('Cita previa');
    expect(design.footer_contact?.email).toBe('hola@ejemplo.cl');
    expect(design.footer_contact).not.toHaveProperty('user_id');
    expect(design).not.toHaveProperty('status');
    expect(readBrokerDesign(JSON.stringify(design), {})).toEqual(design);
  });
  it.each([
    'javascript:alert(1)',
    'http://instagram.com/casa',
    'https://instagram.com.ejemplo.cl/casa',
    'https://www.instagram.com@ejemplo.cl/casa',
    'https://user:password@instagram.com/casa',
    'https://instagram.com:8443/casa',
    'https://facebook.com/casa',
  ])('rechaza enlaces ajenos o inseguros: %s', (url) => {
    expect(() =>
      validateBrokerFooter({ footer_socials: [{ network: 'instagram', url }] }),
    ).toThrow();
  });
  it('rechaza redes repetidas, desconocidas y tipos inválidos', () => {
    const social = { network: 'instagram', url: 'https://instagram.com/casa' };
    for (const footer_socials of [
      [social, social],
      [{ ...social, network: 'otra' }],
      [{ network: {}, url: social.url }],
      Array(7).fill(social),
      {},
    ])
      expect(() => validateBrokerFooter({ footer_socials })).toThrow();
  });
  it('valida los contactos y las longitudes sin impedir ocultar canales', () => {
    for (const footer_contact of [
      { phone: '---' },
      { whatsapp: 'javascript:alert(1)' },
      { email: 'correo-invalido' },
      { email: 7 },
      [],
    ])
      expect(() => validateBrokerFooter({ footer_contact })).toThrow();
    expect(() =>
      validateBrokerFooter({ footer_text: 'X'.repeat(601) }),
    ).toThrow();
    expect(() =>
      validateBrokerFooter({ footer_note: 'X'.repeat(201) }),
    ).toThrow();
    expect(
      validateBrokerFooter({
        footer_text: '',
        footer_contact: { phone: '', whatsapp: '', email: '' },
      }).footer_contact,
    ).toEqual({ phone: '', whatsapp: '', email: '' });
  });
});
