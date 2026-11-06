import { videoSpacesConfig, assertVideoObjectKey } from './video-spaces';
import {
  assertConnectionAllowed,
  validateProjectEnvironment,
} from './project-isolation';
import { assertPropertyVideos } from '../estate/property-videos';
const env = {
  NODE_ENV: 'test',
  PROJECT_ID: 'propiedades',
  DB_DATABASE: 'propiedades',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3327',
  DB_USERNAME: 'propiedades_qa',
  JWT_SECRET: 'a'.repeat(48),
  INTEGRATIONS_ENABLED: 'false',
  SPACES_VIDEOS_ENABLED: 'true',
  SPACES_BUCKET: 'propiedades-imagenes',
  SPACES_REGION: 'sfo3',
  SPACES_ENDPOINT: 'https://sfo3.digitaloceanspaces.com',
  SPACES_ACCESS_KEY_ID: 'fake-only',
  SPACES_SECRET_ACCESS_KEY: 'fake-only',
  PROPERTY_VIDEOS_ENABLED: 'true',
};
describe('Spaces videos isolation', () => {
  it('requires an explicit switch and limits development to the test video prefix', () => {
    expect(videoSpacesConfig({})).toBeNull();
    expect(videoSpacesConfig(env)?.prefix).toBe('propiedades/pruebas/videos');
    for (const patch of [
      { SPACES_BUCKET: 'mundobeat' },
      { SPACES_VIDEOS_PREFIX: 'propiedades/videos' },
      { SPACES_VIDEOS_PREFIX: '../escape' },
      { SPACES_ENDPOINT: 'https://external.test' },
      { SPACES_SECRET_ACCESS_KEY: '' },
    ])
      expect(() => videoSpacesConfig({ ...env, ...patch })).toThrow();
  });
  it('allows only the exact bucket HTTPS socket while images are disabled', () => {
    expect(() =>
      assertConnectionAllowed(
        [443, 'propiedades-imagenes.sfo3.digitaloceanspaces.com'],
        env,
      ),
    ).not.toThrow();
    for (const args of [
      [80, 'propiedades-imagenes.sfo3.digitaloceanspaces.com'],
      [443, 'other.sfo3.digitaloceanspaces.com'],
      [443, 'sfo3.digitaloceanspaces.com'],
      [443, 'api.mundobeat.cl'],
    ])
      expect(() => assertConnectionAllowed(args, env)).toThrow();
  });
  it('cannot enable production video APIs without durable Spaces storage', () => {
    expect(() =>
      assertPropertyVideos({ ...env, NODE_ENV: 'production' }, false),
    ).toThrow();
    expect(() =>
      assertPropertyVideos({ ...env, NODE_ENV: 'production' }, true),
    ).not.toThrow();
    expect(() =>
      validateProjectEnvironment({
        ...env,
        NODE_ENV: 'production',
        DB_PASSWORD: 'test',
        SPACES_VIDEOS_ENABLED: 'false',
      }),
    ).toThrow();
    expect(() =>
      assertVideoObjectKey(
        'propiedades/pruebas/videos/00000000-0000-4000-8000-000000000001.mp4',
      ),
    ).not.toThrow();
    expect(() =>
      assertVideoObjectKey(
        'propiedades/pruebas/imagenes/00000000-0000-4000-8000-000000000001.webp',
      ),
    ).toThrow();
  });
});
