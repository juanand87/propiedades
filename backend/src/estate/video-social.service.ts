import { profileIdentity } from './profile-identity';
import { ModerationService } from './moderation.service';
import { PropertyVideoPublicationService } from './property-video-publication.service';
import { notBlocked, notHidden } from './moderation-rules';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
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
    private moderation: ModerationService,
    @Optional() private videoPublication?: PropertyVideoPublicationService,
  ) {}
  private identityReady = false;
  async identitiesAvailable() {
    if (this.identityReady) return true;
    const [schema] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='estate_profile_identity'",
    );
    return (this.identityReady = Number(schema?.n) === 1);
  }
  async search(
    query: { q?: unknown; kind?: unknown; page?: unknown },
    actor: Actor,
  ) {
    this.guard();
    if (!(await this.identitiesAvailable()))
      throw new ServiceUnavailableException(
        'Buscar perfiles está pendiente de configurar.',
      );
    const kind =
      typeof query.kind === 'string'
        ? query.kind
        : query.kind == null
          ? 'all'
          : '';
    if (!['all', 'person', 'company'].includes(String(kind)))
      throw new BadRequestException('Filtro de perfiles inválido.');
    const q = text(query.q, 100).replace(/^@/, '').trim();
    const page = Math.max(
      1,
      Math.min(10000, parseInt(String(query.page ?? '1'), 10) || 1),
    );
    if (q.length < 2) return { items: [], page, has_more: false };
    this.estate.throttle('profile-search:' + actor.id, 90, 60000);
    const pattern = '%' + q.replace(/[!%_]/g, (char) => '!' + char) + '%';
    const rows = await this.db.query<
      {
        id: string;
        display_name: string;
        avatar_media_id: string | null;
        profile_kind: string | null;
        username: string | null;
        followed: number;
      }[]
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(4000) */ candidate.id,COALESCE(vp.display_name,CONVERT(candidate.firstName USING utf8mb4) COLLATE utf8mb4_unicode_ci) display_name,vp.avatar_media_id,pi.profile_kind,pi.username,
      EXISTS(SELECT 1 FROM estate_video_follows f WHERE f.follower_id=? AND f.followed_id=CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci) followed
      FROM users candidate LEFT JOIN estate_video_profiles vp ON vp.user_id=CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci LEFT JOIN estate_profile_identity pi ON pi.user_id=CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci
      WHERE candidate.isActive=1 AND candidate.id<>? AND (vp.user_id IS NOT NULL OR pi.user_id IS NOT NULL OR EXISTS(SELECT 1 ${videoJoined} WHERE v.created_by=CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND ${videoVisible}))
      AND (CONVERT(COALESCE(vp.display_name,CONVERT(candidate.firstName USING utf8mb4) COLLATE utf8mb4_unicode_ci) USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? ESCAPE '!' OR CONVERT(pi.username USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? ESCAPE '!')
      ${kind === 'all' ? '' : 'AND pi.profile_kind=?'} AND ${notBlocked('?', 'CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci')}
      ORDER BY (CONVERT(pi.username USING utf8mb4) COLLATE utf8mb4_unicode_ci=?) DESC,display_name,candidate.id LIMIT 25 OFFSET ?`,
      [
        actor.id,
        actor.id,
        pattern,
        pattern,
        ...(kind === 'all' ? [] : [kind]),
        actor.id,
        actor.id,
        q,
        (page - 1) * 24,
      ],
    );
    return {
      items: rows.slice(0, 24).map((row) => ({
        id: row.id,
        display_name: row.display_name,
        profile_kind: row.profile_kind,
        username: row.username,
        followed: !!Number(row.followed),
        avatar_url: row.avatar_media_id
          ? this.estate.mediaUrl(row.avatar_media_id, { id: row.id } as Actor)
          : null,
        avatar_thumbnail_url: row.avatar_media_id
          ? this.estate.avatarUrl(row.id, row.avatar_media_id)
          : null,
      })),
      page,
      has_more: rows.length > 24,
    };
  }
  guard() {
    if (this.config.get('SOCIAL_VIDEOS_ENABLED') !== 'true')
      throw new ServiceUnavailableException(
        'El perfil de videos todavía no está habilitado.',
      );
  }
  private async access(id: string, actor?: Actor) {
    this.guard();
    const [v] = await this.db.query(
      `SELECT v.*,(${videoVisible}) can_view,(NOT ${notHidden('video', 'v.id')}) moderation_hidden,p.title property_title ${videoJoined} WHERE v.id=? AND v.status<>'archived'`,
      [uuid(id)],
    );
    if (
      !v ||
      (!Number(v.can_view) &&
        actor?.id !== v.created_by &&
        actor?.role !== 'admin')
    )
      throw new NotFoundException('Video no disponible.');
    if (actor && actor.id !== v.created_by)
      await this.moderation.assertContact(actor.id, v.created_by);
    return v;
  }
  async avatar(userId: string) {
    this.guard();
    const [profile] = await this.db.query(
      'SELECT p.avatar_media_id FROM estate_video_profiles p JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=p.user_id WHERE p.user_id=? AND u.isActive=1',
      [uuid(userId)],
    );
    if (!profile?.avatar_media_id) throw new NotFoundException();
    return this.estate.profileAvatar(profile.avatar_media_id, userId);
  }
  async profile(userId: string, actor?: Actor) {
    this.guard();
    const [u] = await this.db.query(
      'SELECT u.id,u.firstName,p.display_name,p.avatar_media_id FROM users u LEFT JOIN estate_video_profiles p ON p.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE u.id=? AND u.isActive=1',
      [uuid(userId)],
    );
    if (!u) throw new NotFoundException('Perfil no disponible.');
    if (actor && actor.id !== userId)
      await this.moderation.assertContact(actor.id, userId);
    const [identity] = (await this.identitiesAvailable())
      ? await this.db.query<{ profile_kind: string; username: string }[]>(
          'SELECT profile_kind,username FROM estate_profile_identity WHERE user_id=?',
          [userId],
        )
      : [];
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
      profile_kind: identity?.profile_kind || null,
      username: identity?.username || null,
      identity_configured: !!identity,
      avatar_url: u.avatar_media_id
        ? this.estate.mediaUrl(u.avatar_media_id, { id: u.id } as Actor)
        : null,
      avatar_thumbnail_url: u.avatar_media_id
        ? this.estate.avatarUrl(u.id, u.avatar_media_id)
        : null,
      following: Number(following.n),
      followers: Number(followers.n),
      likes: Number(likes.n),
      followed: Number(relation.n) > 0,
    };
  }
  async saveProfile(
    actor: Actor,
    body: {
      profile_kind?: unknown;
      username?: unknown;
      display_name?: unknown;
      avatar_media_id?: unknown;
    },
  ) {
    this.guard();
    const identity =
      body?.profile_kind !== undefined || body?.username !== undefined
        ? profileIdentity(body)
        : null;
    if (identity && !(await this.identitiesAvailable()))
      throw new ServiceUnavailableException(
        'Los tipos de perfil están pendientes de configurar.',
      );
    const name =
      identity?.display_name ||
      text(body?.display_name, 100) ||
      actor.firstName;
    try {
      await this.db.transaction(async (tx) => {
        await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [
          actor.id,
        ]);
        let avatar: string | null = null;
        if (body?.avatar_media_id) {
          const [media] = await tx.query<{ id: string }[]>(
            'SELECT id FROM estate_media WHERE id=? AND owner_id=?',
            [uuid(body.avatar_media_id), actor.id],
          );
          if (!media)
            throw new ForbiddenException(
              'La foto debe pertenecer a tu cuenta.',
            );
          avatar = media.id;
        } else {
          const [old] = await tx.query<{ avatar_media_id: string | null }[]>(
            'SELECT avatar_media_id FROM estate_video_profiles WHERE user_id=?',
            [actor.id],
          );
          avatar = old?.avatar_media_id || null;
        }
        await tx.query(
          'INSERT INTO estate_video_profiles(user_id,display_name,avatar_media_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),avatar_media_id=VALUES(avatar_media_id)',
          [actor.id, name, avatar],
        );
        if (identity) {
          const [old] = await tx.query<{ user_id: string }[]>(
            'SELECT user_id FROM estate_profile_identity WHERE user_id=? FOR UPDATE',
            [actor.id],
          );
          if (old)
            await tx.query(
              'UPDATE estate_profile_identity SET profile_kind=?,username=? WHERE user_id=?',
              [identity.profile_kind, identity.username, actor.id],
            );
          else
            await tx.query(
              'INSERT INTO estate_profile_identity(user_id,profile_kind,username) VALUES (?,?,?)',
              [actor.id, identity.profile_kind, identity.username],
            );
        }
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new ConflictException('Ese @usuario ya está en uso. Elige otro.');
      throw error;
    }
    return this.profile(actor.id, actor);
  }
  async gallery(userId: string, q: any, actor?: Actor) {
    this.guard();
    const ownerProfile = await this.profile(userId, actor);
    const own = actor?.id === userId;
    const saved = own && q.saved === 'true';
    const page = Math.max(1, Math.min(10000, parseInt(q.page, 10) || 1));
    const where = saved
      ? 'v.id IN (SELECT video_id FROM estate_video_saves WHERE user_id=?)'
      : 'v.created_by=?';
    const visibility =
      (own && !saved ? "v.status<>'archived'" : videoVisible) +
      (actor ? ' AND ' + notBlocked('?', 'v.created_by') : '');
    const viewerParams = actor ? [actor.id, actor.id] : [];
    const [count] = await this.db.query(
      `SELECT COUNT(*) n ${videoJoined} WHERE ${where} AND ${visibility}`,
      [userId, ...viewerParams],
    );
    const rows = await this.db.query(
      `SELECT v.id,v.title,v.status,v.property_id,v.created_by,p.title property_title,r.duration_ms,(NOT ${notHidden('video', 'v.id')}) moderation_hidden,(SELECT COUNT(*) FROM estate_video_likes l WHERE l.video_id=v.id) likes ${videoJoined} LEFT JOIN property_video_recordings r ON r.video_id=v.id WHERE ${where} AND ${visibility} ORDER BY v.created_at DESC,v.id LIMIT 24 OFFSET ?`,
      [userId, ...viewerParams, (page - 1) * 24],
    );
    const publicHls = await this.videos.hlsUrls(
      rows.map((v: { id: string }) => v.id),
    );
    const covers = await this.videos.posterPreviews(
      rows.map((v: { id: string }) => v.id),
    );
    const items = await Promise.all(
      rows.map(async (v: { id: string; [key: string]: unknown }) => {
        const preview =
          own && !saved ? await this.videos.preview(actor!, v.id, false) : null;
        return {
          ...v,
          creator:
            v.created_by === userId
              ? {
                  id: userId,
                  display_name: ownerProfile.display_name,
                  followed: ownerProfile.followed,
                  avatar_url: ownerProfile.avatar_url,
                  avatar_thumbnail_url: ownerProfile.avatar_thumbnail_url,
                }
              : undefined,
          thumbnail_preview: covers.get(v.id) || null,
          thumbnail_url:
            preview?.thumbnail_url || `/api/videos/${v.id}/thumbnail`,
          url: preview?.url || `/api/videos/${v.id}/content`,
          hls_url: preview?.hls_url || publicHls.get(v.id) || null,
        };
      }),
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
        'SELECT COUNT(*) n FROM estate_video_comments WHERE video_id=? AND ' +
          notHidden('comment', 'id'),
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
      moderation_hidden: !!Number(v.moderation_hidden),
      property_id: v.property_id,
      property_title: v.property_title,
      creator: await this.profile(v.created_by, actor),
      likes: Number(likes.n),
      comments: Number(comments.n),
      saves: Number(saves.n),
      liked: !!Number(mine.liked),
      saved: !!Number(mine.saved),
      can_edit: actor?.id === v.created_by || actor?.role === 'admin',
      hls_url: (await this.videos.hlsUrls([id])).get(id) || null,
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
    actor?: Actor,
  ) {
    await this.profile(id, actor);
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
       WHERE f.${owner}=? AND u.isActive=1 AND LOCATE(?,COALESCE(p.display_name,u.firstName))>0 ${actor ? 'AND ' + notBlocked('?', 'u.id') : ''}
       ORDER BY f.created_at DESC,f.${other} LIMIT 25 OFFSET ?`,
      [id, search, ...(actor ? [actor.id, actor.id] : []), (page - 1) * 24],
    );
    return {
      items: rows.slice(0, 24).map(({ id, display_name, avatar_media_id }) => ({
        id,
        display_name,
        avatar_url: avatar_media_id
          ? this.estate.mediaUrl(avatar_media_id, { id } as Actor)
          : null,
        avatar_thumbnail_url: avatar_media_id
          ? this.estate.avatarUrl(id, avatar_media_id)
          : null,
      })),
      has_more: rows.length > 24,
    };
  }
  async comments(id: string, actor?: Actor, commentId?: string) {
    await this.access(id, actor);
    const select =
      'SELECT c.id,c.body,c.created_at,c.user_id,r.parent_id,COALESCE(pp.display_name,pu.firstName) parent_name,COALESCE(p.display_name,u.firstName) display_name FROM estate_video_comments c LEFT JOIN estate_video_comment_replies r ON r.comment_id=c.id LEFT JOIN estate_video_comments parent ON parent.id=r.parent_id LEFT JOIN users pu ON CONVERT(pu.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=parent.user_id AND pu.isActive=1 LEFT JOIN estate_video_profiles pp ON pp.user_id=parent.user_id AND pu.id IS NOT NULL JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=c.user_id LEFT JOIN estate_video_profiles p ON p.user_id=c.user_id WHERE c.video_id=? AND u.isActive=1' +
      ' AND ' +
      notHidden('comment', 'c.id') +
      (actor ? ' AND ' + notBlocked('?', 'c.user_id') : '');
    const params = [id, ...(actor ? [actor.id, actor.id] : [])];
    type CommentRow = {
      id: string;
      parent_id?: string;
      [key: string]: unknown;
    };
    const rows = await this.db.query<CommentRow[]>(
      select + ' ORDER BY c.created_at DESC,c.id LIMIT 100',
      params,
    );
    if (!commentId) return rows;
    const targetId = uuid(commentId);
    const [target] = await this.db.query<CommentRow[]>(
      select + ' AND c.id=? LIMIT 1',
      [...params, targetId],
    );
    if (!target)
      throw new NotFoundException('Este comentario ya no está disponible.');
    const context: CommentRow[] = [];
    if (target.parent_id && !rows.some((row) => row.id === target.parent_id)) {
      const [parent] = await this.db.query<CommentRow[]>(
        select + ' AND c.id=? LIMIT 1',
        [...params, target.parent_id],
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
          'SELECT id,user_id FROM estate_video_comments WHERE id=? AND video_id=? AND ' +
            notHidden('comment', 'id'),
          [parentId, id],
        );
        if (!parent)
          throw new NotFoundException(
            'Comentario no disponible en este video.',
          );
        await this.moderation.assertContact(actor.id, parent.user_id, tx);
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
  async link(
    actor: Actor,
    id: string,
    propertyId: unknown,
    publishWithProperty?: unknown,
  ) {
    if (
      publishWithProperty !== undefined &&
      typeof publishWithProperty !== 'boolean'
    )
      throw new BadRequestException(
        'La opción de publicación debe ser verdadera o falsa.',
      );
    const video = await this.access(id, actor);
    if (video.created_by !== actor.id && actor.role !== 'admin')
      throw new ForbiddenException('Solo puedes editar tus videos.');
    const target = propertyId === null ? null : uuid(propertyId);
    if (target) await this.estate.get(target, actor);
    await this.db.transaction(async (tx) => {
      const [property] = target
        ? await tx.query(
            'SELECT id,publication_status FROM properties WHERE id=? FOR UPDATE',
            [target],
          )
        : [];
      const [current] = await tx.query(
        'SELECT created_by,status,property_id FROM property_videos WHERE id=? FOR UPDATE',
        [id],
      );
      if (!current || current.status === 'archived')
        throw new NotFoundException('Video no disponible.');
      if (current.created_by !== actor.id && actor.role !== 'admin')
        throw new ForbiddenException();
      // Linking keeps the user's publication choice. Public access still requires
      // the linked property to be approved (videoVisible). Unlinking an existing
      // property requires an explicit publication again as a standalone video.
      const status =
        target === null && current.property_id ? 'draft' : current.status;
      await tx.query(
        'UPDATE property_videos SET property_id=?,status=?,updated_at=UTC_TIMESTAMP() WHERE id=?',
        [target, status, id],
      );
      await this.videoPublication?.link(
        tx,
        id,
        target,
        actor.id,
        property?.publication_status,
        publishWithProperty === true,
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
