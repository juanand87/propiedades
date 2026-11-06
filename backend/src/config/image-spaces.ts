export type ImageSpacesConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  host: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export const imageSpacesKeys = [
  'SPACES_IMAGES_ENABLED',
  'SPACES_BUCKET',
  'SPACES_REGION',
  'SPACES_ENDPOINT',
  'SPACES_ACCESS_KEY_ID',
  'SPACES_SECRET_ACCESS_KEY',
  'SPACES_IMAGES_PREFIX',
  'NODE_ENV',
];

export function imageSpacesConfig(
  env: Record<string, any>,
): ImageSpacesConfig | null {
  if (![undefined, 'false', 'true'].includes(env.SPACES_IMAGES_ENABLED))
    throw new Error('SPACES_IMAGES_ENABLED debe ser true o false.');
  if (env.SPACES_IMAGES_ENABLED !== 'true') return null;
  if (
    env.SPACES_BUCKET !== 'propiedades-imagenes' ||
    env.SPACES_REGION !== 'sfo3' ||
    env.SPACES_ENDPOINT !== 'https://sfo3.digitaloceanspaces.com'
  )
    throw new Error(
      'Imágenes Spaces exige el bucket propiedades-imagenes en sfo3.',
    );
  for (const key of ['SPACES_ACCESS_KEY_ID', 'SPACES_SECRET_ACCESS_KEY'])
    if (
      typeof env[key] !== 'string' ||
      !env[key].trim() ||
      /^(TU_|CHANGE_ME)/.test(env[key])
    )
      throw new Error(`Falta ${key} para imágenes Spaces.`);
  const prefix =
    env.SPACES_IMAGES_PREFIX ||
    (env.NODE_ENV === 'production'
      ? 'propiedades/imagenes'
      : 'propiedades/pruebas/imagenes');
  if (!/^propiedades\/(pruebas\/)?imagenes$/.test(prefix))
    throw new Error('Prefijo de imágenes Spaces inválido.');
  if (
    env.NODE_ENV !== 'production' &&
    prefix !== 'propiedades/pruebas/imagenes'
  )
    throw new Error(
      'Las pruebas de Spaces deben usar propiedades/pruebas/imagenes.',
    );
  return {
    bucket: env.SPACES_BUCKET,
    region: env.SPACES_REGION,
    endpoint: env.SPACES_ENDPOINT,
    host: 'propiedades-imagenes.sfo3.digitaloceanspaces.com',
    prefix,
    accessKeyId: env.SPACES_ACCESS_KEY_ID,
    secretAccessKey: env.SPACES_SECRET_ACCESS_KEY,
  };
}

export function assertImageObjectKey(key: string) {
  if (
    !/^propiedades\/(pruebas\/)?imagenes\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(
      key,
    )
  )
    throw new Error('Clave de imagen fuera del espacio de Propiedades.');
}
