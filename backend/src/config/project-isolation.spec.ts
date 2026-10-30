import {
  assertConnectionAllowed,
  installNetworkIsolation,
  validateProjectEnvironment,
} from './project-isolation';
import * as net from 'node:net';
import { rootCertificates } from 'node:tls';
import { getDatabaseSsl } from './database-ssl';

const env = {
  PROJECT_ID: 'propiedades',
  DB_DATABASE: 'propiedades',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USERNAME: 'propiedades_app',
  JWT_SECRET: 'a'.repeat(48),
  INTEGRATIONS_ENABLED: 'false',
};

describe('aislamiento de Propiedades', () => {
  const shared = {
    ...env,
    DB_HOST: 'mundobeat-example.db.ondigitalocean.com',
    DB_PORT: '25060',
    DB_SHARED_HOST: 'mundobeat-example.db.ondigitalocean.com',
    DB_SHARED_USERNAME: env.DB_USERNAME,
    DB_SSL: 'true',
    DB_SSL_CA: rootCertificates[0],
  };

  it('autoriza solo el host y usuario compartidos explícitos con la BD propiedades y TLS', () => {
    expect(validateProjectEnvironment(shared)).toBe(shared);
    expect(() =>
      assertConnectionAllowed([25060, shared.DB_HOST], shared),
    ).not.toThrow();
    for (const override of [
      { DB_SHARED_HOST: '' },
      { DB_SHARED_HOST: 'mundobeat-other.db.ondigitalocean.com' },
      { DB_SHARED_USERNAME: '' },
      { DB_SHARED_USERNAME: 'another_user' },
      { DB_USERNAME: 'doadmin', DB_SHARED_USERNAME: 'doadmin' },
      { DB_DATABASE: 'defaultdb' },
      { DB_DATABASE: 'marketplace_music' },
      { PROJECT_ID: 'mundobeat' },
      { DB_SSL: 'false' },
      { DB_SSL_CA: '' },
      { DB_SSL_CA: 'not a certificate' },
      { BACKEND_URL: 'https://api.mundobeat.cl' },
      { SPACES_BUCKET: 'mundobeat' },
    ])
      expect(() =>
        validateProjectEnvironment({ ...shared, ...override }),
      ).toThrow();
  });

  it('la excepción compartida no habilita otros puertos, hosts o integraciones', () => {
    for (const integrations of ['false', 'true']) {
      const config = { ...shared, INTEGRATIONS_ENABLED: integrations };
      expect(() =>
        assertConnectionAllowed([25060, shared.DB_HOST], config),
      ).not.toThrow();
      for (const args of [
        [443, shared.DB_HOST],
        [3306, shared.DB_HOST],
        [25060, 'mundobeat-other.db.ondigitalocean.com'],
        [443, 'api.mundobeat.cl'],
      ]) {
        expect(() => assertConnectionAllowed(args, config)).toThrow();
      }
    }
  });

  it('habilita TLS con CA y verificación de identidad, incluso con saltos escapados', () => {
    expect(getDatabaseSsl({})).toBeUndefined();
    expect(
      getDatabaseSsl({
        DB_SSL: 'true',
        DB_SSL_CA: rootCertificates[0].replace(/\n/g, '\\n'),
      }),
    ).toEqual({
      ca: rootCertificates[0].trim(),
      rejectUnauthorized: true,
      verifyIdentity: true,
    });
    expect(() => getDatabaseSsl({ DB_SSL: 'invalid' })).toThrow();
  });

  it('rechaza BD, usuarios y recursos heredados antes de conectar', () => {
    expect(validateProjectEnvironment(env)).toBe(env);
    for (const override of [
      { DB_DATABASE: 'marketplace_music' },
      { DB_USERNAME: 'root' },
      { BACKEND_URL: 'https://api.mundobeat.cl' },
      { PROJECT_ID: '' },
      { SPACES_BUCKET: 'mundobeat' },
      { ADMIN_RECOVERY_ENABLED: 'true' },
      { JWT_SECRET: '' },
    ])
      expect(() =>
        validateProjectEnvironment({ ...env, ...override }),
      ).toThrow();
  });

  it('permite solo el socket de BD; bloquea SMTP, HTTPS, sockets locales y otros hosts', () => {
    expect(() =>
      assertConnectionAllowed([{ host: 'localhost', port: 3306 }], env),
    ).not.toThrow();
    expect(() =>
      assertConnectionAllowed([[{ host: 'localhost', port: 3306 }]], env),
    ).not.toThrow();
    for (const args of [
      [{ host: 'smtp.example.test', port: 587 }],
      [{ host: 'localhost', port: 443 }],
      [{ host: 'other-db.test', port: 3306 }],
      [{ path: '/tmp/mysql.sock' }],
      [443, 'api.mundobeat.cl'],
      [3306, 'mundobeat.test'],
    ])
      expect(() => assertConnectionAllowed(args, env)).toThrow();
  });

  it('el hook bloquea antes de invocar la conexión real de Node', () => {
    const original = net.Socket.prototype.connect;
    const connect = jest.fn().mockReturnThis();
    net.Socket.prototype.connect = connect as any;
    try {
      installNetworkIsolation(env);
      const socket = new net.Socket();
      expect(() => socket.connect(443, 'example.test')).toThrow();
      expect(connect).not.toHaveBeenCalled();
      socket.connect(3306, 'localhost');
      expect(connect).toHaveBeenCalledTimes(1);
    } finally {
      net.Socket.prototype.connect = original;
    }
  });
});
