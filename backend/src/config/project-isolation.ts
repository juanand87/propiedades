import * as net from 'node:net';

const inheritedResource = /mundobeat|clownfish-app-x3a5k|tiendas-chi|marketplace_music/i;

export function validateProjectEnvironment(env: Record<string, any>) {
  if (env.PROJECT_ID !== 'propiedades' || env.DB_DATABASE !== 'propiedades') {
    throw new Error('Este backend exige PROJECT_ID=propiedades y DB_DATABASE=propiedades.');
  }
  if (!env.DB_HOST || !env.DB_USERNAME || /^(root|doadmin|CHANGE_ME)$/i.test(env.DB_USERNAME)) {
    throw new Error('Configura el host y el usuario exclusivo de la BD propiedades.');
  }
  if (env.NODE_ENV === 'production' && !env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD es obligatorio en producción.');
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /change|your-secret/i.test(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET debe ser propio y tener al menos 32 caracteres.');
  }
  for (const [key, value] of Object.entries(env)) {
    if (/^(DB_|SPACES_|BACKEND_URL|API_PUBLIC_URL|FRONTEND_URL|CORS_ORIGINS|MERCADOLIBRE_REDIRECT_URI)/.test(key)
        && !/PASSWORD|SECRET|KEY/.test(key) && inheritedResource.test(String(value))) {
      throw new Error(`Configuración heredada bloqueada: ${key}`);
    }
  }
  if (!['true', 'false', undefined].includes(env.INTEGRATIONS_ENABLED)
      || !['true', 'false', undefined].includes(env.SCHEDULED_JOBS_ENABLED)) {
    throw new Error('Las opciones de integraciones y tareas deben ser true o false.');
  }
  if (env.ADMIN_RECOVERY_ENABLED === 'true') {
    throw new Error('La recuperación administrativa heredada está deshabilitada en Propiedades.');
  }
  return env;
}

export function assertConnectionAllowed(args: any[], env: Record<string, any>) {
  // Node también entrega argumentos ya normalizados como [options, callback].
  while (Array.isArray(args[0])) args = args[0];
  const options = typeof args[0] === 'object' ? args[0] : { port: args[0], host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  const host = String(options?.host || 'localhost').toLowerCase();
  if (inheritedResource.test(host)) throw new Error('Conexión a infraestructura heredada bloqueada.');
  const isDatabase = !options?.path && host === String(env.DB_HOST).toLowerCase()
    && Number(options?.port) === Number(env.DB_PORT || 3306);
  if (env.INTEGRATIONS_ENABLED !== 'true' && !isDatabase) {
    throw new Error('Integraciones externas deshabilitadas en Propiedades.');
  }
}

export function installNetworkIsolation(env: Record<string, any>) {
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args: any[]) {
    assertConnectionAllowed(args, env);
    return original.apply(this, args as any);
  } as typeof original;
}
