import { imageSpacesConfig } from './image-spaces';
export const videoSpacesKeys = [
  'SPACES_VIDEOS_ENABLED',
  'SPACES_VIDEOS_PREFIX',
  'SPACES_BUCKET',
  'SPACES_REGION',
  'SPACES_ENDPOINT',
  'SPACES_ACCESS_KEY_ID',
  'SPACES_SECRET_ACCESS_KEY',
  'NODE_ENV',
];
export function videoSpacesConfig(env: Record<string, any>) {
  if (![undefined, 'false', 'true'].includes(env.SPACES_VIDEOS_ENABLED))
    throw Error('SPACES_VIDEOS_ENABLED debe ser true o false.');
  if (env.SPACES_VIDEOS_ENABLED !== 'true') return null;
  const base = imageSpacesConfig({
    ...env,
    SPACES_IMAGES_ENABLED: 'true',
    SPACES_IMAGES_PREFIX: undefined,
  })!;
  const prefix =
    env.SPACES_VIDEOS_PREFIX ||
    (env.NODE_ENV === 'production'
      ? 'propiedades/videos'
      : 'propiedades/pruebas/videos');
  if (
    !/^propiedades\/(pruebas\/)?videos$/.test(prefix) ||
    (env.NODE_ENV !== 'production' && prefix !== 'propiedades/pruebas/videos')
  )
    throw Error('Prefijo de videos Spaces inválido para este entorno.');
  return { ...base, prefix };
}
export function assertVideoObjectKey(key: string) {
  if (
    !/^propiedades\/(pruebas\/)?videos\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.mp4$/.test(
      key,
    )
  )
    throw Error('Clave de video fuera de Propiedades.');
}
