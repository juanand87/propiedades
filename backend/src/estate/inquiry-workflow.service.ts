import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Actor, choice, isAdmin, text, uuid } from './rules';
import { InquiryNoticesService } from './inquiry-notices.service';
export const inquiryStages = [
  'new',
  'contacted',
  'visit_scheduled',
  'negotiation',
  'closed',
];
type DB = Pick<EntityManager, 'query'>;
type Lead = { id: string; owner_user_id: string; status: string };
@Injectable()
export class InquiryWorkflowService {
  constructor(
    private db: DataSource,
    @Optional() private notices?: InquiryNoticesService,
  ) {}
  async available() {
    const [r] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_workflow','estate_inquiry_assignments','estate_inquiry_events')",
    );
    return Number(r.n) === 3;
  }
  async notificationsAvailable() {
    return this.notices ? this.notices.available() : false;
  }
  private async ready() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'El seguimiento de interesados está pendiente de activar.',
      );
  }
  private async access(
    actor: Actor,
    id: string,
    tx: DB = this.db,
    lock = false,
  ) {
    const [lead] = await tx.query<Lead[]>(
      `SELECT i.id,i.status,a.user_id owner_user_id FROM property_inquiries i JOIN properties p ON p.id=i.property_id JOIN advertisers a ON a.id=p.advertiser_id WHERE i.id=? ${lock ? 'FOR UPDATE' : ''}`,
      [uuid(id)],
    );
    if (!lead) throw new NotFoundException('Consulta no disponible.');
    const owner = isAdmin(actor) || lead.owner_user_id === actor.id;
    if (!owner) {
      const [assigned] = await tx.query<{ inquiry_id: string }[]>(
        `SELECT ia.inquiry_id FROM estate_inquiry_assignments ia JOIN estate_company_members m ON m.team_id=ia.team_id AND m.user_id=ia.user_id AND m.status='active' JOIN estate_company_teams t ON t.id=ia.team_id AND t.owner_user_id=? JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND u.isActive=1 WHERE ia.inquiry_id=? AND ia.user_id=? ${lock ? 'FOR UPDATE' : ''}`,
        [lead.owner_user_id, id, actor.id],
      );
      if (!assigned)
        throw new ForbiddenException(
          'Este interesado no está asignado a tu cuenta o tu acceso fue retirado.',
        );
    }
    return { ...lead, owner };
  }
  authorize(actor: Actor, id: string, tx: DB = this.db, lock = false) {
    return this.access(actor, id, tx, lock);
  }
  async list(actor: Actor, inquiryId?: string) {
    await this.ready();
    const items = await this.db.query<Record<string, unknown>[]>(
      `SELECT i.id,i.name,i.email,i.phone,i.message,i.created_at,p.id property_id,p.title,p.code,a.display_name company_name,
   COALESCE(w.stage,i.status) stage,COALESCE(w.revision,0) revision,
   CASE WHEN a.user_id=? OR ?=1 THEN 1 ELSE 0 END can_manage,
   ot.id team_id,CASE WHEN m.status='active' AND au.isActive=1 THEN ia.user_id ELSE NULL END assignee_id,
   CASE WHEN m.status='active' AND au.isActive=1 THEN CONCAT(au.firstName,' ',au.lastName) ELSE NULL END assignee_name
   FROM property_inquiries i JOIN properties p ON p.id=i.property_id JOIN advertisers a ON a.id=p.advertiser_id
   JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id AND owner.isActive=1
   LEFT JOIN estate_inquiry_workflow w ON w.inquiry_id=i.id
   LEFT JOIN estate_inquiry_assignments ia ON ia.inquiry_id=i.id
   LEFT JOIN estate_company_members m ON m.team_id=ia.team_id AND m.user_id=ia.user_id
   LEFT JOIN users au ON CONVERT(au.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=ia.user_id
   LEFT JOIN estate_profile_identity pi ON pi.user_id=a.user_id
   LEFT JOIN estate_company_teams ot ON ot.owner_user_id=a.user_id AND pi.profile_kind='company' AND a.status='approved'
   WHERE (?=1 OR a.user_id=? OR (ia.user_id=? AND m.status='active' AND ot.id=ia.team_id))
   ${inquiryId ? 'AND i.id=?' : ''} ORDER BY i.created_at DESC,i.id DESC LIMIT 201`,
      [
        actor.id,
        isAdmin(actor) ? 1 : 0,
        isAdmin(actor) ? 1 : 0,
        actor.id,
        actor.id,
        ...(inquiryId ? [uuid(inquiryId)] : []),
      ],
    );
    const agents = await this.db.query<
      { team_id: string; user_id: string; name: string }[]
    >(
      `SELECT m.team_id,m.user_id,CONCAT(u.firstName,' ',u.lastName) name FROM estate_company_members m JOIN estate_company_teams t ON t.id=m.team_id JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id AND u.isActive=1 WHERE m.role='agent' AND m.status='active' AND (?=1 OR t.owner_user_id=?) ORDER BY u.firstName LIMIT 1000`,
      [isAdmin(actor) ? 1 : 0, actor.id],
    );
    return {
      items: items.slice(0, 200).map((i) => ({
        ...i,
        revision: Number(i.revision),
        can_manage: Number(i.can_manage),
      })),
      agents,
      truncated: items.length > 200,
    };
  }
  async update(
    actor: Actor,
    id: string,
    body: { stage?: unknown; revision?: unknown },
    requireRevision = true,
  ) {
    await this.ready();
    const stage = choice(body.stage, inquiryStages);
    return this.db.transaction(async (tx) => {
      const lead = await this.access(actor, id, tx, true);
      const [current] = await tx.query<{ stage: string; revision: number }[]>(
        'SELECT stage,revision FROM estate_inquiry_workflow WHERE inquiry_id=? FOR UPDATE',
        [id],
      );
      const revision = Number(current?.revision || 0),
        previous = current?.stage || lead.status;
      if (
        requireRevision &&
        (!Number.isSafeInteger(body.revision) || body.revision !== revision)
      )
        throw new ConflictException(
          'El seguimiento cambió. Recarga antes de actualizarlo.',
        );
      if (stage === previous) return { success: true };
      await tx.query(
        'INSERT INTO estate_inquiry_workflow(inquiry_id,stage,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stage=VALUES(stage),revision=revision+1,updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(3)',
        [id, stage, actor.id],
      );
      await tx.query('UPDATE property_inquiries SET status=? WHERE id=?', [
        stage === 'new' ? 'new' : stage === 'closed' ? 'closed' : 'contacted',
        id,
      ]);
      await this.event(tx, actor, id, 'stage', previous, stage);
      if (stage === 'closed') {
        const [schema] = await tx.query<{ n: number }[]>(
          "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_tasks','estate_inquiry_task_events')",
        );
        if (Number(schema?.n) === 2) {
          await tx.query(
            "INSERT INTO estate_inquiry_task_events(id,task_id,actor_id,action,snapshot_json) SELECT UUID(),id,?,'cancelled',JSON_OBJECT('kind',kind,'note',note,'due_at',DATE_FORMAT(due_at,'%Y-%m-%dT%H:%i:%sZ'),'status','cancelled','reason','inquiry_closed') FROM estate_inquiry_tasks WHERE inquiry_id=? AND status='pending'",
            [actor.id, id],
          );
          await tx.query(
            "UPDATE estate_inquiry_tasks SET status='cancelled',revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE inquiry_id=? AND status='pending'",
            [actor.id, id],
          );
        }
      }
      return { success: true };
    });
  }
  private async event(
    tx: DB,
    actor: Actor,
    id: string,
    action: 'stage' | 'assignment',
    previous: string | null,
    next: string | null,
  ) {
    const eventId = randomUUID();
    await tx.query(
      'INSERT INTO estate_inquiry_events(id,inquiry_id,actor_id,action,previous_value,next_value) VALUES (?,?,?,?,?,?)',
      [eventId, id, actor.id, action, previous, next],
    );
    return eventId;
  }
  async assign(actor: Actor, id: string, userId: unknown) {
    await this.ready();
    const user = userId === null ? null : uuid(userId);
    return this.db.transaction(async (tx) => {
      const lead = await this.access(actor, id, tx, true);
      if (!lead.owner)
        throw new ForbiddenException(
          'Solo la empresa puede asignar o reasignar interesados.',
        );
      const [team] = await tx.query<{ id: string }[]>(
        "SELECT t.id FROM estate_company_teams t JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND u.isActive=1 WHERE t.owner_user_id=? FOR UPDATE",
        [lead.owner_user_id],
      );
      if (!team)
        throw new ForbiddenException(
          'La asignación requiere un equipo de empresa aprobado.',
        );
      if (user) {
        const [member] = await tx.query<{ user_id: string }[]>(
          "SELECT m.user_id FROM estate_company_members m JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id AND u.isActive=1 WHERE m.team_id=? AND m.user_id=? AND m.role='agent' AND m.status='active' FOR UPDATE",
          [team.id, user],
        );
        if (!member)
          throw new ForbiddenException(
            'Selecciona un agente activo de esta empresa.',
          );
      }
      const [old] = await tx.query<{ user_id: string }[]>(
        'SELECT user_id FROM estate_inquiry_assignments WHERE inquiry_id=? FOR UPDATE',
        [id],
      );
      if ((old?.user_id || null) === user) return { success: true };
      if (user)
        await tx.query(
          'INSERT INTO estate_inquiry_assignments(inquiry_id,team_id,user_id,assigned_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE team_id=VALUES(team_id),user_id=VALUES(user_id),assigned_by=VALUES(assigned_by),assigned_at=UTC_TIMESTAMP(3)',
          [id, team.id, user, actor.id],
        );
      else
        await tx.query(
          'DELETE FROM estate_inquiry_assignments WHERE inquiry_id=?',
          [id],
        );
      const eventId = await this.event(
        tx,
        actor,
        id,
        'assignment',
        old?.user_id || null,
        user,
      );
      if (user) await this.notices?.enqueue(tx, eventId, id, user);
      return { success: true };
    });
  }
  async history(actor: Actor, id: string) {
    await this.ready();
    await this.access(actor, id);
    const notes = await this.db.query<Record<string, unknown>[]>(
      'SELECT n.id,n.message,n.created_at,u.firstName author_name FROM property_inquiry_messages n LEFT JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=n.author_id WHERE n.inquiry_id=? ORDER BY n.created_at DESC LIMIT 200',
      [id],
    );
    const events = await this.db.query<Record<string, unknown>[]>(
      'SELECT e.id,e.action,e.previous_value,e.next_value,e.created_at,u.firstName actor_name,prevu.firstName previous_name,nextu.firstName next_name FROM estate_inquiry_events e LEFT JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=e.actor_id LEFT JOIN users prevu ON CONVERT(prevu.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=e.previous_value LEFT JOIN users nextu ON CONVERT(nextu.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=e.next_value WHERE e.inquiry_id=? ORDER BY e.created_at DESC LIMIT 200',
      [id],
    );
    return { notes, events };
  }
  async detail(actor: Actor, id: string) {
    await this.ready();
    await this.access(actor, id);
    const result = await this.list(actor, id);
    if (!result.items[0])
      throw new NotFoundException('Consulta no disponible.');
    return result.items[0];
  }
  async note(actor: Actor, id: string, value: unknown) {
    await this.ready();
    if (typeof value !== 'string' || !value.trim() || value.length > 5000)
      throw new BadRequestException(
        'Escribe una nota de hasta 5.000 caracteres.',
      );
    return this.db.transaction(async (tx) => {
      await this.access(actor, id, tx, true);
      await tx.query(
        'INSERT INTO property_inquiry_messages(id,inquiry_id,author_id,message) VALUES (?,?,?,?)',
        [randomUUID(), id, actor.id, text(value, 5000)],
      );
      return { success: true };
    });
  }
}
