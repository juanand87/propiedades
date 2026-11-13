import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Actor, text, uuid } from './rules';
import { EstateService } from './estate.service';
import { PushService } from './push.service';
import { ActivityService } from './activity.service';
import {
  PropertyVideosService,
  videoJoined,
  videoVisible,
} from './property-videos.service';

@Injectable()
export class VideoSocialService {
  constructor(
    private db: DataSource,
    private config: ConfigService,
    private videos: PropertyVideosService,
    private estate: EstateService,
    private push: PushService,
    private activity: ActivityService,
  ) {}
  guard() {
    if (this.config.get('SOCIAL_VIDEOS_ENABLED') !== 'true')
      throw new ServiceUnavailableException(
        'El perfil de videos todavía no está habilitado.',
      );
  }
  private async access(id: string, actor?: Actor) {
    this.guard();
    const [v] = await this.db.query(
      `SELECT v.*,(${videoVisible}) can_view,p.title property_title ${videoJoined} WHERE v.id=? AND v.status<>'archived'`,
      [uuid(id)],
    );
    if (
      !v ||
      (!Number(v.can_view) &&
        actor?.id !== v.created_by &&
        actor?.role !== 'admin')
    )
      throw new NotFoundException('Video no disponible.');
    return v;
  }
  async profile(userId: string, actor?: Actor) {
    this.guard();
    const [u] = await this.db.query(
      'SELECT u.id,u.firstName,p.display_name,p.avatar_media_id FROM users u LEFT JOIN estate_video_profiles p ON p.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE u.id=? AND u.isActive=1',
      [uuid(userId)],
    );
    if (!u) throw new NotFoundException('Perfil no disponible.');
    const [[following], [followers], [likes], [relation]] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_follows WHERE follower_id=?',
        [userId],
      ),
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_follows WHERE followed_id=?',
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) n FROM estate_video_likes l JOIN property_videos v ON v.id=l.video_id WHERE v.created_by=? AND v.status<>'archived'`,
        [userId],
      ),
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_follows WHERE follower_id=? AND followed_id=?',
        [actor?.id || '', userId],
      ),
    ]);
    return {
      id: u.id,
      display_name: u.display_name || u.firstName,
      avatar_url: u.avatar_media_id
        ? this.estate.mediaUrl(u.avatar_media_id, { id: u.id } as Actor)
        : null,
      following: Number(following.n),
      followers: Number(followers.n),
      likes: Number(likes.n),
      followed: Number(relation.n) > 0,
    };
  }
  async saveProfile(actor: Actor, body: any) {
    this.guard();
    const name = text(body.display_name, 100) || actor.firstName;
    let avatar: string | null = null;
    if (body.avatar_media_id) {
      const [m] = await this.db.query(
        'SELECT id FROM estate_media WHERE id=? AND owner_id=?',
        [uuid(body.avatar_media_id), actor.id],
      );
      if (!m)
        throw new ForbiddenException('La foto debe pertenecer a tu cuenta.');
      avatar = m.id;
    } else {
      const [old] = await this.db.query(
        'SELECT avatar_media_id FROM estate_video_profiles WHERE user_id=?',
        [actor.id],
      );
      avatar = old?.avatar_media_id || null;
    }
    await this.db.query(
      'INSERT INTO estate_video_profiles(user_id,display_name,avatar_media_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),avatar_media_id=VALUES(avatar_media_id)',
      [actor.id, name, avatar],
    );
    return this.profile(actor.id, actor);
  }
  async gallery(userId: string, q: any, actor?: Actor) {
    this.guard();
    await this.profile(userId, actor);
    const own = actor?.id === userId;
    const saved = own && q.saved === 'true';
    const page = Math.max(1, Math.min(10000, parseInt(q.page, 10) || 1));
    const where = saved
      ? 'v.id IN (SELECT video_id FROM estate_video_saves WHERE user_id=?)'
      : 'v.created_by=?';
    const visibility = own && !saved ? "v.status<>'archived'" : videoVisible;
    const [count] = await this.db.query(
      `SELECT COUNT(*) n ${videoJoined} WHERE ${where} AND ${visibility}`,
      [userId],
    );
    const rows = await this.db.query(
      `SELECT v.id,v.title,v.status,v.property_id,v.created_by,p.title property_title,r.duration_ms,(SELECT COUNT(*) FROM estate_video_likes l WHERE l.video_id=v.id) likes ${videoJoined} LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE ${where} AND ${visibility} ORDER BY v.created_at DESC,v.id LIMIT 24 OFFSET ?`,
      [userId, (page - 1) * 24],
    );
    const items = await Promise.all(
      rows.map(async (v: any) => ({
        ...v,
        thumbnail_url:
          own && !saved
            ? (await this.videos.preview(actor!, v.id)).thumbnail_url
            : `/api/videos/${v.id}/thumbnail`,
        url:
          own && !saved
            ? (await this.videos.preview(actor!, v.id)).url
            : `/api/videos/${v.id}/content`,
      })),
    );
    return {
      items,
      total: Number(count.n),
      page,
      pages: Math.ceil(Number(count.n) / 24),
    };
  }
  async details(id: string, actor?: Actor) {
    const v = await this.access(id, actor);
    const [[likes], [comments], [saves], [mine]] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_likes WHERE video_id=?',
        [id],
      ),
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_comments WHERE video_id=?',
        [id],
      ),
      this.db.query(
        'SELECT COUNT(*) n FROM estate_video_saves WHERE video_id=?',
        [id],
      ),
      this.db.query(
        'SELECT EXISTS(SELECT 1 FROM estate_video_likes WHERE video_id=? AND user_id=?) liked,EXISTS(SELECT 1 FROM estate_video_saves WHERE video_id=? AND user_id=?) saved',
        [id, actor?.id || '', id, actor?.id || ''],
      ),
    ]);
    return {
      id,
      title: v.title,
      status: v.status,
      property_id: v.property_id,
      property_title: v.property_title,
      creator: await this.profile(v.created_by, actor),
      likes: Number(likes.n),
      comments: Number(comments.n),
      saves: Number(saves.n),
      liked: !!Number(mine.liked),
      saved: !!Number(mine.saved),
      can_edit: actor?.id === v.created_by || actor?.role === 'admin',
      share_url: `https://propiedades-eta.vercel.app/descubrir?video=${id}`,
    };
  }
  async reaction(
    actor: Actor,
    id: string,
    kind: 'like' | 'save',
    active: unknown,
  ) {
    await this.access(id, actor);
    if (typeof active !== 'boolean')
      throw new BadRequestException(
        'Indica si quieres activar o quitar la acción.',
      );
    const table = kind === 'like' ? 'estate_video_likes' : 'estate_video_saves';
    await this.db.query(
      active
        ? `INSERT IGNORE INTO ${table}(user_id,video_id) VALUES (?,?)`
        : `DELETE FROM ${table} WHERE user_id=? AND video_id=?`,
      [actor.id, id],
    );
    return this.details(id, actor);
  }
  async follow(actor: Actor, id: string, active: unknown) {
    this.guard();
    if (id === actor.id)
      throw new BadRequestException('No puedes seguir tu propio perfil.');
    if (typeof active !== 'boolean')
      throw new BadRequestException('Acción inválida.');
    await this.profile(id, actor);
    await this.db.query(
      active
        ? 'INSERT IGNORE INTO estate_video_follows(follower_id,followed_id) VALUES (?,?)'
        : 'DELETE FROM estate_video_follows WHERE follower_id=? AND followed_id=?',
      [actor.id, id],
    );
    return this.profile(id, actor);
  }
  async followers(
    id: string,
    rawPage: string,
    direction: 'followers' | 'following' = 'followers',
    query = '',
  ) {
    await this.profile(id);
    const page = Math.max(1, Math.min(10000, parseInt(rawPage, 10) || 1));
    const following = direction === 'following';
    const other = following ? 'followed_id' : 'follower_id';
    const owner = following ? 'follower_id' : 'followed_id';
    const search = text(query, 100);
    const rows = await this.db.query(
      `SELECT u.id,p.avatar_media_id,COALESCE(p.display_name,u.firstName) display_name
       FROM estate_video_follows f
       JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=f.${other}
       LEFT JOIN estate_video_profiles p ON p.user_id=f.${other}
       WHERE f.${owner}=? AND u.isActive=1 AND LOCATE(?,COALESCE(p.display_name,u.firstName))>0
       ORDER BY f.created_at DESC,f.${other} LIMIT 25 OFFSET ?`,
      [id, search, (page - 1) * 24],
    );
    return {
      items: rows.slice(0, 24).map(({ id, display_name, avatar_media_id }) => ({
        id,
        display_name,
        avatar_url: avatar_media_id
          ? this.estate.mediaUrl(avatar_media_id, { id } as Actor)
          : null,
      })),
      has_more: rows.length > 24,
    };
  }
  async comments(id: string, actor?: Actor, commentId?: string) {
    await this.access(id, actor);
    const select =
      'SELECT c.id,c.body,c.created_at,c.user_id,r.parent_id,COALESCE(pp.display_name,pu.firstName) parent_name,COALESCE(p.display_name,u.firstName) display_name FROM estate_video_comments c LEFT JOIN estate_video_comment_replies r ON r.comment_id=c.id LEFT JOIN estate_video_comments parent ON parent.id=r.parent_id LEFT JOIN users pu ON CONVERT(pu.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=parent.user_id AND pu.isActive=1 LEFT JOIN estate_video_profiles pp ON pp.user_id=parent.user_id AND pu.id IS NOT NULL JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=c.user_id LEFT JOIN estate_video_profiles p ON p.user_id=c.user_id WHERE c.video_id=? AND u.isActive=1';
    type CommentRow = {
      id: string;
      parent_id?: string;
      [key: string]: unknown;
    };
    const rows = await this.db.query<CommentRow[]>(
      select + ' ORDER BY c.created_at DESC,c.id LIMIT 100',
      [id],
    );
    if (!commentId) return rows;
    const targetId = uuid(commentId);
    const [target] = await this.db.query<CommentRow[]>(
      select + ' AND c.id=? LIMIT 1',
      [id, targetId],
    );
    if (!target)
      throw new NotFoundException('Este comentario ya no está disponible.');
    const context: CommentRow[] = [];
    if (target.parent_id && !rows.some((row) => row.id === target.parent_id)) {
      const [parent] = await this.db.query<CommentRow[]>(
        select + ' AND c.id=? LIMIT 1',
        [id, target.parent_id],
      );
      if (parent) context.push(parent);
    }
    if (!rows.some((row) => row.id === target.id)) context.push(target);
    return [...context, ...rows];
  }
  async comment(actor: Actor, id: string, body: any, ip: string) {
    const video = await this.access(id, actor);
    this.estate.throttle(`video-comment:${actor.id}:${ip}`, 15, 60000);
    const message = text(body.body, 2000);
    if (!message) throw new BadRequestException('Escribe un comentario.');
    const parentId = body.parent_id == null ? null : uuid(body.parent_id);
    await this.db.transaction(async (tx) => {
      let parentUserId: string | undefined;
      if (parentId) {
        const [parent] = await tx.query(
          'SELECT id,user_id FROM estate_video_comments WHERE id=? AND video_id=?',
          [parentId, id],
        );
        if (!parent)
          throw new NotFoundException(
            'Comentario no disponible en este video.',
          );
        parentUserId = parent.user_id;
      }
      const commentId = randomUUID();
      await tx.query(
        'INSERT INTO estate_video_comments(id,video_id,user_id,body) VALUES (?,?,?,?)',
        [commentId, id, actor.id, message],
      );
      if (parentId)
        await tx.query(
          'INSERT INTO estate_video_comment_replies(comment_id,parent_id) VALUES (?,?)',
          [commentId, parentId],
        );
      const event = {
        commentId,
        ownerId: video.created_by,
        parentUserId,
        actorId: actor.id,
      };
      await this.activity.recordComment(tx, event);
      await this.push.enqueueVideoComment(tx, event);
    });
    return this.comments(id, actor);
  }
  async link(actor: Actor, id: string, propertyId: unknown) {
    const video = await this.access(id, actor);
    if (video.created_by !== actor.id && actor.role !== 'admin')
      throw new ForbiddenException('Solo puedes editar tus videos.');
    const target = propertyId === null ? null : uuid(propertyId);
    if (target) await this.estate.get(target, actor);
    await this.db.transaction(async (tx) => {
      if (target)
        await tx.query('SELECT id FROM properties WHERE id=? FOR UPDATE', [
          target,
        ]);
      const [current] = await tx.query(
        'SELECT created_by,status FROM property_videos WHERE id=? FOR UPDATE',
        [id],
      );
      if (!current || current.status === 'archived')
        throw new NotFoundException('Video no disponible.');
      if (current.created_by !== actor.id && actor.role !== 'admin')
        throw new ForbiddenException();
      // Linking is an explicit edit; review publication separately rather than exposing a draft property.
      await tx.query(
        "UPDATE property_videos SET property_id=?,status='draft' WHERE id=?",
        [target, id],
      );
    });
    return this.details(id, actor);
  }
  async download(actor: Actor, id: string) {
    const v = await this.access(id, actor);
    return Number(v.can_view)
      ? { url: `/api/videos/${id}/content` }
      : this.videos.preview(actor, id);
  }
}
