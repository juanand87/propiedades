import { decimal, integer, ownership, transition, email } from './rules';
const owner = {
  id: 'owner',
  email: 'owner@example.test',
  role: 'vendor',
  firstName: 'Owner',
  advertiser_id: 'a',
};
describe('reglas inmobiliarias', () => {
  it('mantiene precisión decimal y rechaza importes negativos o desbordados', () => {
    expect(decimal('12345.1234', 'precio')).toBe('12345.1234');
    expect(decimal('', 'precio')).toBeNull();
    for (const v of ['-1', '0', '1.12345', '100000000000000', 'NaN'])
      expect(() => decimal(v, 'precio')).toThrow();
  });
  it('permite dormitorios cero y diferencia desconocido', () => {
    expect(integer('0')).toBe(0);
    expect(integer('')).toBeNull();
    expect(() => integer('1.2')).toThrow();
  });
  it('comprueba pertenencia en servidor y permite administración', () => {
    expect(() => ownership(owner, 'a')).not.toThrow();
    expect(() => ownership(owner, 'b')).toThrow();
    expect(() => ownership({ ...owner, role: 'admin' }, 'b')).not.toThrow();
  });
  it('no permite al anunciante autopublicar ni saltar la revisión', () => {
    expect(() => transition('draft', 'published', owner)).toThrow();
    expect(() => transition('draft', 'pending_review', owner)).not.toThrow();
    expect(() =>
      transition('pending_review', 'published', { ...owner, role: 'admin' }),
    ).not.toThrow();
    expect(() => transition('archived', 'published', owner)).toThrow();
  });
  it('normaliza correos sin permitir texto arbitrario', () => {
    expect(email(' Admin@Example.Test ')).toBe('admin@example.test');
    expect(() => email('admin')).toThrow();
  });
});
