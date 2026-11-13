import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Actor, admin, text, uuid } from './rules';
import { EstateService } from './estate.service';
import { PropertyVideosService } from './property-videos.service';
import { videoJoined, videoVisible } from './video-visibility';
import { ReportKind, notBlocked } from './moderation-rules';
const kind = (value: unknown): ReportKind => {
  if (!['user', 'video', 'comment'].includes(String(value)))
    throw new BadRequestException('Tipo de reporte inválido.');
  return value as ReportKind;
};
type ReportRow = {
  id: string;
  target_kind: ReportKind;
  target_id: string;
  status: string;
  snapshot_json: string;
  action: string | null;
  [key: string]: unknown;
};
@Injectable()
export class ModerationService {
  async capabilities() {
    const [row] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_user_blocks','estate_content_moderation','estate_reports','estate_moderation_actions')",
    );
    return { enabled: Number(row.n) === 4 };
  }
  constructor(
    private db: DataSource,
    private estate: EstateService,
    private videos: PropertyVideosService,
  ) {}
  async assertContact(
    left: string,
    right: string,
    db: Pick<DataSource, 'query'> | EntityManager = this.db,
  ) {
    const [row] = await db.query<{ ok: number }[]>(
      `SELECT ${notBlocked('?', '?')} ok`,
      [left, right, right, left],
    );
    if (!Number(row.ok))
      throw new ForbiddenException('No puedes interactuar con esta cuenta.');
  }
  async blocks(actor: Actor) {
    const rows = await this.db.query<
      { id: string; display_name: string; avatar_media_id: string | null }[]
    >(
      'SELECT u.id,COALESCE(p.display_name,u.firstName) display_name,p.avatar_media_id FROM estate_user_blocks b JOIN users u ON u.id=b.blocked_id LEFT JOIN estate_video_profiles p ON p.user_id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC,b.blocked_id',
      [actor.id],
    );
    return {
      items: rows.map(({ avatar_media_id, ...row }) => ({
        ...row,
        avatar_url: avatar_media_id
          ? this.estate.mediaUrl(avatar_media_id, { id: row.id } as Actor)
          : null,
      })),
    };
  }
  async block(actor: Actor, id: string, active: unknown) {
    uuid(id);
    if (typeof active !== 'boolean')
      throw new BadRequestException('Estado inválido.');
    if (id.toLowerCase() === actor.id.toLowerCase())
      throw new BadRequestException('No puedes bloquear tu propia cuenta.');
    await this.db.transaction(async (tx) => {
      const [user] = await tx.query<{ id: string }[]>(
        'SELECT id FROM users WHERE id=?',
        [id],
      );
      if (!user) throw new NotFoundException('Usuario no disponible.');
      if (active) {
        await tx.query(
          'INSERT IGNORE INTO estate_user_blocks(blocker_id,blocked_id) VALUES (?,?)',
          [actor.id, id],
        );
        await tx.query(
          'DELETE FROM estate_video_follows WHERE (follower_id=? AND followed_id=?) OR (follower_id=? AND followed_id=?)',
          [actor.id, id, id, actor.id],
        );
        await tx.query(
          "UPDATE estate_push_deliveries d JOIN estate_direct_messages m ON m.id=d.message_id JOIN estate_conversations c ON c.id=m.conversation_id SET d.status='done' WHERE ((c.user_low_id=? AND c.user_high_id=?) OR (c.user_low_id=? AND c.user_high_id=?)) AND d.status='pending'",
          [actor.id, id, id, actor.id],
        );
        await tx.query(
          "UPDATE estate_video_push_deliveries d JOIN estate_video_comments c ON c.id=d.comment_id SET d.status='done' WHERE ((d.user_id=? AND c.user_id=?) OR (d.user_id=? AND c.user_id=?)) AND d.status='pending'",
          [actor.id, id, id, actor.id],
        );
      } else
        await tx.query(
          'DELETE FROM estate_user_blocks WHERE blocker_id=? AND blocked_id=?',
          [actor.id, id],
        );
    });
    return { success: true };
  }
  private async snapshot(actor: Actor, type: ReportKind, id: string) {
    if (type === 'user') {
      const [row] = await this.db.query<{ id: string; display_name: string }[]>(
        'SELECT u.id,COALESCE(p.display_name,u.firstName) display_name FROM users u LEFT JOIN estate_video_profiles p ON p.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE u.id=? AND u.isActive=1',
        [id],
      );
      if (!row) throw new NotFoundException('Usuario no disponible.');
      return row;
    }
    const [row] = await this.db.query<
      {
        id: string;
        video_id: string;
        owner_id: string;
        video_owner_id: string;
        title: string;
        body?: string;
        can_view: number;
      }[]
    >(
      type === 'video'
        ? `SELECT v.id,v.id video_id,v.created_by owner_id,v.created_by video_owner_id,v.title,(${videoVisible}) can_view ${videoJoined} WHERE v.id=? AND v.status<>'archived'`
        : `SELECT c.id,c.video_id,c.user_id owner_id,v.created_by video_owner_id,v.title,c.body,(${videoVisible}) can_view ${videoJoined} JOIN estate_video_comments c ON c.video_id=v.id WHERE c.id=? AND v.status<>'archived'`,
      [id],
    );
    if (
      !row ||
      (!Number(row.can_view) &&
        row.video_owner_id !== actor.id &&
        actor.role !== 'admin')
    )
      throw new NotFoundException('Contenido no disponible.');
    return row;
  }
  async report(
    actor: Actor,
    body: {
      kind?: unknown;
      target_id?: unknown;
      reason?: unknown;
      details?: unknown;
    },
  ) {
    const type = kind(body.kind),
      id = uuid(body.target_id),
      reason = text(body.reason, 24),
      details = text(body.details, 1000);
    if (
      ![
        'spam',
        'scam',
        'harassment',
        'inappropriate',
        'privacy',
        'other',
      ].includes(reason)
    )
      throw new BadRequestException('Selecciona un motivo.');
    const snapshot = await this.snapshot(actor, type, id);
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      const [existing] = await tx.query<{ id: string }[]>(
        'SELECT id FROM estate_reports WHERE reporter_id=? AND target_kind=? AND target_id=?',
        [actor.id, type, id],
      );
      if (existing) return { id: existing.id, reused: true };
      const [count] = await tx.query<{ n: number }[]>(
        'SELECT COUNT(*) n FROM estate_reports WHERE reporter_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 DAY',
        [actor.id],
      );
      if (Number(count.n) >= 50)
        throw new BadRequestException(
          'Alcanzaste el límite diario de reportes.',
        );
      const reportId = randomUUID();
      await tx.query(
        'INSERT INTO estate_reports(id,reporter_id,target_kind,target_id,reason,details,snapshot_json) VALUES (?,?,?,?,?,?,?)',
        [
          reportId,
          actor.id,
          type,
          id,
          reason,
          details,
          JSON.stringify(snapshot),
        ],
      );
      return { id: reportId, reused: false };
    });
  }
  async list(actor: Actor, query: { status?: string; page?: string }) {
    admin(actor);
    const status = query.status || 'open';
    if (!['open', 'resolved', 'dismissed', 'all'].includes(status))
      throw new BadRequestException('Estado inválido.');
    const page = Math.max(
      1,
      Math.min(10000, parseInt(query.page || '1', 10) || 1),
    );
    const condition = status === 'all' ? '' : ' WHERE r.status=?';
    const params = status === 'all' ? [] : [status];
    const [count] = await this.db.query<{ n: number }[]>(
      'SELECT COUNT(*) n FROM estate_reports r' + condition,
      params,
    );
    const rows = await this.db.query<ReportRow[]>(
      'SELECT r.*,u.firstName reporter_name FROM estate_reports r JOIN users u ON u.id=r.reporter_id' +
        condition +
        ' ORDER BY r.created_at DESC,r.id LIMIT 20 OFFSET ?',
      [...params, (page - 1) * 20],
    );
    return {
      items: rows.map(({ snapshot_json, ...row }) => ({
        ...row,
        snapshot: JSON.parse(snapshot_json) as Record<string, unknown>,
      })),
      total: Number(count.n),
      page,
      pages: Math.ceil(Number(count.n) / 20),
    };
  }
  async detail(actor: Actor, id: string) {
    admin(actor);
    const [row] = await this.db.query<ReportRow[]>(
      'SELECT r.*,u.firstName reporter_name FROM estate_reports r JOIN users u ON u.id=r.reporter_id WHERE r.id=?',
      [uuid(id)],
    );
    if (!row) throw new NotFoundException('Reporte no disponible.');
    const { snapshot_json, ...report } = row;
    const snapshot = JSON.parse(snapshot_json) as { video_id?: string };
    const preview = snapshot.video_id
      ? await this.videos.preview(actor, snapshot.video_id).catch(() => null)
      : null;
    const [restriction] = await this.db.query<{ hidden: number }[]>(
      'SELECT hidden FROM estate_content_moderation WHERE target_kind=? AND target_id=?',
      [row.target_kind, row.target_id],
    );
    const actions = await this.db.query<Record<string, unknown>[]>(
      'SELECT a.id,a.action,a.note,a.created_at,u.firstName moderator_name FROM estate_moderation_actions a JOIN users u ON u.id=a.moderator_id WHERE a.target_kind=? AND a.target_id=? ORDER BY a.created_at DESC',
      [row.target_kind, row.target_id],
    );
    return {
      ...report,
      snapshot,
      preview,
      restricted: !!Number(restriction?.hidden),
      actions,
    };
  }
  async review(
    actor: Actor,
    id: string,
    body: { action?: unknown; note?: unknown },
  ) {
    admin(actor);
    const action = text(body.action, 16),
      note = text(body.note, 2000);
    if (!['dismiss', 'hide', 'suspend'].includes(action) || note.length < 3)
      throw new BadRequestException(
        'Selecciona una acción y escribe el motivo.',
      );
    await this.db.transaction(async (tx) => {
      const [r] = await tx.query<ReportRow[]>(
        'SELECT * FROM estate_reports WHERE id=? FOR UPDATE',
        [uuid(id)],
      );
      if (!r) throw new NotFoundException('Reporte no disponible.');
      if (r.status !== 'open')
        throw new ConflictException('Este reporte ya fue revisado.');
      if (
        (action === 'hide' && r.target_kind === 'user') ||
        (action === 'suspend' && r.target_kind !== 'user')
      )
        throw new BadRequestException('Acción no válida para este reporte.');
      if (action !== 'dismiss')
        await this.restrict(tx, actor, r.target_kind, r.target_id, true, note);
      await tx.query(
        'UPDATE estate_reports SET status=?,action=?,resolution_note=?,reviewer_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE id=?',
        [
          action === 'dismiss' ? 'dismissed' : 'resolved',
          action,
          note,
          actor.id,
          id,
        ],
      );
      await this.audit(tx, actor, r.target_kind, r.target_id, action, note, id);
    });
    return { success: true };
  }
  private async restrict(
    tx: EntityManager,
    actor: Actor,
    type: ReportKind,
    id: string,
    hidden: boolean,
    note: string,
  ) {
    if (type === 'user') {
      const [user] = await tx.query<{ role: string }[]>(
        'SELECT role FROM users WHERE id=? FOR UPDATE',
        [id],
      );
      if (!user) throw new NotFoundException('Usuario no disponible.');
      if (user.role === 'admin' || id === actor.id)
        throw new ForbiddenException(
          'No puedes suspender o restaurar administradores desde moderación.',
        );
      await tx.query('UPDATE users SET isActive=? WHERE id=?', [
        hidden ? 0 : 1,
        id,
      ]);
    }
    await tx.query(
      'INSERT INTO estate_content_moderation(target_kind,target_id,hidden,moderator_id,note,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE hidden=VALUES(hidden),moderator_id=VALUES(moderator_id),note=VALUES(note),updated_at=VALUES(updated_at)',
      [type, id, hidden ? 1 : 0, actor.id, note],
    );
  }
  private async audit(
    tx: EntityManager,
    actor: Actor,
    type: ReportKind,
    id: string,
    action: string,
    note: string,
    reportId: string | null,
  ) {
    await tx.query(
      'INSERT INTO estate_moderation_actions(id,moderator_id,report_id,target_kind,target_id,action,note) VALUES (?,?,?,?,?,?,?)',
      [randomUUID(), actor.id, reportId, type, id, action, note],
    );
  }
  async restore(
    actor: Actor,
    typeInput: unknown,
    id: string,
    noteInput: unknown,
  ) {
    admin(actor);
    const type = kind(typeInput),
      note = text(noteInput, 2000);
    uuid(id);
    if (note.length < 3)
      throw new BadRequestException('Escribe el motivo de restauración.');
    await this.db.transaction(async (tx) => {
      const [row] = await tx.query<{ hidden: number }[]>(
        'SELECT hidden FROM estate_content_moderation WHERE target_kind=? AND target_id=? FOR UPDATE',
        [type, id],
      );
      if (!Number(row?.hidden))
        throw new BadRequestException(
          'Este contenido no está restringido por moderación.',
        );
      await this.restrict(tx, actor, type, id, false, note);
      await this.audit(tx, actor, type, id, 'restore', note, null);
    });
    return { success: true };
  }
}
