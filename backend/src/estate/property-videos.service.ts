import { compressVideo } from './video-compression';
import { videoPoster } from './video-poster';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

import { videoVisible, videoJoined } from './video-visibility';
export { videoVisible, videoJoined } from './video-visibility';
import { VideoHlsService } from './video-hls.service';
const visible = videoVisible,
  joined = videoJoined;
@Injectable()
export class PropertyVideosService {
  private posterJobs = new Map<string, Promise<Buffer>>();
  private folder = resolve(__dirname, '../../..', 'tmp/mobile-videos');
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private estate: EstateService,
    private storage: VideoStorageService,
    private jwt: JwtService,
    private hls: VideoHlsService,
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
  async capabilities() {
    try {
      this.guard();
      return {
        enabled: true,
        hls: await this.hls.available(),
        storage: this.storage.enabled ? 'spaces' : 'local',
        version: 1,
        social: this.config.get('SOCIAL_VIDEOS_ENABLED') === 'true',
      };
    } catch {
      return { enabled: false, storage: 'disabled', version: 1 };
    }
  }
  async feed(q: any) {
    this.guard();
    const page = Math.max(1, Math.min(10000, Number.parseInt(q.page, 10) || 1));
    const limit = Math.max(1, Math.min(20, Number.parseInt(q.limit, 10) || 5));
    const type =
      typeof q.type_id === 'string' && q.type_id.length <= 30 ? q.type_id : '';
    const videoId = q.video_id ? uuid(q.video_id) : null;
    const seed = q.seed ? uuid(q.seed) : null;
    const filter =
        (type ? ' AND p.type_id=?' : '') +
        (q.linked_only === 'true' ? ' AND v.property_id IS NOT NULL' : '') +
        (videoId ? ' AND v.id=?' : ''),
      params = [...(type ? [type] : []), ...(videoId ? [videoId] : [])];
    const [count] = await this.db.query(
      `SELECT COUNT(*) total ${joined} WHERE ${visible}${filter}`,
      params,
    );
    const rows = await this.db.query(
      `SELECT v.id,v.property_id,v.title,v.size_bytes,creator.id creator_id,creator.firstName creator_name,r.duration_ms,r.capture_seconds ${joined} LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE ${visible}${filter} ORDER BY ${seed ? 'MD5(CONCAT(?,v.id)),v.id' : 'v.created_at DESC,v.id'} LIMIT ? OFFSET ?`,
      [...params, ...(seed ? [seed] : []), limit, (page - 1) * limit],
    );
    const hlsUrls = await this.hls.urls(rows.map((v: { id: string }) => v.id));
    return {
      items: await Promise.all(
        rows.map(async (v: any) => ({
          ...v,
          url: `/api/videos/${v.id}/content`,
          hls_url: hlsUrls.get(v.id) || null,
          thumbnail_url: `/api/videos/${v.id}/thumbnail`,
          creator: { id: v.creator_id, display_name: v.creator_name },
          property: v.property_id ? await this.estate.get(v.property_id) : null,
        })),
      ),
      total: Number(count.total),
      page,
      pages: Math.ceil(Number(count.total) / limit),
    };
  }
  async hlsUrls(ids: string[]) {
    return this.hls.urls(ids);
  }
  async list(actor: Actor, id: string) {
    this.guard();
    await this.estate.get(uuid(id), actor);
    return this.db.query(
      "SELECT v.id,v.property_id,v.title,v.status,v.size_bytes,v.created_at,r.duration_ms,r.capture_seconds FROM property_videos v LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE v.property_id=? AND v.status<>'archived' ORDER BY v.created_at DESC,v.id",
      [id],
    );
  }
  private async managedVideo(actor: Actor, id: string) {
    const [v] = await this.db.query(
      `SELECT v.id,v.size_bytes,v.created_by,p.advertiser_id ${joined} WHERE v.id=? AND v.status<>'archived'`,
      [uuid(id)],
    );
    if (!v) throw new NotFoundException('Video no encontrado.');
    this.videoOwnership(actor, v);
    return v;
  }
  private videoOwnership(actor: Actor, video: any) {
    if (video.created_by === actor.id || actor.role === 'admin') return;
    if (!video.advertiser_id)
      throw new ForbiddenException('Este video no te pertenece.');
    ownership(actor, video.advertiser_id);
  }
  async preview(actor: Actor, id: string) {
    this.guard();
    await this.managedVideo(actor, id);
    const signature = this.jwt.sign(
      { sub: actor.id, videoId: id, aud: 'estate-video-preview' },
      { expiresIn: '2m' },
    );
    const hlsUrls = await this.hls.urls([id], signature);
    return {
      hls_url: hlsUrls.get(id) || null,
      url: `/api/videos/${id}/preview?signature=${encodeURIComponent(signature)}`,
      thumbnail_url: `/api/videos/${id}/thumbnail?signature=${encodeURIComponent(signature)}`,
    };
  }
  async previewContent(
    id: string,
    signature: string,
    range: string | undefined,
    res: any,
  ) {
    this.guard();
    let payload: any;
    try {
      payload = this.jwt.verify(signature, {
        audience: 'estate-video-preview',
      });
      if (payload.videoId !== id) throw new Error('Video distinto');
    } catch {
      throw new UnauthorizedException(
        'La vista previa venció. Vuelve a abrir el video.',
      );
    }
    const actor = await this.estate.actor(payload.sub);
    const v = await this.managedVideo(actor, id);
    return this.serveContent(id, v.size_bytes, range, res);
  }
  async upload(actor: Actor, id: string | null, body: any, file: any) {
    this.guard();
    if (id) await this.estate.get(uuid(id), actor);
    else if (this.config.get('SOCIAL_VIDEOS_ENABLED') !== 'true')
      throw new ServiceUnavailableException(
        'Los videos independientes todavía no están habilitados.',
      );
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
      const stored = await compressVideo(filename, file.buffer, duration);
      const poster = await videoPoster(filename);
      if (this.storage.enabled) {
        const key = this.storage.objectKey(videoId);
        await this.db.query(
          "INSERT INTO property_video_objects(video_id,object_key,bucket,sha256,status) VALUES (?,?,?,?,'uploading')",
          [
            videoId,
            key,
            this.storage.config!.bucket,
            createHash('sha256').update(stored).digest('hex'),
          ],
        );
        objectCreated = true;
        await this.storage.put(key, stored);
      }
      await this.db.transaction(async (tx) => {
        const [p] = id
          ? await tx.query(
              'SELECT p.advertiser_id,p.publication_status,a.status,u.isActive FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id WHERE p.id=? FOR UPDATE',
              [id],
            )
          : [null];
        if (id && !p) throw new NotFoundException('Propiedad no encontrada.');
        if (p) ownership(actor, p.advertiser_id);
        await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [
          actor.id,
        ]);
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
          p &&
          (p.publication_status !== 'published' ||
            p.status !== 'approved' ||
            !Number(p.isActive))
        )
          throw new BadRequestException(
            'Publica primero la propiedad con un anunciante aprobado y activo.',
          );
        if (actor.role !== 'admin') {
          const plan = await this.estate.membership(actor.id, tx);
          if (plan.videos !== null) {
            const [used] = await tx.query(
              "SELECT COUNT(*) n FROM property_videos WHERE created_by=? AND status<>'archived'",
              [actor.id],
            );
            if (Number(used.n) >= plan.videos)
              throw new ConflictException(
                `Alcanzaste el límite de ${plan.videos} videos del plan ${plan.name}. Elimina uno para subir otro.`,
              );
          }
        }
        await tx.query(
          'INSERT INTO property_videos(id,property_id,created_by,title,size_bytes,status) VALUES (?,?,?,?,?,?)',
          [
            videoId,
            id,
            actor.id,
            title,
            stored.length,
            publish ? 'published' : 'draft',
          ],
        );
        await tx.query(
          'INSERT INTO property_video_recordings(video_id,duration_ms,capture_seconds,request_id,content_digest) VALUES (?,?,?,?,?)',
          [videoId, duration, limit, requestId, digest],
        );
        await this.hls.enqueue(tx, videoId);
        // A missing optional migration must not prevent saving the video.
        const [posterTable] = await tx.query(
          "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='property_video_posters'",
        );
        if (Number(posterTable.n))
          await tx.query(
            'INSERT INTO property_video_posters(video_id,jpeg) VALUES (?,?)',
            [videoId, poster],
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
          size_bytes: stored.length,
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
      this.videoOwnership(actor, v);
      const title = body.title === undefined ? v.title : videoTitle(body.title);
      const status =
        body.status === undefined
          ? v.status
          : choice(body.status, ['draft', 'published', 'archived']);
      if (status === 'published' && v.property_id) {
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
    return this.serveContent(id, v.size_bytes, rangeHeader, res);
  }
  async thumbnail(id: string, signature: string | undefined, res: any) {
    this.guard();
    uuid(id);
    if (signature) {
      let payload: { sub: string; videoId: string };
      try {
        payload = this.jwt.verify(signature, {
          audience: 'estate-video-preview',
        });
      } catch {
        throw new UnauthorizedException('Vuelve a abrir el perfil.');
      }
      if (payload.videoId !== id) throw new UnauthorizedException();
      await this.managedVideo(await this.estate.actor(payload.sub), id);
    } else {
      const [visibleRow] = await this.db.query(
        `SELECT v.id ${joined} WHERE v.id=? AND ${visible}`,
        [id],
      );
      if (!visibleRow) throw new NotFoundException('Video no disponible.');
    }
    const [saved] = await this.db.query<{ jpeg: Buffer }[]>(
      'SELECT jpeg FROM property_video_posters WHERE video_id=?',
      [id],
    );
    let jpeg = saved?.jpeg;
    if (!jpeg) {
      let job = this.posterJobs.get(id);
      if (!job) {
        if (this.posterJobs.size >= 2)
          throw new ServiceUnavailableException('Portada en preparación.');
        job = this.createLegacyPoster(id);
        this.posterJobs.set(id, job);
        void job.finally(() => this.posterJobs.delete(id)).catch(() => {});
      }
      jpeg = await job;
    }
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private,max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(jpeg);
  }
  private async createLegacyPoster(id: string) {
    await mkdir(this.folder, { recursive: true });
    let filename = resolve(this.folder, id + '.mp4');
    let temporary = false;
    try {
      if (this.storage.enabled) {
        const [object] = await this.db.query<
          { object_key: string; bucket: string }[]
        >(
          "SELECT object_key,bucket FROM property_video_objects WHERE video_id=? AND status='ready'",
          [id],
        );
        if (!object || object.bucket !== this.storage.config?.bucket)
          throw new NotFoundException();
        const response = await fetch(
          await this.storage.signedRead(object.object_key),
          { signal: AbortSignal.timeout(30000), redirect: 'error' },
        );
        if (!response.ok || !response.body)
          throw new ServiceUnavailableException();
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of response.body as any) {
          size += chunk.length;
          if (size > 50 * 1024 * 1024)
            throw new BadRequestException('Video demasiado grande.');
          chunks.push(Buffer.from(chunk));
        }
        filename = resolve(this.folder, randomUUID() + '.poster.mp4');
        await writeFile(filename, Buffer.concat(chunks), { flag: 'wx' });
        temporary = true;
      } else if (this.config.get('NODE_ENV') === 'production')
        throw new NotFoundException();
      const jpeg = await videoPoster(filename);
      await this.db.query(
        'INSERT IGNORE INTO property_video_posters(video_id,jpeg) VALUES (?,?)',
        [id, jpeg],
      );
      return jpeg;
    } finally {
      if (temporary) await unlink(filename).catch(() => {});
    }
  }
  private async serveContent(
    id: string,
    size: number,
    rangeHeader: string | undefined,
    res: any,
  ) {
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
        if (videoRange(rangeHeader, Number(size)) === false)
          return res.status(416).set('Content-Range', `bytes */${size}`).end();
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
    if (!info || info.size !== Number(size))
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
