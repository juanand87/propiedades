import { profileIdentity } from './profile-identity';
describe('public profile identity', () => {
  it('normalizes the public handle without changing the display name', () => {
    expect(
      profileIdentity({
        profile_kind: 'company',
        username: ' @Mi.Empresa_01 ',
        display_name: ' Inmobiliaria Los Lagos ',
      }),
    ).toEqual({
      profile_kind: 'company',
      username: 'mi.empresa_01',
      display_name: 'Inmobiliaria Los Lagos',
    });
  });
  it.each([
    '',
    'a',
    'ab',
    'nombre con espacio',
    'iñmobiliaria',
    '../perfil',
    'https://perfil',
    'a'.repeat(31),
  ])('rejects invalid handle %s', (username) => {
    expect(() =>
      profileIdentity({
        profile_kind: 'person',
        username,
        display_name: 'Juan',
      }),
    ).toThrow();
  });
  it.each([undefined, 'agency', 'admin', 0, null])(
    'requires explicit person or company kind %s',
    (profile_kind) => {
      expect(() =>
        profileIdentity({
          profile_kind,
          username: 'juan',
          display_name: 'Juan',
        }),
      ).toThrow('Persona o Empresa');
    },
  );
  it('requires a visible company name', () => {
    expect(() =>
      profileIdentity({
        profile_kind: 'company',
        username: 'empresa',
        display_name: ' ',
      }),
    ).toThrow('nombre de la empresa');
    expect(() =>
      profileIdentity({
        profile_kind: 'person',
        username: 'persona',
        display_name: 'J',
      }),
    ).toThrow('nombre visible');
  });
});
