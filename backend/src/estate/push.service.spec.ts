import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
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
  it.each(['sent', 'offline', 'withdrawn'] as const)(
    'handles saved-search push %s',
    async (state) => {
      const { service, query } = setup();
      query.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('information_schema')
            ? [{ n: 2 }]
            : sql.startsWith('SELECT CAST(match_id')
              ? [{ match_id: '17', token, user_id: 'recipient', attempts: 0 }]
              : sql.startsWith('SELECT p.id property_id') &&
                  state !== 'withdrawn'
                ? [{ property_id: '00000000-0000-4000-8000-000000000001' }]
                : [],
        ),
      );
      const network = jest.spyOn(global, 'fetch');
      if (state === 'offline') network.mockRejectedValue(new Error('offline'));
      else
        network.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ name: 'accepted' }),
        } as Response);
      await service.flush();
      if (state === 'withdrawn') expect(network).not.toHaveBeenCalled();
      else if (state === 'sent') {
        const payload = JSON.parse(
          network.mock.calls[0][1]!.body as string,
        ) as {
          message: {
            data: { type: string; propertyId: string; searchMatchId: string };
          };
        };
        expect(payload.message.data).toMatchObject({
          type: 'property_match',
          searchMatchId: '17',
          propertyId: '00000000-0000-4000-8000-000000000001',
        });
      }
      if (state === 'offline')
        expect(query).not.toHaveBeenCalledWith(
          expect.stringContaining('estate_search_push_deliveries SET status=?'),
          expect.anything(),
        );
      else
        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('estate_search_push_deliveries SET status=?'),
          ['done', '17', token],
        );
    },
  );
  it('tests only the authenticated account devices and throttles retries', async () => {
    const { service, query } = setup();
    jest.spyOn(service, 'health').mockResolvedValue({
      provider: 'fcm-direct',
      configured: true,
      google_ready: true,
    });
    query.mockImplementation((sql: string) =>
      Promise.resolve(sql.startsWith('SELECT token') ? [{ token }] : []),
    );
    const network = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'accepted' }),
    } as Response);
    const actor = { id: 'my-account' } as Parameters<
      PushService['testOwnDevices']
    >[0];
    expect((await service.testOwnDevices(actor)).accepted).toBe(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id=?'),
      ['my-account'],
    );
    const payload = JSON.parse(network.mock.calls[0][1]!.body as string) as {
      message: { data: { test: string } };
    };
    expect(payload.message.data.test).toBe('true');
    await expect(service.testOwnDevices(actor)).rejects.toThrow('30 segundos');
  });
  it.each([
    [{}, 'missing_in_backend'],
    [
      { FIREBASE_SERVICE_ACCOUNT_BASE64: 'invalid-base64' },
      'invalid_json_or_base64',
    ],
  ])('reports a safe credential diagnostic', async (config, expected) => {
    const service = new PushService(
      {} as DataSource,
      new ConfigService(config),
    );
    const health = await service.health();
    expect(health.configured).toBe(false);
    expect(health.credential_status).toBe(expected);
    expect(JSON.stringify(health)).not.toContain('private_key');
  });
  it('queues self-comments and deduplicates owner and reply recipient', async () => {
    const { service } = setup();
    const query = jest.fn((sql: string) =>
      Promise.resolve(sql.includes('information_schema') ? [{ n: 1 }] : []),
    );
    const tx = { query } as unknown as EntityManager;
    await service.enqueueVideoComment(tx, {
      commentId: 'comment',
      ownerId: 'owner',
      parentUserId: 'owner',
      actorId: 'owner',
    });
    const inserts = query.mock.calls.filter(([sql]) =>
      sql.startsWith('INSERT'),
    );
    expect(inserts).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE'),
      ['comment', 'reply', 'owner'],
    );
  });
  it('notifies both video owner and a distinct parent author', async () => {
    const { service } = setup();
    const query = jest.fn((sql: string) =>
      Promise.resolve(sql.includes('information_schema') ? [{ n: 1 }] : []),
    );
    await service.enqueueVideoComment({ query } as unknown as EntityManager, {
      commentId: 'comment',
      ownerId: 'owner',
      parentUserId: 'parent',
      actorId: 'writer',
    });
    expect(
      query.mock.calls.filter(([sql]) => sql.startsWith('INSERT')),
    ).toHaveLength(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE'),
      ['comment', 'comment', 'owner'],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE'),
      ['comment', 'reply', 'parent'],
    );
  });
  it('can disable self activity while keeping other recipients', async () => {
    const service = new PushService(
      {} as DataSource,
      new ConfigService({ PUSH_SELF_ACTIVITY_ENABLED: 'false' }),
    );
    const query = jest.fn((sql: string) =>
      Promise.resolve(sql.includes('information_schema') ? [{ n: 1 }] : []),
    );
    await service.enqueueVideoComment({ query } as unknown as EntityManager, {
      commentId: 'comment',
      ownerId: 'writer',
      parentUserId: 'parent',
      actorId: 'writer',
    });
    expect(
      query.mock.calls.filter(([sql]) => sql.startsWith('INSERT')),
    ).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT IGNORE'),
      ['comment', 'reply', 'parent'],
    );
  });
  it.each(['comment', 'reply'] as const)(
    'sends a durable video %s notification',
    async (kind) => {
      const { service, query } = setup();
      const event = {
        comment_id: 'comment-1',
        user_id: 'recipient',
        token,
        kind,
        attempts: 0,
      };
      query.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('information_schema')
            ? [{ n: 2 }]
            : sql.startsWith('SELECT comment_id')
              ? [event]
              : sql.startsWith('SELECT c.video_id')
                ? [{ video_id: 'video-1' }]
                : [],
        ),
      );
      const network = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'accepted' }),
      } as Response);
      await service.flush();
      const payload = JSON.parse(network.mock.calls[0][1]!.body as string) as {
        message: {
          data: { videoId: string; commentId: string };
          notification: { title: string };
        };
      };
      expect(payload.message.data.videoId).toBe('video-1');
      expect(payload.message.data.commentId).toBe('comment-1');
      expect(payload.message.notification.title).toBe(
        kind === 'reply'
          ? 'Respondieron tu comentario'
          : 'Nuevo comentario en tu video',
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET status=?'),
        ['done', 'comment-1', token],
      );
    },
  );
  it('keeps video notifications pending after transient network failure', async () => {
    const { service, query } = setup();
    query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('information_schema')
          ? [{ n: 2 }]
          : sql.startsWith('SELECT comment_id')
            ? [
                {
                  comment_id: 'comment-1',
                  user_id: 'recipient',
                  token,
                  kind: 'comment',
                  attempts: 0,
                },
              ]
            : sql.startsWith('SELECT c.video_id')
              ? [{ video_id: 'video-1' }]
              : [],
      ),
    );
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await service.flush();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'estate_video_push_deliveries SET attempts=attempts+1',
      ),
      [30, 'comment-1', token],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('estate_video_push_deliveries SET status=?'),
      expect.anything(),
    );
  });
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
