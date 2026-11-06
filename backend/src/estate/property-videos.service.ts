import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { Actor, ownership, uuid, choice } from './rules';
import {
  assertPropertyVideos,
  validateMp4,
  videoRange,
  videoTitle,
  recordingLimit,
  validateVideoProbe,
} from './property-videos';
import { EstateService } from './estate.service';
import { VideoStorageService } from './video-storage.service';

const visible = `v.status='published' AND p.publication_status='published' AND a.status='approved' AND u.isActive=1`;
const joined = `FROM property_videos v JOIN properties p ON p.id=v.property_id JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id`;
@Injectable()
export class PropertyVideosService {
  private folder = resolve(__dirname, '../../..', 'tmp/mobile-videos');
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private estate: EstateService,
    private storage: VideoStorageService,
  ) {}
  private guard() {
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
  }
  environment() {
    this.guard();
    return {
      project: 'propiedades',
      environment:
        this.config.get('NODE_ENV') === 'production'
          ? 'production'
          : 'local-mobile',
      videos: true,
      apiVersion: 2,
      recordingDurations: [15, 30, 45],
      videoStorage: this.storage.enabled ? 'spaces' : 'local',
    };
  }
  capabilities() {
    try {
      this.guard();
      return {
        enabled: true,
        storage: this.storage.enabled ? 'spaces' : 'local',
        version: 1,
      };
    } catch {
      return { enabled: false, storage: 'disabled', version: 1 };
    }
  }
  async feed(q: any) {
    this.guard();
    const page = Math.max(1, Math.min(10000, Number.parseInt(q.page, 10) || 1));
    const limit = 5;
    const type =
      typeof q.type_id === 'string' && q.type_id.length <= 30 ? q.type_id : '';
    const filter = type ? ' AND p.type_id=?' : '',
      params = type ? [type] : [];
    const [count] = await this.db.query(
      `SELECT COUNT(*) total ${joined} WHERE ${visible}${filter}`,
      params,
    );
    const rows = await this.db.query(
      `SELECT v.id,v.property_id,v.title,v.size_bytes,r.duration_ms,r.capture_seconds ${joined} LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE ${visible}${filter} ORDER BY v.created_at DESC,v.id LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    return {
      items: await Promise.all(
        rows.map(async (v: any) => ({
          ...v,
          url: `/api/videos/${v.id}/content`,
          property: await this.estate.get(v.property_id),
        })),
      ),
      total: Number(count.total),
      page,
      pages: Math.ceil(Number(count.total) / limit),
    };
  }
  async list(actor: Actor, id: string) {
    this.guard();
    await this.estate.get(uuid(id), actor);
    return this.db.query(
      "SELECT v.id,v.property_id,v.title,v.status,v.size_bytes,v.created_at,r.duration_ms,r.capture_seconds FROM property_videos v LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE v.property_id=? AND v.status<>'archived' ORDER BY v.created_at DESC,v.id",
      [id],
    );
  }
  async upload(actor: Actor, id: string, body: any, file: any) {
    this.guard();
    await this.estate.get(uuid(id), actor);
    validateMp4(file);
    if (this.storage.enabled)
      await this.db.query(
        'SELECT video_id,object_key,bucket,sha256,status FROM property_video_objects LIMIT 0',
      );
    const title = videoTitle(body.title),
      videoId = randomUUID();
    const limit = recordingLimit(body.capture_seconds);
    const publish = choice(body.publish, ['true', 'false'], 'false') === 'true';
    const requestId =
      body.request_id === undefined ? null : uuid(body.request_id);
    if (publish && !requestId)
      throw new BadRequestException('Falta el identificador de publicación.');
    const digest = createHash('sha256')
      .update(file.buffer)
      .update(JSON.stringify([id, title, limit, publish]))
      .digest('hex');
    await mkdir(this.folder, { recursive: true });
    const filename = resolve(this.folder, videoId + '.mp4');
    await writeFile(filename, file.buffer, {
      flag: 'wx',
    });
    let result: any;
    let objectCreated = false;
    try {
      let metadata: any;
      try {
        // Validate actual MP4 duration/codec using a bounded local probe, never a remote URL.
        const probePath = require('ffprobe-static').path;
        const { stdout } = await promisify(execFile)(
          probePath,
          [
            '-protocol_whitelist',
            'file',
            '-v',
            'error',
            '-show_streams',
            '-show_format',
            '-of',
            'json',
            filename,
          ],
          { timeout: 15000, maxBuffer: 512 * 1024, windowsHide: true },
        );
        metadata = JSON.parse(stdout);
      } catch {
        throw new BadRequestException(
          'No se pudo leer el video. Utiliza un MP4/H.264 válido.',
        );
      }
      const duration = validateVideoProbe(metadata, limit);
      if (this.storage.enabled) {
        const key = this.storage.objectKey(videoId);
        await this.db.query(
          "INSERT INTO property_video_objects(video_id,object_key,bucket,sha256,status) VALUES (?,?,?,?,'uploading')",
          [
            videoId,
            key,
            this.storage.config!.bucket,
            createHash('sha256').update(file.buffer).digest('hex'),
          ],
        );
        objectCreated = true;
        await this.storage.put(key, file.buffer);
      }
      await this.db.transaction(async (tx) => {
        const [p] = await tx.query(
          'SELECT p.advertiser_id,p.publication_status,a.status,u.isActive FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id WHERE p.id=? FOR UPDATE',
          [id],
        );
        if (!p) throw new NotFoundException('Propiedad no encontrada.');
        ownership(actor, p.advertiser_id);
        if (requestId) {
          const [receipt] = await tx.query(
            'SELECT v.id,v.property_id,v.title,v.status,v.created_by,r.content_digest,r.duration_ms FROM property_video_recordings r JOIN property_videos v ON v.id=r.video_id WHERE r.request_id=? FOR UPDATE',
            [requestId],
          );
          if (receipt) {
            if (
              receipt.created_by !== actor.id ||
              receipt.content_digest !== digest
            )
              throw new ConflictException(
                'Este identificador de subida ya se utilizó con otro video.',
              );
            result = {
              id: receipt.id,
              property_id: receipt.property_id,
              title: receipt.title,
              status: receipt.status,
              duration_ms: receipt.duration_ms,
              reused: true,
            };
            return;
          }
        }
        if (
          publish &&
          (p.publication_status !== 'published' ||
            p.status !== 'approved' ||
            !Number(p.isActive))
        )
          throw new BadRequestException(
            'Publica primero la propiedad con un anunciante aprobado y activo.',
          );
        const [count] = await tx.query(
          "SELECT COUNT(*) n FROM property_videos WHERE property_id=? AND status<>'archived'",
          [id],
        );
        if (Number(count.n) >= 4)
          throw new ConflictException(
            'Cada propiedad admite hasta cuatro videos activos.',
          );
        await tx.query(
          'INSERT INTO property_videos(id,property_id,created_by,title,size_bytes,status) VALUES (?,?,?,?,?,?)',
          [
            videoId,
            id,
            actor.id,
            title,
            file.buffer.length,
            publish ? 'published' : 'draft',
          ],
        );
        await tx.query(
          'INSERT INTO property_video_recordings(video_id,duration_ms,capture_seconds,request_id,content_digest) VALUES (?,?,?,?,?)',
          [videoId, duration, limit, requestId, digest],
        );
        if (this.storage.enabled)
          await tx.query(
            "UPDATE property_video_objects SET status='ready' WHERE video_id=? AND status='uploading'",
            [videoId],
          );
        result = {
          id: videoId,
          property_id: id,
          title,
          status: publish ? 'published' : 'draft',
          duration_ms: duration,
          reused: false,
        };
      });
    } catch (e) {
      // A failed commit acknowledgement does not imply rollback. Check before cleanup.
      const [saved] = await this.db
        .query(
          'SELECT v.id,v.property_id,v.title,v.status,r.duration_ms FROM property_videos v JOIN property_video_recordings r ON r.video_id=v.id WHERE v.id=?',
          [videoId],
        )
        .catch(() => []);
      if (saved) result = { ...saved, reused: false };
      else {
        if (objectCreated) await this.cleanupObject(videoId);
        await unlink(filename).catch(() => {});
        throw e;
      }
    }
    if (result.reused && objectCreated) await this.cleanupObject(videoId);
    if (result.reused || this.storage.enabled)
      await unlink(filename).catch(() => {});
    return result;
  }
  private async cleanupObject(id: string) {
    try {
      await this.db.query(
        "UPDATE property_video_objects SET status='pending_delete' WHERE video_id=? AND status='uploading'",
        [id],
      );
      const [o] = await this.db.query(
        "SELECT o.object_key,o.bucket FROM property_video_objects o LEFT JOIN property_videos v ON v.id=o.video_id WHERE o.video_id=? AND o.status='pending_delete' AND (v.id IS NULL OR v.status='archived')",
        [id],
      );
      if (!o || o.bucket !== this.storage.config?.bucket) return;
      await this.storage.remove(o.object_key);
      await this.db.query(
        "DELETE FROM property_video_objects WHERE video_id=? AND status='pending_delete'",
        [id],
      );
    } catch {
      /* Keep the private cleanup reference; no untracked or public object is introduced. */
    }
  }
  async update(actor: Actor, id: string, body: any) {
    this.guard();
    await this.db.transaction(async (tx) => {
      const [v] = await tx.query(
        `SELECT v.*,p.advertiser_id ${joined} WHERE v.id=? FOR UPDATE`,
        [uuid(id)],
      );
      if (!v || v.status === 'archived')
        throw new NotFoundException('Video no encontrado.');
      ownership(actor, v.advertiser_id);
      const title = body.title === undefined ? v.title : videoTitle(body.title);
      const status =
        body.status === undefined
          ? v.status
          : choice(body.status, ['draft', 'published', 'archived']);
      if (status === 'published') {
        const [p] = await tx.query(
          'SELECT p.publication_status,a.status,u.isActive FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id WHERE p.id=? FOR UPDATE',
          [v.property_id],
        );
        if (
          !p ||
          p.publication_status !== 'published' ||
          p.status !== 'approved' ||
          !Number(p.isActive)
        )
          throw new BadRequestException(
            'Publica primero la propiedad con un anunciante aprobado y activo.',
          );
      }
      await tx.query(
        'UPDATE property_videos SET title=?,status=?,updated_at=NOW() WHERE id=?',
        [title, status, id],
      );
      if (status === 'archived' && this.storage.enabled)
        await tx.query(
          "UPDATE property_video_objects SET status='pending_delete' WHERE video_id=? AND status='ready'",
          [id],
        );
    });
    if (body.status === 'archived') {
      if (this.storage.enabled) await this.cleanupObject(id);
      if (this.config.get('NODE_ENV') !== 'production')
        await unlink(resolve(this.folder, id + '.mp4')).catch(() => {});
    }
    return { ok: true };
  }
  async content(id: string, rangeHeader: string | undefined, res: any) {
    this.guard();
    const [v] = await this.db.query(
      `SELECT v.size_bytes ${joined} WHERE v.id=? AND ${visible}`,
      [uuid(id)],
    );
    if (!v) throw new NotFoundException('Video no disponible.');
    if (this.storage.enabled) {
      const [o] = await this.db.query(
        "SELECT object_key,bucket FROM property_video_objects WHERE video_id=? AND status='ready'",
        [id],
      );
      if (o) {
        if (o.bucket !== this.storage.config?.bucket)
          throw new ServiceUnavailableException(
            'Configuración de videos no disponible.',
          );
        if (videoRange(rangeHeader, Number(v.size_bytes)) === false)
          return res
            .status(416)
            .set('Content-Range', `bytes */${v.size_bytes}`)
            .end();
        res.set({
          'Cache-Control': 'private,no-store',
          'Referrer-Policy': 'no-referrer',
          'Accept-Ranges': 'bytes',
        });
        return res.redirect(
          307,
          await this.storage.signedRead(
            o.object_key,
            res.req.method === 'HEAD',
          ),
        );
      }
    }
    // Files from the old local demo remain playable only in that local environment.
    if (this.config.get('NODE_ENV') === 'production')
      throw new NotFoundException('Archivo de video no disponible.');
    const file = resolve(this.folder, id + '.mp4');
    const info = await stat(file).catch(() => null);
    if (!info || info.size !== Number(v.size_bytes))
      throw new NotFoundException('Archivo de video no disponible.');
    const range = videoRange(rangeHeader, info.size);
    res.set({
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private,no-store',
    });
    if (range === false)
      return res.status(416).set('Content-Range', `bytes */${info.size}`).end();
    const start = range ? range.start : 0,
      end = range ? range.end : info.size - 1;
    if (range)
      res
        .status(206)
        .set('Content-Range', `bytes ${start}-${end}/${info.size}`);
    res.set('Content-Length', end - start + 1);
    if (res.req.method === 'HEAD') return res.end();
    const stream = createReadStream(file, { start, end });
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
