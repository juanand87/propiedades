import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Actor, uuid } from './rules';
import { VideoSocialService } from './video-social.service';
import { EstateService } from './estate.service';
import {
  PropertyVideosService,
  videoJoined,
  videoVisible,
} from './property-videos.service';
type StoryRow = {
  id: string;
  media_id: string | null;
  video_id: string | null;
  expires_at: Date;
};
type StoryItem = {
  id: string;
  expires_at: Date;
  kind: 'image' | 'video';
  url?: string;
  video?: { id: string; url: string; hls_url: string | null };
};
@Injectable()
export class ProfileStoriesService {
  constructor(
    private db: DataSource,
    private social: VideoSocialService,
    private estate: EstateService,
    private videos: PropertyVideosService,
  ) {}
  async list(id: string, actor: Actor) {
    id = uuid(id);
    await this.social.profile(id, actor);
    const rows = await this.db.query<StoryRow[]>(
      'SELECT id,media_id,video_id,expires_at FROM estate_profile_stories WHERE user_id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP() ORDER BY created_at,id LIMIT 20',
      [id],
    );
    const items: StoryItem[] = [];
    for (const row of rows) {
      if (row.video_id) {
        try {
          const [visible] = await this.db.query<{ id: string }[]>(
            `SELECT v.id ${videoJoined} WHERE v.id=? AND ${videoVisible}`,
            [row.video_id],
          );
          if (!visible) continue;
          const info: { status: unknown; moderation_hidden: boolean } =
            await this.social.details(row.video_id, actor);
          if (info.status !== 'published' || info.moderation_hidden) continue;
          const hls = await this.videos.hlsUrls([row.video_id]);
          items.push({
            id: row.id,
            expires_at: row.expires_at,
            kind: 'video',
            video: {
              id: row.video_id,
              url: `/api/videos/${row.video_id}/content`,
              hls_url: hls.get(row.video_id) || null,
            },
          });
        } catch {
          continue;
        }
      } else if (row.media_id)
        items.push({
          id: row.id,
          expires_at: row.expires_at,
          kind: 'image',
          url: this.estate.mediaUrl(row.media_id, { id } as Actor),
        });
    }
    return { items };
  }
  async create(actor: Actor, body: { media_id?: unknown; video_id?: unknown }) {
    await this.social.profile(actor.id, actor);
    if (!!body.media_id === !!body.video_id)
      throw new BadRequestException('Selecciona una foto o un video.');
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      const [count] = await tx.query<{ n: number }[]>(
        'SELECT COUNT(*) n FROM estate_profile_stories WHERE user_id=? AND deleted_at IS NULL AND expires_at>UTC_TIMESTAMP()',
        [actor.id],
      );
      if (Number(count.n) >= 20)
        throw new BadRequestException(
          'Puedes tener hasta 20 historias activas.',
        );
      const media = body.media_id ? uuid(body.media_id) : null,
        video = body.video_id ? uuid(body.video_id) : null;
      const [owned] = await tx.query<{ id: string }[]>(
        media
          ? 'SELECT id FROM estate_media WHERE id=? AND owner_id=?'
          : "SELECT id FROM property_videos WHERE id=? AND created_by=? AND status='published'",
        [media || video, actor.id],
      );
      if (!owned)
        throw new BadRequestException(
          'El contenido debe pertenecer a tu cuenta y el video debe estar publicado.',
        );
      const id = randomUUID();
      await tx.query(
        'INSERT INTO estate_profile_stories(id,user_id,media_id,video_id,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))',
        [id, actor.id, media, video],
      );
      return { id };
    });
  }
  async remove(actor: Actor, id: string) {
    const result = await this.db.query<{ affectedRows: number }>(
      'UPDATE estate_profile_stories SET deleted_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND deleted_at IS NULL',
      [uuid(id), actor.id],
    );
    if (!result.affectedRows) throw new NotFoundException();
    return { deleted: true };
  }
}
