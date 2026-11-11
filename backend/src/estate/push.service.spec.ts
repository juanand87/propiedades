import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PushService } from './push.service';

describe('message push delivery', () => {
  const token = 'ExpoPushToken[local_test_0123456789]';
  function setup(overrides = {}, device = true) {
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
    return {
      service: new PushService(db, new ConfigService({})),
      query,
      runner,
    };
  }
  afterEach(() => jest.restoreAllMocks());
  it('sends a conversation link without leaking message text and saves the receipt ticket', async () => {
    const { service, query, runner } = setup();
    const network = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { status: 'ok', id: 'receipt-1' } }),
    } as Response);
    await service.flush();
    const payload = JSON.parse(network.mock.calls[0][1]!.body as string) as {
      data: { conversationId: string };
      body: string;
    };
    expect(payload.data.conversationId).toBe('chat');
    expect(payload.body).toBe(
      'Tienes un mensaje nuevo. Toca para abrir la conversación.',
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SET status='), [
      'receipt',
      'receipt-1',
      900,
      '5',
      token,
    ]);
    expect(runner.release).toHaveBeenCalled();
  });
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
  it('removes invalid tokens after checking delivery receipts', async () => {
    const { service, query } = setup({
      status: 'receipt',
      ticket: 'receipt-1',
    });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          'receipt-1': {
            status: 'error',
            details: { error: 'DeviceNotRegistered' },
          },
        },
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
