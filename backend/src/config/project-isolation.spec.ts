import { assertConnectionAllowed, installNetworkIsolation, validateProjectEnvironment } from './project-isolation';
import * as net from 'node:net';

const env = {
  PROJECT_ID: 'propiedades', DB_DATABASE: 'propiedades', DB_HOST: 'localhost',
  DB_PORT: '3306', DB_USERNAME: 'propiedades_app', JWT_SECRET: 'a'.repeat(48),
  INTEGRATIONS_ENABLED: 'false',
};

describe('aislamiento de Propiedades', () => {
  it('rechaza BD, usuarios y recursos heredados antes de conectar', () => {
    expect(validateProjectEnvironment(env)).toBe(env);
    for (const override of [
      { DB_DATABASE: 'marketplace_music' }, { DB_USERNAME: 'root' },
      { BACKEND_URL: 'https://api.mundobeat.cl' }, { PROJECT_ID: '' },
      { SPACES_BUCKET: 'mundobeat' }, { ADMIN_RECOVERY_ENABLED: 'true' },
      { JWT_SECRET: '' },
    ]) expect(() => validateProjectEnvironment({ ...env, ...override })).toThrow();
  });

  it('permite solo el socket de BD; bloquea SMTP, HTTPS, sockets locales y otros hosts', () => {
    expect(() => assertConnectionAllowed([{ host: 'localhost', port: 3306 }], env)).not.toThrow();
    expect(() => assertConnectionAllowed([[{ host: 'localhost', port: 3306 }]], env)).not.toThrow();
    for (const args of [
      [{ host: 'smtp.example.test', port: 587 }], [{ host: 'localhost', port: 443 }],
      [{ host: 'other-db.test', port: 3306 }], [{ path: '/tmp/mysql.sock' }],
      [443, 'api.mundobeat.cl'], [3306, 'mundobeat.test'],
    ]) expect(() => assertConnectionAllowed(args, env)).toThrow();
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
    } finally { net.Socket.prototype.connect = original; }
  });
});
