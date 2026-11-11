import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PushService } from './push.service';

describe('message push delivery', () => {
  const token = 'fcm_local_test_token_0123456789';
  function setup(overrides = {}, device = true, base64 = false) {
    const row = {
      message_id: '5',
      token,
      user_id: 'recipient',
      ticket: null,
      status: 'pending',
      attempts: 0,
      conversation_id: 'chat',
      low_read_id: '0',
      high_read_id: '0',
      user_low_id: 'recipient',
      ...overrides,
    };
    const query = jest.fn((sql: string) => {
      if (sql.includes('information_schema'))
        return Promise.resolve([{ n: 2 }]);
      if (sql.includes('SELECT CAST(d.message_id'))
        return Promise.resolve([row]);
      if (sql.startsWith('SELECT user_id'))
        return Promise.resolve(device ? [{ user_id: 'recipient' }] : []);
      return Promise.resolve([]);
    });
    const runner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([{ locked: 1 }]),
    };
    const db = {
      query,
      createQueryRunner: () => runner,
    } as unknown as DataSource;
    const credential = JSON.stringify({
      project_id: 'proppix-test',
      client_email: 'test@proppix-test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----test',
    });
    return {
      service: new PushService(
        db,
        new ConfigService({
          FIREBASE_PROJECT_ID: 'proppix-test',
          ...(base64
            ? {
                FIREBASE_SERVICE_ACCOUNT_BASE64:
                  Buffer.from(credential).toString('base64'),
                FIREBASE_SERVICE_ACCOUNT_JSON: 'invalid old JSON',
              }
            : { FIREBASE_SERVICE_ACCOUNT_JSON: credential }),
        }),
      ),
      query,
      runner,
    };
  }
  beforeEach(() => {
    jest
      .spyOn(JWT.prototype, 'getAccessToken')
      .mockResolvedValue({ token: 'test-access-token' });
  });
  afterEach(() => jest.restoreAllMocks());
  it.each([false, true])(
    'sends directly to Google with base64=%s',
    async (base64) => {
      const { service, query, runner } = setup({}, true, base64);
      const network = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ name: 'projects/proppix-test/messages/receipt-1' }),
      } as Response);
      await service.flush();
      const payload = JSON.parse(network.mock.calls[0][1]!.body as string) as {
        message: {
          data: { conversationId: string };
          notification: { body: string };
        };
      };
      expect(network.mock.calls[0][0]).toBe(
        'https://fcm.googleapis.com/v1/projects/proppix-test/messages:send',
      );
      expect(payload.message.data.conversationId).toBe('chat');
      expect(payload.message.notification.body).toBe(
        'Tienes un mensaje nuevo. Toca para abrir la conversación.',
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET status='),
        ['done', null, 60, '5', token],
      );
      expect(runner.release).toHaveBeenCalled();
    },
  );
  it.each([{ low_read_id: '5' }, { low_read_id: '9' }])(
    'skips messages already read: %o',
    async (read) => {
      const { service } = setup(read);
      const network = jest.spyOn(global, 'fetch');
      await service.flush();
      expect(network).not.toHaveBeenCalled();
    },
  );
  it('does not send to a logged-out or reassigned device', async () => {
    const { service } = setup({}, false);
    const network = jest.spyOn(global, 'fetch');
    await service.flush();
    expect(network).not.toHaveBeenCalled();
  });
  it('removes invalid tokens on the Firebase UNREGISTERED response', async () => {
    const { service, query } = setup({
      status: 'pending',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          error: { details: [{ errorCode: 'UNREGISTERED' }] },
        }),
    } as Response);
    await service.flush();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM estate_push_devices'),
      [token, 'recipient'],
    );
  });
  it('persists retry backoff and releases the lock after a network failure', async () => {
    const { service, query, runner } = setup();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await service.flush();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('attempts=attempts+1'),
      [30, '5', token],
    );
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('RELEASE_LOCK'),
    );
    expect(runner.release).toHaveBeenCalled();
  });
});
