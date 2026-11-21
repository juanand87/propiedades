import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Actor, ownership, uuid } from './rules';
import {
  assertPropertyVideos,
  recordingLimit,
  validateMp4,
  videoTitle,
} from './property-videos';
import { PropertyVideosService } from './property-videos.service';
import { VideoStorageService } from './video-storage.service';
import { EstateService } from './estate.service';
import { PushService } from './push.service';

type Job = {
  id: string;
  user_id: string;
  property_id: string | null;
  digest: string;
  source_key: string | null;
  body_json: string;
  status: string;
  video_id: string | null;
  result_json: string | null;
  error_text: string | null;
  attempts: number;
};
@Injectable()
export class VideoUploadJobsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private folder = resolve(__dirname, '../../..', 'tmp/video-upload-jobs');
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private storage: VideoStorageService,
    private videos: PropertyVideosService,
    private estate: EstateService,
    private push: PushService,
  ) {}
  async available() {
    const [row] = await this.db.query(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_video_upload_jobs'",
    );
    return Number(row.n) === 1;
  }
  private async guard() {
    assertPropertyVideos(
      Object.fromEntries(
        [
          'NODE_ENV',
          'PROJECT_ID',
          'DB_DATABASE',
          'DB_HOST',
          'DB_PORT',
          'PROPERTY_VIDEOS_ENABLED',
        ].map((k) => [k, this.config.get(k)]),
      ),
      this.storage.enabled,
    );
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'El procesamiento de videos todavía no está habilitado.',
      );
  }
  private async own(actor: Actor, id: string) {
    await this.guard();
    const [row] = await this.db.query<Job[]>(
      'SELECT * FROM estate_video_upload_jobs WHERE id=? AND user_id=?',
      [uuid(id), actor.id],
    );
    if (!row) throw new NotFoundException('Carga no encontrada.');
    return row;
  }
  private view(row: Job) {
    return {
      upload_id: row.id,
      processing_status: row.status,
      video_id: row.video_id,
      result: row.result_json ? JSON.parse(row.result_json) : null,
      message: row.error_text,
    };
  }
  async status(actor: Actor, id: string) {
    const row = await this.own(actor, id);
    if (row.status === 'ready') {
      const [video] = await this.db.query(
        "SELECT id,title,status,property_id FROM property_videos WHERE id=? AND created_by=? AND status<>'archived'",
        [row.video_id, actor.id],
      );
      if (!video)
        throw new NotFoundException('Este video ya no está disponible.');
      row.result_json = JSON.stringify(video);
    }
    return this.view(row);
  }
  async retry(actor: Actor, id: string) {
    const row = await this.own(actor, id);
    if (row.status !== 'failed') return this.view(row);
    if (!row.source_key)
      throw new BadRequestException(
        'La carga venció. Vuelve a seleccionar el video.',
      );
    const result = await this.db.query<{ affectedRows: number }>(
      "UPDATE estate_video_upload_jobs SET status='pending',attempts=0,error_text=NULL,notified_at=NULL,notify_due_at=UTC_TIMESTAMP(3),due_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=? AND status='failed' AND updated_at<UTC_TIMESTAMP()-INTERVAL 30 SECOND",
      [row.id, actor.id],
    );
    if (!result.affectedRows)
      throw new BadRequestException(
        'Espera 30 segundos antes de reintentar el procesamiento.',
      );
    return this.status(actor, id);
  }
  async notify(actor: Actor, id: string) {
    const row = await this.own(actor, id);
    if (row.status === 'failed')
      throw new BadRequestException(
        row.error_text || 'No se pudo procesar el video.',
      );
    if (!(await this.push.health()).google_ready)
      throw new ServiceUnavailableException(
        'No se pudo activar el aviso. Puedes esperar aquí y reintentar.',
      );
    const [device] = await this.db.query(
      'SELECT token FROM estate_push_devices WHERE user_id=? LIMIT 1',
      [actor.id],
    );
    if (!device)
      throw new BadRequestException(
        'Activa las notificaciones de Proppix en tu teléfono para recibir el aviso.',
      );
    await this.db.query(
      'UPDATE estate_video_upload_jobs SET notify_requested=1,notify_due_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?',
      [row.id, actor.id],
    );
    return { ...this.view(row), notification_requested: true };
  }
  async receive(actor: Actor, body: any, file: any) {
    await this.guard();
    validateMp4(file);
    const id = uuid(body.request_id),
      propertyId = body.property_id ? uuid(body.property_id) : null;
    if (propertyId) {
      const property = await this.estate.get(propertyId, actor);
      ownership(actor, property.advertiser_id);
    } else if (this.config.get('SOCIAL_VIDEOS_ENABLED') !== 'true')
      throw new ServiceUnavailableException(
        'Los videos independientes no están habilitados.',
      );
    if (body.publish !== undefined && !['true', 'false'].includes(body.publish))
      throw new BadRequestException('Estado inválido.');
    const parameters = {
      title: videoTitle(body.title),
      request_id: id,
      publish: body.publish || 'false',
      ...(recordingLimit(body.capture_seconds)
        ? { capture_seconds: String(recordingLimit(body.capture_seconds)) }
        : {}),
    };
    const digest = createHash('sha256')
      .update(file.buffer)
      .update(JSON.stringify([propertyId, parameters]))
      .digest('hex');
    const existing = async () => {
      const [row] = await this.db.query<Job[]>(
        'SELECT * FROM estate_video_upload_jobs WHERE id=?',
        [id],
      );
      if (!row) return null;
      if (row.user_id !== actor.id || row.digest !== digest)
        throw new ConflictException(
          'Este identificador corresponde a otra carga.',
        );
      return this.view(row);
    };
    const previous = await existing();
    if (previous) return previous;
    // Durable private original BEFORE acknowledging receipt to the phone.
    const source = randomUUID(),
      key = this.storage.enabled ? this.storage.objectKey(source) : source;
    if (this.storage.enabled) await this.storage.put(key, file.buffer);
    else {
      await mkdir(this.folder, { recursive: true });
      await writeFile(resolve(this.folder, source + '.mp4'), file.buffer, {
        flag: 'wx',
      });
    }
    try {
      await this.db.transaction(async (tx) => {
        await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [
          actor.id,
        ]);
        const [used] = await tx.query(
          "SELECT COUNT(*) n FROM estate_video_upload_jobs WHERE user_id=? AND status IN ('pending','processing','preparing')",
          [actor.id],
        );
        if (Number(used.n) >= 3)
          throw new ConflictException(
            'Espera a que terminen tus videos pendientes antes de subir otro.',
          );
        await tx.query(
          'INSERT INTO estate_video_upload_jobs(id,user_id,property_id,digest,source_key,body_json) VALUES (?,?,?,?,?,?)',
          [id, actor.id, propertyId, digest, key, JSON.stringify(parameters)],
        );
      });
    } catch (error) {
      // A lost commit acknowledgement can still mean it was saved.
      const saved = await existing().catch(() => null);
      const [owner] = await this.db.query<Job[]>(
        'SELECT source_key FROM estate_video_upload_jobs WHERE id=?',
        [id],
      );
      if (owner?.source_key !== key)
        await this.removeSource(key).catch(() => {});
      if (saved) return saved;
      throw error;
    }
    return this.status(actor, id);
  }
  private async removeSource(key: string) {
    if (this.storage.enabled) await this.storage.remove(key);
    else await unlink(resolve(this.folder, uuid(key) + '.mp4')).catch(() => {});
  }
  onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'production') return;
    this.timer = setInterval(
      () => void this.processNext().catch(() => {}),
      5000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async processNext() {
    if (this.busy) return;
    this.busy = true;
    const runner = this.db.createQueryRunner();
    let locked = false;
    try {
      if (!(await this.available())) return;
      await runner.connect();
      const [lock] = await runner.query(
        "SELECT GET_LOCK('proppix-upload-worker',0) locked",
      );
      if (!lock.locked) return;
      locked = true;
      // A process restart resumes the durable original; request_id prevents duplicates.
      await this.db.query(
        "UPDATE estate_video_upload_jobs SET status='pending' WHERE status='processing'",
      );
      const [job] = await this.db.query<Job[]>(
        "SELECT * FROM estate_video_upload_jobs WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY created_at LIMIT 1",
      );
      if (job) {
        await this.db.query(
          "UPDATE estate_video_upload_jobs SET status='processing',attempts=attempts+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?",
          [job.id],
        );
        try {
          const actor = await this.estate.actor(job.user_id);
          // Recover an already committed upload without recompressing it after a restart.
          const [saved] = await this.db.query(
            "SELECT v.id,v.property_id,v.title,v.status FROM property_video_recordings r JOIN property_videos v ON v.id=r.video_id WHERE r.request_id=? AND v.created_by=? AND v.status<>'archived'",
            [job.id, job.user_id],
          );
          const bytes = saved
            ? null
            : this.storage.enabled
              ? await this.storage.readOriginal(job.source_key!)
              : await readFile(
                  resolve(this.folder, uuid(job.source_key) + '.mp4'),
                );
          const result =
            saved ||
            (await this.videos.upload(
              actor,
              job.property_id,
              JSON.parse(job.body_json),
              { buffer: bytes, mimetype: 'video/mp4' },
            ));
          await this.db.query(
            "UPDATE estate_video_upload_jobs SET status='preparing',video_id=?,result_json=?,error_text=NULL,updated_at=UTC_TIMESTAMP(3) WHERE id=?",
            [result.id, JSON.stringify(result), job.id],
          );
        } catch (error) {
          const permanent =
            error instanceof HttpException &&
            error.getStatus() >= 400 &&
            error.getStatus() < 500;
          const failed = permanent || job.attempts + 1 >= 4;
          const message = permanent
            ? error.message.slice(0, 500)
            : 'No pudimos preparar el video. Revisa Mis videos o vuelve a intentarlo.';
          await this.db.query(
            'UPDATE estate_video_upload_jobs SET status=?,error_text=?,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE id=?',
            [
              failed ? 'failed' : 'pending',
              failed ? message : null,
              30 * 2 ** job.attempts,
              job.id,
            ],
          );
        }
      }
      // Wait for adaptive playback; if HLS fails, the valid MP4 remains usable.
      const [hls] = await this.db.query(
        "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='property_video_hls'",
      );
      const pending = await this.db.query<Job[]>(
        "SELECT * FROM estate_video_upload_jobs WHERE status='preparing' LIMIT 20",
      );
      for (const row of pending) {
        const [encoding] =
          Number(hls.n) && this.config.get('VIDEOS_HLS_ENABLED') !== 'false'
            ? await this.db.query(
                'SELECT status FROM property_video_hls WHERE video_id=?',
                [row.video_id],
              )
            : [];
        if (encoding && !['ready', 'failed'].includes(encoding.status))
          continue;
        await this.db.query(
          "UPDATE estate_video_upload_jobs SET status='ready',updated_at=UTC_TIMESTAMP(3) WHERE id=?",
          [row.id],
        );
      }
      const notices = await this.db.query<Job[]>(
        "SELECT * FROM estate_video_upload_jobs WHERE status IN ('ready','failed') AND notify_requested=1 AND notified_at IS NULL AND notify_due_at<=UTC_TIMESTAMP(3) LIMIT 10",
      );
      for (const row of notices) {
        try {
          const [video] = await this.db.query(
            "SELECT id FROM property_videos WHERE id=? AND created_by=? AND status<>'archived'",
            [row.video_id, row.user_id],
          );
          if (!video && row.status !== 'failed') {
            await this.db.query(
              'UPDATE estate_video_upload_jobs SET notified_at=UTC_TIMESTAMP(3) WHERE id=?',
              [row.id],
            );
            continue;
          }
          if (
            await this.push.videoUploadReady(
              row.user_id,
              row.video_id || '',
              row.id,
              row.status === 'failed',
            )
          )
            await this.db.query(
              'UPDATE estate_video_upload_jobs SET notified_at=UTC_TIMESTAMP(3) WHERE id=?',
              [row.id],
            );
          else throw Error('No active device');
        } catch {
          await this.db.query(
            'UPDATE estate_video_upload_jobs SET notify_attempts=notify_attempts+1,notify_due_at=TIMESTAMPADD(SECOND,LEAST(3600,30*POW(2,LEAST(notify_attempts,7))),UTC_TIMESTAMP(3)) WHERE id=?',
            [row.id],
          );
        }
      }
      const cleanup = await this.db.query<Job[]>(
        "SELECT * FROM estate_video_upload_jobs WHERE source_key IS NOT NULL AND (status='ready' OR (status='failed' AND updated_at<UTC_TIMESTAMP()-INTERVAL 7 DAY)) LIMIT 5",
      );
      for (const row of cleanup) {
        await this.removeSource(row.source_key!)
          .then(() =>
            this.db.query(
              'UPDATE estate_video_upload_jobs SET source_key=NULL WHERE id=?',
              [row.id],
            ),
          )
          .catch(() => {});
      }
    } finally {
      if (locked)
        await runner
          .query("SELECT RELEASE_LOCK('proppix-upload-worker')")
          .catch(() => {});
      await runner.release();
      this.busy = false;
    }
  }
}
