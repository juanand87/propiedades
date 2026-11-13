import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { Actor } from './rules';
import { EstateService } from './estate.service';
import { videoJoined, videoVisible } from './property-videos.service';

const cursor = (value: unknown) => {
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,19}$/.test(value) ||
    BigInt(value) > 18446744073709551615n
  )
    throw new BadRequestException('Identificador de actividad inválido.');
  return value;
};

@Injectable()
export class ActivityService {
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private estate: EstateService,
  ) {}
  async available(db: Pick<DataSource, 'query'> | EntityManager = this.db) {
    const [row] = await db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_activity'",
    );
    return Number(row.n) === 1;
  }
  private async guard() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'Actividad está pendiente de configurar.',
      );
  }
  async recordComment(
    tx: EntityManager,
    input: {
      commentId: string;
      ownerId: string;
      parentUserId?: string;
      actorId: string;
    },
  ) {
    if (!(await this.available(tx))) return;
    const recipients = new Map<string, string>([
      [input.ownerId.toLowerCase(), 'comment'],
    ]);
    if (input.parentUserId)
      recipients.set(input.parentUserId.toLowerCase(), 'reply');
    for (const [recipient, kind] of recipients) {
      if (
        recipient === input.actorId.toLowerCase() &&
        this.config.get('PUSH_SELF_ACTIVITY_ENABLED') === 'false'
      )
        continue;
      await tx.query(
        'INSERT IGNORE INTO estate_activity(user_id,comment_id,kind) VALUES (?,?,?)',
        [recipient, input.commentId, kind],
      );
    }
  }
  private visible = `FROM estate_activity a
    JOIN estate_video_comments c ON c.id=a.comment_id
    JOIN users author ON CONVERT(author.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=c.user_id AND author.isActive=1
    JOIN property_videos ownvideo ON ownvideo.id=c.video_id AND ownvideo.status<>'archived'
    LEFT JOIN estate_video_profiles profile ON profile.user_id=c.user_id
    WHERE a.user_id=? AND (ownvideo.created_by=? OR EXISTS(SELECT 1 ${videoJoined} WHERE v.id=c.video_id AND ${videoVisible}))`;
  async list(
    actor: Actor,
    query: { before?: string; unread?: string; limit?: string },
  ) {
    await this.guard();
    const before = query.before ? cursor(query.before) : null;
    const limit = Math.max(
      1,
      Math.min(30, parseInt(query.limit || '', 10) || 20),
    );
    const params = [actor.id, actor.id];
    const rows = await this.db.query<
      {
        id: string;
        kind: string;
        comment_id: string;
        video_id: string;
        body: string;
        title: string;
        actor_id: string;
        display_name: string;
        avatar_media_id: string | null;
        created_at: string;
        read_at: string | null;
      }[]
    >(
      `SELECT CAST(a.id AS CHAR) id,a.kind,a.comment_id,c.video_id,c.body,ownvideo.title,c.user_id actor_id,COALESCE(profile.display_name,author.firstName) display_name,profile.avatar_media_id,a.created_at,a.read_at ${this.visible} ${query.unread === 'true' ? 'AND a.read_at IS NULL' : ''} ${before ? 'AND a.id<?' : ''} ORDER BY a.id DESC LIMIT ?`,
      [...params, ...(before ? [before] : []), limit + 1],
    );
    const [count] = await this.db.query<{ n: number }[]>(
      `SELECT COUNT(*) n ${this.visible} AND a.read_at IS NULL`,
      params,
    );
    const items = rows.slice(0, limit).map(({ avatar_media_id, ...row }) => ({
      ...row,
      avatar_url: avatar_media_id
        ? this.estate.mediaUrl(avatar_media_id, { id: row.actor_id } as Actor)
        : null,
    }));
    return {
      items,
      unread_count: Number(count.n),
      next_cursor: rows.length > limit ? items.at(-1)!.id : null,
    };
  }
  async markRead(actor: Actor, id: string) {
    await this.guard();
    const [row] = await this.db.query<{ id: string }[]>(
      'SELECT id FROM estate_activity WHERE id=? AND user_id=?',
      [cursor(id), actor.id],
    );
    if (!row) throw new NotFoundException('Actividad no disponible.');
    await this.db.query(
      'UPDATE estate_activity SET read_at=COALESCE(read_at,UTC_TIMESTAMP(3)) WHERE id=? AND user_id=?',
      [id, actor.id],
    );
    return { success: true };
  }
  async markAllRead(actor: Actor, through: unknown) {
    await this.guard();
    await this.db.query(
      'UPDATE estate_activity SET read_at=UTC_TIMESTAMP(3) WHERE user_id=? AND id<=? AND read_at IS NULL',
      [actor.id, cursor(through)],
    );
    return { success: true };
  }
  async markCommentRead(actor: Actor, commentId: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        commentId,
      )
    )
      throw new BadRequestException('Comentario inválido.');
    await this.guard();
    await this.db.query(
      'UPDATE estate_activity SET read_at=COALESCE(read_at,UTC_TIMESTAMP(3)) WHERE user_id=? AND comment_id=?',
      [actor.id, commentId],
    );
    return { success: true };
  }
}
