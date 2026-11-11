import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Actor } from './rules';

type Delivery = {
  message_id: string;
  token: string;
  user_id: string;
  ticket: string | null;
  status: string;
  attempts: number;
  conversation_id: string;
  low_read_id: string;
  high_read_id: string;
  user_low_id: string;
};
type Ticket = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};
const validToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(
    private db: DataSource,
    private config: ConfigService,
  ) {}
  async available(db: Pick<DataSource, 'query'> | EntityManager = this.db) {
    const [row] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_push_devices','estate_push_deliveries')",
    );
    return Number(row.n) === 2;
  }
  async register(actor: Actor, token: unknown) {
    if (!validToken(token))
      throw new BadRequestException('Dispositivo inválido.');
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'Notificaciones pendientes de configurar.',
      );
    await this.db.query(
      'INSERT INTO estate_push_devices(token,user_id,updated_at) VALUES (?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),updated_at=VALUES(updated_at)',
      [token, actor.id],
    );
    return { success: true };
  }
  async unregister(actor: Actor, token: unknown) {
    if (!validToken(token))
      throw new BadRequestException('Dispositivo inválido.');
    if (await this.available())
      await this.db.query(
        'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
        [token, actor.id],
      );
    return { success: true };
  }
  async enqueue(tx: EntityManager, messageId: string, recipient: string) {
    if (!(await this.available(tx))) return;
    await tx.query(
      'INSERT IGNORE INTO estate_push_deliveries(message_id,token,user_id) SELECT ?,token,user_id FROM estate_push_devices WHERE user_id=? AND updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY',
      [messageId, recipient],
    );
  }
  onModuleInit() {
    if (
      this.config.get('NODE_ENV') !== 'production' ||
      this.config.get('PUSH_NOTIFICATIONS_ENABLED') === 'false'
    )
      return;
    this.timer = setInterval(() => {
      void this.flush().catch(() => {});
    }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async expo(path: string, body: unknown): Promise<unknown> {
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Push service unavailable');
    return response.json();
  }
  private async update(
    row: Delivery,
    status: string,
    ticket: string | null = null,
    delay = 60,
  ) {
    await this.db.query(
      'UPDATE estate_push_deliveries SET status=?,ticket=?,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE message_id=? AND token=?',
      [status, ticket, delay, row.message_id, row.token],
    );
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    const runner = this.db.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const [lock] = (await runner.query(
        "SELECT GET_LOCK('proppix-push-worker',0) locked",
      )) as { locked: number }[];
      if (!lock.locked) return;
      locked = true;
      if (!(await this.available())) return;
      const rows = await this.db.query<
        Delivery[]
      >(`SELECT CAST(d.message_id AS CHAR) message_id,d.token,d.user_id,d.ticket,d.status,d.attempts,m.conversation_id,CAST(c.low_read_id AS CHAR) low_read_id,CAST(c.high_read_id AS CHAR) high_read_id,c.user_low_id
        FROM estate_push_deliveries d JOIN estate_direct_messages m ON m.id=d.message_id JOIN estate_conversations c ON c.id=m.conversation_id
        WHERE d.status IN ('pending','receipt') AND d.due_at<=UTC_TIMESTAMP(3) ORDER BY d.due_at LIMIT 25`);
      for (const row of rows) {
        const [device] = await this.db.query<{ user_id: string }[]>(
          'SELECT user_id FROM estate_push_devices WHERE token=? AND user_id=?',
          [row.token, row.user_id],
        );
        const read =
          row.user_low_id === row.user_id ? row.low_read_id : row.high_read_id;
        if (
          !device ||
          (row.status === 'pending' && BigInt(read) >= BigInt(row.message_id))
        ) {
          await this.update(row, 'done');
          continue;
        }
        if (row.attempts >= 12) {
          await this.update(row, 'failed');
          continue;
        }
        // Persist backoff before the network call; a failed service cannot spin on this row.
        await this.db.query(
          'UPDATE estate_push_deliveries SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE message_id=? AND token=?',
          [Math.min(3600, 30 * 2 ** row.attempts), row.message_id, row.token],
        );
        try {
          let result: Ticket | undefined;
          if (row.status === 'receipt' && row.ticket) {
            const response = (await this.expo('getReceipts', {
              ids: [row.ticket],
            })) as { data?: Record<string, Ticket> };
            result = response.data?.[row.ticket];
            if (!result) continue;
          } else {
            const response = (await this.expo('send', {
              to: row.token,
              title: 'Nuevo mensaje en Proppix',
              body: 'Tienes un mensaje nuevo. Toca para abrir la conversación.',
              sound: 'default',
              channelId: 'messages',
              priority: 'high',
              ttl: 3600,
              data: {
                conversationId: row.conversation_id,
                messageId: row.message_id,
              },
            })) as { data?: Ticket };
            result = response.data;
          }
          if (result?.status === 'ok')
            await this.update(
              row,
              result.id ? 'receipt' : 'done',
              result.id || null,
              900,
            );
          else if (result?.details?.error === 'DeviceNotRegistered') {
            await this.db.query(
              'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
              [row.token, row.user_id],
            );
            await this.update(row, 'done');
          } else if (result?.details?.error !== 'MessageRateExceeded')
            await this.update(row, 'failed');
        } catch {
          /* Persisted backoff retries transient failures; messages are already committed. */
        }
      }
      await this.db.query(
        "DELETE FROM estate_push_deliveries WHERE status IN ('done','failed') AND due_at<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000",
      );
    } finally {
      if (locked)
        await runner
          .query("SELECT RELEASE_LOCK('proppix-push-worker')")
          .catch(() => {});
      await runner.release();
      this.busy = false;
    }
  }
}
