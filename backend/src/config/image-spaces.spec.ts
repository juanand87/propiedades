import { imageSpacesConfig, assertImageObjectKey } from './image-spaces';
import { assertConnectionAllowed } from './project-isolation';
const env = {
  SPACES_IMAGES_ENABLED: 'true',
  SPACES_BUCKET: 'propiedades-imagenes',
  SPACES_REGION: 'sfo3',
  SPACES_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
  SPACES_ACCESS_KEY_ID: 'fake-only',
  SPACES_SECRET_ACCESS_KEY: 'fake-only',
  NODE_ENV: 'test',
  INTEGRATIONS_ENABLED: 'false',
};
describe('exclusive image Spaces configuration', () => {
  it('is disabled by default and requires explicit valid credentials', () => {
    expect(imageSpacesConfig({})).toBeNull();
    expect(
      imageSpacesConfig({ ...env, SPACES_IMAGES_ENABLED: 'false' }),
    ).toBeNull();
    for (const override of [
      { SPACES_BUCKET: 'mundobeat' },
      { SPACES_REGION: 'nyc3' },
      { SPACES_ENDPOINT: 'https://elsewhere.test' },
      { SPACES_ENDPOINT: 'https://sfo3.digitaloceanspaces.com/' },
      { SPACES_SECRET_ACCESS_KEY: '' },
      { SPACES_IMAGES_ENABLED: 'TRUE' },
      { SPACES_IMAGES_PREFIX: 'propiedades/imagenes' },
      { SPACES_IMAGES_PREFIX: '../escape' },
    ])
      expect(() => imageSpacesConfig({ ...env, ...override })).toThrow();
  });
  it('separates production keys and test keys', () => {
    expect(imageSpacesConfig(env)?.prefix).toBe('propiedades/pruebas/imagenes');
    expect(imageSpacesConfig({ ...env, NODE_ENV: 'production' })?.prefix).toBe(
      'propiedades/imagenes',
    );
    expect(() =>
      assertImageObjectKey(
        'propiedades/pruebas/imagenes/00000000-0000-4000-8000-000000000001.webp',
      ),
    ).not.toThrow();
    for (const key of [
      '../image.webp',
      'mundobeat/image.webp',
      'propiedades/pruebas/imagenes/123.jpg',
      'propiedades/imagenes/../../../secret',
    ])
      expect(() => assertImageObjectKey(key)).toThrow();
  });
  it('only exempts the exact bucket HTTPS socket, not other integrations', () => {
    expect(() =>
      assertConnectionAllowed(
        [
          {
            host: 'propiedades-imagenes.sfo3.digitaloceanspaces.com',
            port: 443,
          },
        ],
        env,
      ),
    ).not.toThrow();
    for (const args of [
      [443, 'sfo3.digitaloceanspaces.com'],
      [443, 'other.sfo3.digitaloceanspaces.com'],
      [80, 'propiedades-imagenes.sfo3.digitaloceanspaces.com'],
      [443, 'api.mundobeat.cl'],
      [443, 'smtp.test'],
    ])
      expect(() => assertConnectionAllowed(args, env)).toThrow();
    expect(() =>
      assertConnectionAllowed(
        [443, 'propiedades-imagenes.sfo3.digitaloceanspaces.com'],
        { ...env, SPACES_IMAGES_ENABLED: 'false' },
      ),
    ).toThrow();
  });
});
