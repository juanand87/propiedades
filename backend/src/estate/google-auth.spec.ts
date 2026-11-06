import { GoogleAuthService } from './google-auth.controller';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { assertConnectionAllowed } from '../config/project-isolation';
describe('Google identity boundaries', () => {
  const config = new ConfigService({
    GOOGLE_AUTH_ENABLED: 'true',
    GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'test-only',
  });
  const fixture = () => {
    const db = { query: jest.fn(), transaction: jest.fn() },
      estate: any = {
        onboardingEnabled: true,
        db,
        throttle: jest.fn(),
        actor: jest.fn(),
      };
    db.transaction.mockImplementation((fn) => fn(db));
    const jwt: any = { sign: jest.fn(() => 'session') };
    return {
      db,
      estate,
      jwt,
      service: new GoogleAuthService(config, estate, jwt),
    };
  };
  it('does not enable an incomplete configuration', () => {
    const f = fixture();
    expect(
      new GoogleAuthService(
        new ConfigService({ GOOGLE_AUTH_ENABLED: 'true' }),
        f.estate,
        f.jwt,
      ).enabled,
    ).toBe(false);
  });
  it('rejects callback cookie mismatch before contacting Google', async () => {
    const f = fixture();
    await expect(f.service.finish('state', 'code', 'other')).rejects.toThrow();
    expect(f.db.query).not.toHaveBeenCalled();
  });
  it('requires a live one-use request', async () => {
    const f = fixture();
    f.db.query.mockResolvedValue([]);
    await expect(f.service.finish('state', 'code', 'state')).rejects.toThrow();
  });
  it('rejects a wrong nonce and never creates an identity', async () => {
    const f = fixture();
    f.db.query
      .mockResolvedValueOnce([{ nonce: 'expected', verifier: 'verifier' }])
      .mockResolvedValue([]);
    jest
      .spyOn(f.service, 'client')
      .mockReturnValue({
        getToken: async () => ({ tokens: { id_token: 'test' } }),
        verifyIdToken: async () => ({
          getPayload: () => ({
            sub: 'subject',
            email: 'qa@gmail.com',
            email_verified: true,
            nonce: 'wrong',
          }),
        }),
      } as any);
    await expect(f.service.finish('state', 'code', 'state')).rejects.toThrow();
    expect(
      f.db.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO users')),
    ).toBe(false);
  });
  it('refuses automatic linking of an existing email', async () => {
    const f = fixture();
    f.db.query
      .mockResolvedValueOnce([{ nonce: 'expected', verifier: 'v' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'existing' }])
      .mockResolvedValue([]);
    jest
      .spyOn(f.service, 'client')
      .mockReturnValue({
        getToken: async () => ({ tokens: { id_token: 'test' } }),
        verifyIdToken: async () => ({
          getPayload: () => ({
            sub: 'subject',
            email: 'qa@gmail.com',
            email_verified: true,
            nonce: 'expected',
          }),
        }),
      } as any);
    await expect(f.service.finish('state', 'code', 'state')).rejects.toThrow(
      'Este correo ya tiene cuenta',
    );
    expect(
      f.db.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO estate_google_identities'),
      ),
    ).toBe(false);
  });
  it('consumes successful results and uses a hashed polling secret', async () => {
    const f = fixture();
    f.db.query
      .mockResolvedValueOnce([{ status: 'complete', user_id: 'u' }])
      .mockResolvedValue([]);
    f.estate.actor.mockResolvedValue({ id: 'u' });
    expect(await f.service.result('request', 'private-secret', 'ip')).toEqual({
      access_token: 'session',
      user: { id: 'u' },
    });
    expect(f.db.query.mock.calls[0][1][1]).toBe(
      createHash('sha256').update('private-secret').digest('hex'),
    );
    expect(f.db.query.mock.calls[1][0]).toContain("status='consumed'");
  });
  it('does not widen the network boundary beyond Google OAuth HTTPS', () => {
    const env = {
      DB_HOST: 'localhost',
      DB_PORT: '3327',
      INTEGRATIONS_ENABLED: 'false',
      GOOGLE_AUTH_ENABLED: 'true',
      USER_ONBOARDING_ENABLED: 'true',
    };
    expect(() =>
      assertConnectionAllowed([443, 'oauth2.googleapis.com'], env),
    ).not.toThrow();
    for (const host of ['gmail.com', 'evil.googleapis.com', 'mundobeat.cl'])
      expect(() => assertConnectionAllowed([443, host], env)).toThrow();
    expect(() =>
      assertConnectionAllowed([80, 'oauth2.googleapis.com'], env),
    ).toThrow();
  });
});
