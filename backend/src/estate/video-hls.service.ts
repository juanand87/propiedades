import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import type { Response } from 'express';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ownership, uuid } from './rules';
import { EstateService } from './estate.service';
import { VideoStorageService } from './video-storage.service';
import { assertPropertyVideos } from './property-videos';
import { videoJoined, videoVisible } from './video-visibility';
import {
  encodeHls,
  hlsMaster,
  hlsVariant,
  validateHlsMetadata,
  validHlsSegment,
} from './video-hls';

type HlsRow = {
  video_id: string;
  status: string;
  generation_id: string | null;
  metadata_json: string | null;
  attempts: number;
};
@Injectable()
export class VideoHlsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private workRoot = resolve(__dirname, '../../..', 'tmp/hls-work');
  private localRoot = resolve(__dirname, '../../..', 'tmp/mobile-hls');
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private storage: VideoStorageService,
    private estate: EstateService,
    private jwt: JwtService,
  ) {}
  get enabled() {
    return this.config.get('VIDEOS_HLS_ENABLED') !== 'false';
  }
  async available(db: Pick<DataSource, 'query'> | EntityManager = this.db) {
    if (!this.enabled) return false;
    const [r] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='property_video_hls'",
    );
    return Number(r.n) === 1;
  }
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
    if (!this.enabled) throw new NotFoundException('HLS no disponible.');
  }
  async enqueue(tx: EntityManager, id: string) {
    if (await this.available(tx))
      await tx.query(
        'INSERT IGNORE INTO property_video_hls(video_id) VALUES (?)',
        [uuid(id)],
      );
  }
  async urls(ids: string[], signature?: string) {
    const result = new Map<string, string>();
    if (!ids.length || !(await this.available())) return result;
    const rows = await this.db.query<
      { video_id: string; generation_id: string }[]
    >(
      `SELECT video_id,generation_id FROM property_video_hls WHERE status='ready' AND video_id IN (${ids.map(() => '?').join(',')})`,
      ids.map(uuid),
    );
    for (const row of rows) {
      const query = new URLSearchParams({ v: row.generation_id });
      if (signature) query.set('signature', signature);
      result.set(
        row.video_id,
        `/api/videos/${row.video_id}/hls/master.m3u8?${query}`,
      );
    }
    return result;
  }
  private async authorize(id: string, signature?: string) {
    this.guard();
    uuid(id);
    if (signature) {
      let claims: { sub: string; videoId: string };
      try {
        claims = this.jwt.verify(signature, {
          audience: 'estate-video-preview',
        });
        if (claims.videoId !== id) throw Error();
      } catch {
        throw new UnauthorizedException(
          'La vista previa venció. Vuelve a abrir el video.',
        );
      }
      const actor = await this.estate.actor(claims.sub);
      const [video] = await this.db.query<
        { created_by: string; advertiser_id: string | null }[]
      >(
        `SELECT v.created_by,p.advertiser_id ${videoJoined} WHERE v.id=? AND v.status<>'archived'`,
        [id],
      );
      if (!video) throw new NotFoundException('Video no disponible.');
      if (video.created_by !== actor.id && actor.role !== 'admin') {
        if (!video.advertiser_id) throw new UnauthorizedException();
        ownership(actor, video.advertiser_id);
      }
    } else {
      const [video] = await this.db.query<{ id: string }[]>(
        `SELECT v.id ${videoJoined} WHERE v.id=? AND ${videoVisible}`,
        [id],
      );
      if (!video) throw new NotFoundException('Video no disponible.');
    }
  }
  async serve(
    id: string,
    quality: string | undefined,
    file: string,
    version: string | undefined,
    signature: string | undefined,
    res: Response,
  ) {
    await this.authorize(id, signature);
    if (!(await this.available()))
      throw new NotFoundException('HLS en preparación.');
    const [row] = await this.db.query<HlsRow[]>(
      "SELECT * FROM property_video_hls WHERE video_id=? AND status='ready'",
      [id],
    );
    if (
      !row?.generation_id ||
      !row.metadata_json ||
      (version && version !== row.generation_id)
    )
      throw new NotFoundException('HLS en preparación.');
    const metadata = validateHlsMetadata(JSON.parse(row.metadata_json));
    const query = new URLSearchParams({ v: row.generation_id });
    if (signature) query.set('signature', signature);
    res.set({
      'Cache-Control': 'private,no-store',
      'Referrer-Policy': 'no-referrer',
    });
    if (!quality && file === 'master.m3u8')
      return res
        .type('application/vnd.apple.mpegurl')
        .send(hlsMaster(metadata, '?' + query.toString()));
    const rendition = metadata.renditions.find((r) => r.quality === quality);
    if (!rendition) throw new NotFoundException();
    if (file === 'index.m3u8')
      return res
        .type('application/vnd.apple.mpegurl')
        .send(hlsVariant(rendition, '?' + query.toString()));
    if (
      !validHlsSegment(file) ||
      !rendition.segments.some((s) => s.name === file)
    )
      throw new NotFoundException();
    res.set('Cache-Control', 'private,max-age=120');
    if (this.storage.enabled)
      return res.redirect(
        307,
        await this.storage.signedRead(
          this.key(id, row.generation_id, rendition.quality, file),
          res.req.method === 'HEAD',
        ),
      );
    if (this.config.get('NODE_ENV') === 'production')
      throw new NotFoundException();
    return res
      .type('video/mp2t')
      .sendFile(
        join(this.localRoot, id, row.generation_id, rendition.quality, file),
      );
  }
  private key(id: string, generation: string, quality: string, file: string) {
    return `${this.storage.config!.prefix}/hls/${uuid(id)}/${uuid(generation)}/${quality}/${file}`;
  }
  onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'production' || !this.enabled) return;
    this.timer = setInterval(
      () => void this.processNext().catch(() => {}),
      10000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async cleanup(row: HlsRow) {
    if (!row.generation_id || !row.metadata_json) return;
    const metadata = validateHlsMetadata(JSON.parse(row.metadata_json));
    for (const rendition of metadata.renditions) {
      for (const segment of rendition.segments) {
        if (this.storage.enabled)
          await this.storage.remove(
            this.key(
              row.video_id,
              row.generation_id,
              rendition.quality,
              segment.name,
            ),
          );
        else
          await unlink(
            join(
              this.localRoot,
              row.video_id,
              row.generation_id,
              rendition.quality,
              segment.name,
            ),
          ).catch(() => {});
      }
      if (!this.storage.enabled) {
        const folder = join(
          this.localRoot,
          row.video_id,
          row.generation_id,
          rendition.quality,
        );
        await unlink(join(folder, 'index.m3u8')).catch(() => {});
        await rmdir(folder).catch(() => {});
      }
    }
    if (!this.storage.enabled) {
      await rmdir(join(this.localRoot, row.video_id, row.generation_id)).catch(
        () => {},
      );
      await rmdir(join(this.localRoot, row.video_id)).catch(() => {});
    }
  }
  async processNext(onlyId?: string) {
    if (this.busy || !(await this.available()) || this.busy) return;
    this.guard();
    this.busy = true;
    const runner = this.db.createQueryRunner();
    let locked = false;
    let folder: string | undefined;
    try {
      await runner.connect();
      const [lock] = (await runner.query(
        "SELECT GET_LOCK('proppix-hls-worker',0) locked",
      )) as { locked: number }[];
      if (!lock.locked) return;
      locked = true;
      const [retired] = await this.db.query<HlsRow[]>(
        "SELECT h.* FROM property_video_hls h JOIN property_videos v ON v.id=h.video_id WHERE v.status='archived' LIMIT 1",
      );
      if (retired) {
        await this.cleanup(retired);
        await this.db.query('DELETE FROM property_video_hls WHERE video_id=?', [
          retired.video_id,
        ]);
      }
      await this.db.query(
        "UPDATE property_video_hls SET status='pending' WHERE status='processing' AND updated_at<UTC_TIMESTAMP()-INTERVAL 10 MINUTE",
      );
      const [row] = await this.db.query<HlsRow[]>(
        `SELECT h.* FROM property_video_hls h JOIN property_videos v ON v.id=h.video_id WHERE h.status='pending' AND h.attempts<4 AND h.due_at<=UTC_TIMESTAMP(3) AND v.status<>'archived' ${onlyId ? 'AND h.video_id=?' : ''} ORDER BY (v.status='published') DESC,h.due_at,h.video_id LIMIT 1`,
        onlyId ? [uuid(onlyId)] : [],
      );
      if (!row) return;
      await this.db.query(
        "UPDATE property_video_hls SET status='processing',attempts=attempts+1,updated_at=UTC_TIMESTAMP(3) WHERE video_id=?",
        [row.video_id],
      );
      try {
        await this.cleanup(row);
        await mkdir(this.workRoot, { recursive: true });
        folder = await mkdtemp(join(this.workRoot, 'job-'));
        const input = join(folder, 'input.mp4'),
          output = join(folder, 'output');
        if (this.storage.enabled) {
          const [object] = await this.db.query<
            { object_key: string; bucket: string }[]
          >(
            "SELECT object_key,bucket FROM property_video_objects WHERE video_id=? AND status='ready'",
            [row.video_id],
          );
          if (!object || object.bucket !== this.storage.config?.bucket)
            throw Error('Source unavailable');
          await writeFile(
            input,
            await this.storage.readOriginal(object.object_key),
            { flag: 'wx' },
          );
        } else {
          if (this.config.get('NODE_ENV') === 'production')
            throw Error('Private storage required');
          const bytes = await readFile(
            resolve(
              __dirname,
              '../../..',
              'tmp/mobile-videos',
              uuid(row.video_id) + '.mp4',
            ),
          );
          if (bytes.length > 50 * 1024 * 1024) throw Error('Source too large');
          await writeFile(input, bytes, { flag: 'wx' });
        }
        const metadata = await encodeHls(input, output),
          generation = randomUUID();
        // Persist every intended key before uploading, so retries can remove partial uploads.
        await this.db.query(
          'UPDATE property_video_hls SET generation_id=?,metadata_json=?,updated_at=UTC_TIMESTAMP(3) WHERE video_id=?',
          [generation, JSON.stringify(metadata), row.video_id],
        );
        if (this.storage.enabled) {
          for (const rendition of metadata.renditions)
            for (const segment of rendition.segments)
              await this.storage.put(
                this.key(
                  row.video_id,
                  generation,
                  rendition.quality,
                  segment.name,
                ),
                await readFile(join(output, rendition.quality, segment.name)),
              );
        } else {
          const destination = join(this.localRoot, row.video_id);
          await mkdir(destination, { recursive: true });
          await rename(output, join(destination, generation));
        }
        const result = await this.db.query<{ affectedRows: number }>(
          "UPDATE property_video_hls SET status='ready',updated_at=UTC_TIMESTAMP(3) WHERE video_id=? AND generation_id=? AND EXISTS(SELECT 1 FROM property_videos v WHERE v.id=? AND v.status<>'archived')",
          [row.video_id, generation, row.video_id],
        );
        if (!result.affectedRows)
          throw Error('Video withdrawn during encoding');
      } catch {
        await this.db.query(
          'UPDATE property_video_hls SET status=?,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE video_id=?',
          [
            row.attempts + 1 >= 4 ? 'failed' : 'pending',
            Math.min(1800, 60 * 2 ** row.attempts),
            row.video_id,
          ],
        );
      }
    } finally {
      // Delete only the unique work directory created directly inside our work root.
      if (folder && dirname(resolve(folder)) === this.workRoot)
        await rm(folder, { recursive: true, force: true }).catch(() => {});
      if (locked)
        await runner
          .query("SELECT RELEASE_LOCK('proppix-hls-worker')")
          .catch(() => {});
      await runner.release();
      this.busy = false;
    }
  }
}
