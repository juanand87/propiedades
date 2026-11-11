import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'node:fs';
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
export const validFcmToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_:-]{20,255}$/.test(value);

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private auth?: JWT;
  private projectId?: string;
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
    if (!validFcmToken(token))
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
    if (!validFcmToken(token))
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
  private credentials() {
    if (this.auth && this.projectId)
      return { auth: this.auth, projectId: this.projectId };
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const file = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_FILE');
    if (!raw && !file)
      throw new ServiceUnavailableException(
        'Falta configurar Firebase en el servidor.',
      );
    const credentials = JSON.parse(raw || readFileSync(file!, 'utf8')) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
      token_uri?: string;
    };
    if (
      !credentials.project_id ||
      !/^[a-z0-9-]+$/.test(credentials.project_id) ||
      !credentials.client_email?.endsWith('.gserviceaccount.com') ||
      !credentials.private_key?.includes('BEGIN PRIVATE KEY')
    )
      throw new ServiceUnavailableException('Credencial de Firebase inválida.');
    const expected = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (expected && expected !== credentials.project_id)
      throw new ServiceUnavailableException(
        'El proyecto Firebase no corresponde.',
      );
    // Restrict OAuth exchange to Google's endpoint, regardless of JSON metadata.
    this.auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    this.projectId = credentials.project_id;
    return { auth: this.auth, projectId: this.projectId };
  }
  private async sendFcm(row: Delivery) {
    const { auth, projectId } = this.credentials();
    const { token: accessToken } = await auth.getAccessToken();
    if (!accessToken) throw new Error('Firebase authorization unavailable');
    const response = await fetch(
      'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: {
              title: 'Nuevo mensaje en Proppix',
              body: 'Tienes un mensaje nuevo. Toca para abrir la conversación.',
            },
            data: {
              conversationId: row.conversation_id,
              messageId: row.message_id,
            },
            android: {
              priority: 'HIGH',
              ttl: '3600s',
              restricted_package_name: 'cl.proppix.app',
              notification: {
                channel_id: 'messages',
                sound: 'default',
                icon: 'notification_icon',
                tag: 'message-' + row.message_id,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = (await response.json()) as {
      name?: string;
      error?: { details?: { errorCode?: string }[] };
    };
    if (response.ok && result.name) return 'sent';
    if (
      result.error?.details?.some(
        (detail) => detail.errorCode === 'UNREGISTERED',
      )
    )
      return 'unregistered';
    if (response.status === 400) return 'invalid';
    throw new Error('Firebase temporarily unavailable');
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
    // Do not consume queued attempts while the server credential is absent.
    this.credentials();
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
          if (!validFcmToken(row.token) || row.status === 'receipt') {
            await this.update(row, 'failed');
            continue;
          }
          const result = await this.sendFcm(row);
          if (result === 'sent') await this.update(row, 'done');
          else if (result === 'unregistered') {
            await this.db.query(
              'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
              [row.token, row.user_id],
            );
            await this.update(row, 'done');
          } else await this.update(row, 'failed');
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
