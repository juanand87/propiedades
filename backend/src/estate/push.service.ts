import { visitNoticeJoins, visitNoticeValid } from './visit-notifications';
import { notHidden, notBlocked } from './moderation-rules';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { InquiryNoticesService } from './inquiry-notices.service';
import { JWT } from 'google-auth-library';
import { readFileSync } from 'node:fs';
import { Actor } from './rules';
import { videoJoined, videoVisible } from './property-videos.service';
import {
  publicPropertyConditions,
  publicPropertyJoins,
} from './property-filters';

type VideoDelivery = {
  comment_id: string;
  token: string;
  user_id: string;
  kind: 'comment' | 'reply';
  attempts: number;
};

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
  private readonly logger = new Logger(PushService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private auth?: JWT;
  private projectId?: string;
  private healthCache?: {
    until: number;
    result: Promise<{
      provider: string;
      configured: boolean;
      google_ready: boolean;
      credential_status?: string;
    }>;
  };
  private testTimes = new Map<string, number>();
  constructor(
    private db: DataSource,
    private config: ConfigService,
    @Optional() private inquiryNotices?: InquiryNoticesService,
  ) {}
  async available(db: Pick<DataSource, 'query'> | EntityManager = this.db) {
    const [row] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_push_devices','estate_push_deliveries')",
    );
    return Number(row.n) === 2;
  }
  workerEnabled() {
    return (
      this.config.get('NODE_ENV') === 'production' &&
      this.config.get('PUSH_NOTIFICATIONS_ENABLED') !== 'false'
    );
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
  async videoCommentsAvailable(
    db: Pick<DataSource, 'query'> | EntityManager = this.db,
  ) {
    const [row] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_video_push_deliveries'",
    );
    return Number(row.n) > 0;
  }
  selfActivityEnabled() {
    return this.config.get('PUSH_SELF_ACTIVITY_ENABLED') !== 'false';
  }
  async enqueueVideoComment(
    tx: EntityManager,
    input: {
      commentId: string;
      ownerId: string;
      parentUserId?: string;
      actorId: string;
    },
  ) {
    if (!(await this.videoCommentsAvailable(tx))) return;
    const recipients = new Map<string, 'comment' | 'reply'>([
      [input.ownerId.toLowerCase(), 'comment'],
    ]);
    if (input.parentUserId)
      recipients.set(input.parentUserId.toLowerCase(), 'reply');
    for (const [recipient, kind] of recipients) {
      if (
        recipient === input.actorId.toLowerCase() &&
        !this.selfActivityEnabled()
      )
        continue;
      await tx.query(
        `INSERT IGNORE INTO estate_video_push_deliveries(comment_id,user_id,token,kind)
        SELECT ?,d.user_id,d.token,? FROM estate_push_devices d JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=d.user_id
        WHERE d.user_id=? AND u.isActive=1 AND d.updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY`,
        [input.commentId, kind, recipient],
      );
    }
  }
  onModuleInit() {
    if (!this.workerEnabled()) return;
    this.timer = setInterval(() => {
      void this.flush().catch((error: unknown) => {
        const code = (error as { code?: string })?.code;
        this.logger.error(
          'No se pudo procesar la cola de notificaciones' +
            (code && /^[A-Z0-9_]+$/.test(code) ? ': ' + code : '.'),
        );
      });
    }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private credentials() {
    if (this.auth && this.projectId)
      return { auth: this.auth, projectId: this.projectId };
    const encoded = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    const raw = encoded
      ? Buffer.from(encoded.trim(), 'base64').toString('utf8')
      : this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
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
  async health() {
    if (this.healthCache && this.healthCache.until > Date.now())
      return this.healthCache.result;
    const result = (async () => {
      try {
        this.credentials();
      } catch (error) {
        const present = Boolean(
          this.config.get('FIREBASE_SERVICE_ACCOUNT_BASE64') ||
          this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON') ||
          this.config.get('FIREBASE_SERVICE_ACCOUNT_FILE'),
        );
        return {
          provider: 'fcm-direct',
          configured: false,
          google_ready: false,
          credential_status: !present
            ? 'missing_in_backend'
            : error instanceof SyntaxError
              ? 'invalid_json_or_base64'
              : error instanceof Error &&
                  error.message.includes('no corresponde')
                ? 'project_mismatch'
                : 'invalid_service_account',
        };
      }
      try {
        const { auth, projectId } = this.credentials();
        const { token } = await auth.getAccessToken();
        const response = await fetch(
          'https://fcm.googleapis.com/v1/projects/' +
            projectId +
            '/messages:send',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              validate_only: true,
              message: {
                topic: 'proppix-configuration-check',
                notification: { title: 'Validation', body: 'Dry run' },
              },
            }),
            signal: AbortSignal.timeout(10000),
          },
        );
        return {
          provider: 'fcm-direct',
          configured: true,
          google_ready: response.ok,
        };
      } catch {
        return {
          provider: 'fcm-direct',
          configured: true,
          google_ready: false,
        };
      }
    })();
    this.healthCache = { until: Date.now() + 60000, result };
    return result;
  }
  async testOwnDevices(actor: Actor) {
    if (this.config.get('PUSH_SELF_TEST_ENABLED') === 'false')
      throw new BadRequestException(
        'La prueba de notificaciones está desactivada.',
      );
    const now = Date.now();
    if ((this.testTimes.get(actor.id) || 0) > now - 30000)
      throw new BadRequestException(
        'Espera 30 segundos para repetir la prueba.',
      );
    for (const [id, time] of this.testTimes)
      if (time < now - 60000) this.testTimes.delete(id);
    this.testTimes.set(actor.id, now);
    if (!(await this.health()).google_ready)
      throw new ServiceUnavailableException(
        'Firebase no está listo en el servidor.',
      );
    const devices = await this.db.query<{ token: string }[]>(
      'SELECT token FROM estate_push_devices WHERE user_id=? ORDER BY updated_at DESC LIMIT 10',
      [actor.id],
    );
    let accepted = 0;
    for (const device of devices) {
      if (!validFcmToken(device.token)) continue;
      const result = await this.sendFcm(
        { token: device.token, message_id: 'test-' + now, conversation_id: '' },
        true,
      );
      if (result === 'sent') accepted++;
      else if (result === 'unregistered')
        await this.db.query(
          'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
          [device.token, actor.id],
        );
    }
    if (!accepted)
      throw new BadRequestException(
        'No hay dispositivos activos. Instala la última versión, inicia sesión y activa las notificaciones.',
      );
    return {
      accepted,
      message: 'Firebase aceptó el aviso de prueba para tu propia cuenta.',
    };
  }
  async videoUploadReady(
    userId: string,
    videoId: string,
    uploadId: string,
    failed = false,
  ) {
    const devices = await this.db.query<{ token: string }[]>(
      'SELECT token FROM estate_push_devices WHERE user_id=? ORDER BY updated_at DESC LIMIT 10',
      [userId],
    );
    let accepted = 0;
    for (const device of devices) {
      if (!validFcmToken(device.token)) continue;
      const result = await this.sendFcm(
        { token: device.token, message_id: uploadId, conversation_id: '' },
        false,
        undefined,
        undefined,
        undefined,
        { videoId, uploadId, failed },
      );
      if (result === 'sent') accepted++;
      else if (result === 'unregistered')
        await this.db.query(
          'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
          [device.token, userId],
        );
    }
    return accepted > 0;
  }
  private async sendFcm(
    row: Pick<Delivery, 'token' | 'message_id' | 'conversation_id'>,
    test = false,
    activity?: {
      videoId: string;
      commentId: string;
      kind: 'comment' | 'reply';
    },
    property?: { propertyId: string; matchId: string },
    visit?: { id: string; noticeId: string; title: string },
    upload?: { videoId: string; uploadId: string; failed: boolean },
    lead?: { inquiryId: string; noticeId: string },
  ) {
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
              title: upload
                ? upload.failed
                  ? 'Revisa la carga de tu video'
                  : 'Tu video está listo'
                : visit
                  ? visit.title
                  : property
                    ? 'Nueva propiedad para tu búsqueda'
                    : activity
                      ? activity.kind === 'reply'
                        ? 'Respondieron tu comentario'
                        : 'Nuevo comentario en tu video'
                      : test
                        ? 'Prueba de Proppix'
                        : 'Nuevo mensaje en Proppix',
              body: upload
                ? upload.failed
                  ? 'No pudimos preparar tu video. Toca para revisar lo ocurrido.'
                  : 'Terminamos de preparar tu video. Toca para verlo y continuar.'
                : visit
                  ? 'Revisa la agenda de visitas en Proppix para ver los detalles.'
                  : property
                    ? 'Encontramos una propiedad que coincide con tus filtros. Toca para verla.'
                    : activity
                      ? activity.kind === 'reply'
                        ? 'Recibiste una respuesta en un video de Proppix.'
                        : 'Tu video recibió un comentario nuevo en Proppix.'
                      : test
                        ? 'Las notificaciones de tu cuenta están funcionando.'
                        : 'Tienes un mensaje nuevo. Toca para abrir la conversación.',
              ...(lead
                ? {
                    title: 'Nuevo interesado asignado',
                    body: 'Tu empresa te asignó una consulta. Toca para revisar los datos y continuar el seguimiento.',
                  }
                : {}),
            },
            data: {
              ...(lead
                ? {
                    type: 'inquiry_assignment',
                    inquiryId: lead.inquiryId,
                    noticeId: lead.noticeId,
                  }
                : {}),
              ...(upload
                ? {
                    type: 'video_ready',
                    videoId: upload.videoId,
                    uploadId: upload.uploadId,
                  }
                : {}),
              ...(visit
                ? { type: 'visit', visitId: visit.id, noticeId: visit.noticeId }
                : {}),
              ...(property
                ? {
                    type: 'property_match',
                    propertyId: property.propertyId,
                    searchMatchId: property.matchId,
                  }
                : {}),
              conversationId: row.conversation_id,
              messageId: row.message_id,
              ...(test ? { test: 'true' } : {}),
              ...(activity
                ? {
                    videoId: activity.videoId,
                    commentId: activity.commentId,
                    type: activity.kind,
                  }
                : {}),
            },
            android: {
              priority: 'HIGH',
              ttl: '3600s',
              restricted_package_name: 'cl.proppix.app',
              notification: {
                channel_id: 'messages',
                sound: 'default',
                icon: 'notification_icon',
                tag: lead
                  ? 'inquiry-assignment-' + lead.noticeId
                  : upload
                    ? 'video-ready-' + upload.uploadId
                    : visit
                      ? 'visit-' + visit.noticeId
                      : property
                        ? 'property-match-' + property.matchId
                        : activity
                          ? 'video-comment-' + activity.commentId
                          : 'message-' + row.message_id,
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
  private async flushVideoComments() {
    if (!(await this.videoCommentsAvailable())) return;
    const rows = await this.db.query<VideoDelivery[]>(
      "SELECT comment_id,user_id,token,kind,attempts FROM estate_video_push_deliveries WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,comment_id LIMIT 25",
    );
    for (const row of rows) {
      const update = (status: string) =>
        this.db.query(
          'UPDATE estate_video_push_deliveries SET status=? WHERE comment_id=? AND token=?',
          [status, row.comment_id, row.token],
        );
      const [event] = await this.db.query<{ video_id: string }[]>(
        `SELECT c.video_id FROM estate_video_comments c JOIN users author ON CONVERT(author.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=c.user_id AND author.isActive=1 JOIN users recipient ON recipient.id=? AND recipient.isActive=1
        JOIN estate_push_devices d ON d.user_id=CONVERT(recipient.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND d.token=?
        JOIN property_videos ownvideo ON ownvideo.id=c.video_id AND ownvideo.status<>'archived'
        WHERE ${notHidden('comment', 'c.id')} AND ${notHidden('video', 'ownvideo.id')} AND ${notBlocked('recipient.id', 'c.user_id')} AND ${notBlocked('recipient.id', 'ownvideo.created_by')} AND c.id=? AND (ownvideo.created_by=? OR EXISTS(SELECT 1 ${videoJoined} WHERE v.id=c.video_id AND ${videoVisible}))`,
        [row.user_id, row.token, row.comment_id, row.user_id],
      );
      if (!event || !validFcmToken(row.token)) {
        await update('done');
        continue;
      }
      if (row.attempts >= 12) {
        await update('failed');
        continue;
      }
      await this.db.query(
        'UPDATE estate_video_push_deliveries SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE comment_id=? AND token=?',
        [Math.min(3600, 30 * 2 ** row.attempts), row.comment_id, row.token],
      );
      try {
        const result = await this.sendFcm(
          { token: row.token, message_id: row.comment_id, conversation_id: '' },
          false,
          {
            videoId: event.video_id,
            commentId: row.comment_id,
            kind: row.kind,
          },
        );
        if (result === 'unregistered')
          await this.db.query(
            'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
            [row.token, row.user_id],
          );
        await update(result === 'invalid' ? 'failed' : 'done');
      } catch {
        /* Leave the durable event pending with its persisted retry time. */
      }
    }
    await this.db.query(
      "DELETE FROM estate_video_push_deliveries WHERE status IN ('done','failed') AND due_at<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000",
    );
  }
  private async flushSearchMatches() {
    const [schema] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_search_push_deliveries'",
    );
    if (!Number(schema.n)) return;
    const rows = await this.db.query<
      { match_id: string; token: string; user_id: string; attempts: number }[]
    >(
      "SELECT CAST(match_id AS CHAR) match_id,token,user_id,attempts FROM estate_search_push_deliveries WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,match_id LIMIT 25",
    );
    for (const row of rows) {
      const update = (status: string) =>
        this.db.query(
          'UPDATE estate_search_push_deliveries SET status=? WHERE match_id=? AND token=?',
          [status, row.match_id, row.token],
        );
      const [event] = await this.db.query<{ property_id: string }[]>(
        `SELECT p.id property_id ${publicPropertyJoins} JOIN estate_search_matches m ON m.property_id=p.id JOIN estate_saved_searches s ON s.id=m.search_id JOIN users recipient ON recipient.id=s.user_id AND recipient.isActive=1 JOIN estate_push_devices d ON d.user_id=s.user_id AND d.token=? WHERE m.id=? AND s.user_id=? AND s.enabled=1 AND m.read_at IS NULL AND ${publicPropertyConditions} AND p.availability='available'`,
        [row.token, row.match_id, row.user_id],
      );
      if (!event || !validFcmToken(row.token)) {
        await update('done');
        continue;
      }
      if (row.attempts >= 12) {
        await update('failed');
        continue;
      }
      await this.db.query(
        'UPDATE estate_search_push_deliveries SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE match_id=? AND token=?',
        [Math.min(3600, 30 * 2 ** row.attempts), row.match_id, row.token],
      );
      try {
        const result = await this.sendFcm(
          { token: row.token, message_id: row.match_id, conversation_id: '' },
          false,
          undefined,
          { propertyId: event.property_id, matchId: row.match_id },
        );
        if (result === 'unregistered')
          await this.db.query(
            'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
            [row.token, row.user_id],
          );
        await update(result === 'invalid' ? 'failed' : 'done');
      } catch {
        /* Keep persisted retry after transient FCM failure. */
      }
    }
    await this.db.query(
      "DELETE FROM estate_search_push_deliveries WHERE status IN ('done','failed') AND due_at<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000",
    );
  }
  private async flushVisits() {
    const [schema] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_visit_notices'",
    );
    if (!Number(schema.n)) return;
    const notices = await this.db.query<{ id: string }[]>(
      'SELECT id FROM estate_visit_notices WHERE expanded=0 AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,id LIMIT 25',
    );
    for (const notice of notices)
      await this.db.transaction(async (tx) => {
        const [row] = await tx.query<{ id: string }[]>(
          'SELECT id FROM estate_visit_notices WHERE id=? AND expanded=0 FOR UPDATE',
          [notice.id],
        );
        if (!row) return;
        await tx.query(
          `INSERT IGNORE INTO estate_visit_push(notice_id,token,user_id) SELECT n.id,d.token,n.user_id ${visitNoticeJoins} JOIN estate_push_devices d ON d.user_id=n.user_id AND d.updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY WHERE n.id=? AND ${visitNoticeValid}`,
          [notice.id],
        );
        await tx.query(
          'UPDATE estate_visit_notices SET expanded=1 WHERE id=?',
          [notice.id],
        );
      });
    const rows = await this.db.query<
      { notice_id: string; token: string; user_id: string; attempts: number }[]
    >(
      "SELECT notice_id,token,user_id,attempts FROM estate_visit_push WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,notice_id LIMIT 25",
    );
    for (const row of rows) {
      const update = (status: string) =>
        this.db.query(
          'UPDATE estate_visit_push SET status=? WHERE notice_id=? AND token=?',
          [status, row.notice_id, row.token],
        );
      const [event] = await this.db.query<
        { booking_id: string; title: string }[]
      >(
        `SELECT n.booking_id,n.title ${visitNoticeJoins} JOIN estate_push_devices d ON d.user_id=n.user_id AND d.token=? WHERE n.id=? AND n.user_id=? AND ${visitNoticeValid}`,
        [row.token, row.notice_id, row.user_id],
      );
      if (!event || !validFcmToken(row.token)) {
        await update('done');
        continue;
      }
      if (row.attempts >= 12) {
        await update('failed');
        continue;
      }
      await this.db.query(
        'UPDATE estate_visit_push SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE notice_id=? AND token=?',
        [Math.min(3600, 30 * 2 ** row.attempts), row.notice_id, row.token],
      );
      try {
        const result = await this.sendFcm(
          { token: row.token, message_id: row.notice_id, conversation_id: '' },
          false,
          undefined,
          undefined,
          { id: event.booking_id, noticeId: row.notice_id, title: event.title },
        );
        if (result === 'unregistered')
          await this.db.query(
            'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
            [row.token, row.user_id],
          );
        await update(result === 'invalid' ? 'failed' : 'done');
      } catch {
        /* Retry with persisted backoff. */
      }
    }
    await this.db.query(
      "DELETE FROM estate_visit_push WHERE status IN ('done','failed') AND due_at<UTC_TIMESTAMP()-INTERVAL 7 DAY LIMIT 1000",
    );
    await this.db.query(
      'DELETE FROM estate_visit_notices WHERE expanded=1 AND due_at<UTC_TIMESTAMP()-INTERVAL 30 DAY LIMIT 1000',
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
          `SELECT user_id FROM estate_push_devices WHERE token=? AND user_id=? AND EXISTS(SELECT 1 FROM users WHERE CONVERT(id USING utf8mb4) COLLATE utf8mb4_unicode_ci=estate_push_devices.user_id AND isActive=1) AND NOT EXISTS(SELECT 1 FROM estate_direct_messages message JOIN estate_user_blocks blocked ON (blocked.blocker_id=message.sender_id AND blocked.blocked_id=estate_push_devices.user_id) OR (blocked.blocked_id=message.sender_id AND blocked.blocker_id=estate_push_devices.user_id) WHERE message.id=?)`,
          [row.token, row.user_id, row.message_id],
        );
        // Polling can mark a message read before this worker runs. A committed
        // message still has a delivery to perform; read cursors are not receipts.
        if (!device) {
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
      await this.flushVideoComments();
      await this.flushSearchMatches();
      await this.flushVisits();
      await this.inquiryNotices?.flush((token, noticeId, inquiryId) =>
        this.sendFcm(
          { token, message_id: noticeId, conversation_id: '' },
          false,
          undefined,
          undefined,
          undefined,
          undefined,
          { inquiryId, noticeId },
        ),
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
