import { X509Certificate } from 'node:crypto';

export function getDatabaseSsl(env: Record<string, any>) {
  if (env.DB_SSL === undefined || env.DB_SSL === '' || env.DB_SSL === 'false') return undefined;
  if (env.DB_SSL !== 'true') throw new Error('DB_SSL debe ser true o false.');
  const ca = String(env.DB_SSL_CA || '').replace(/\\n/g, '\n').trim();
  if (!ca) throw new Error('Configura DB_SSL_CA con el certificado CA del servidor MySQL.');
  try { new X509Certificate(ca); } catch {
    throw new Error('DB_SSL_CA debe contener un certificado PEM válido, incluidos BEGIN CERTIFICATE y END CERTIFICATE.');
  }
  return { ca, rejectUnauthorized: true, verifyIdentity: true };
}
