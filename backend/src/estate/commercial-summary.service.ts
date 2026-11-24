import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Actor, choice, uuid } from './rules';
type DB = Pick<EntityManager, 'query'>;
const base = `FROM property_inquiries i JOIN properties p ON p.id=i.property_id
 LEFT JOIN estate_inquiry_workflow w ON w.inquiry_id=i.id
 LEFT JOIN estate_inquiry_assignments ia ON ia.inquiry_id=i.id
 LEFT JOIN estate_company_teams team ON team.id=ia.team_id
 LEFT JOIN estate_company_members m ON m.team_id=ia.team_id AND m.user_id=ia.user_id AND m.status='active' AND m.role='agent'
 LEFT JOIN users agent ON CONVERT(agent.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id AND agent.isActive=1`;
const active = `team.owner_user_id=? AND agent.id IS NOT NULL`;
const stage = `COALESCE(w.stage,i.status)`;
const kinds = [
  'new_leads',
  'unassigned',
  'open_leads',
  'negotiation',
  'pending_tasks',
  'overdue',
  'visits',
];
const numeric = (r: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v || 0)]));
@Injectable()
export class CommercialSummaryService {
  constructor(private db: DataSource) {}
  async available() {
    const [r] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_workflow','estate_inquiry_assignments','estate_inquiry_tasks','estate_company_teams','estate_company_members','estate_visit_bookings')",
    );
    return Number(r.n) === 6;
  }
  private async company(actor: Actor, tx: DB = this.db) {
    const [row] = await tx.query<{ id: string; name: string }[]>(
      "SELECT a.id,a.display_name name FROM advertisers a JOIN estate_profile_identity pi ON pi.user_id=a.user_id AND pi.profile_kind='company' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id AND u.isActive=1 WHERE a.user_id=? AND a.status='approved'",
      [actor.id],
    );
    return row;
  }
  private async ready() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'El resumen comercial está pendiente de activar.',
      );
  }
  async summary(actor: Actor) {
    await this.ready();
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      const company = await this.company(actor, tx);
      if (!company) return { eligible: false };
      const [leads] = await tx.query<Record<string, unknown>[]>(
        `SELECT COUNT(*) total,COALESCE(SUM(${stage}='new'),0) new_leads,COALESCE(SUM(${stage}<>'closed'),0) open_leads,COALESCE(SUM(${stage}='negotiation'),0) negotiation,COALESCE(SUM(${stage}<>'closed' AND NOT(COALESCE(${active},0))),0) unassigned ${base} WHERE p.advertiser_id=?`,
        [actor.id, company.id],
      );
      const [tasks] = await tx.query<Record<string, unknown>[]>(
        `SELECT COUNT(*) pending_tasks,COALESCE(SUM(t.due_at<=UTC_TIMESTAMP(3)),0) overdue ${base} JOIN estate_inquiry_tasks t ON t.inquiry_id=i.id AND t.status='pending' WHERE p.advertiser_id=? AND ${stage}<>'closed'`,
        [company.id],
      );
      const [visits] = await tx.query<{ n: number }[]>(
        `SELECT (SELECT COUNT(*) FROM estate_visit_bookings b JOIN properties p ON p.id=b.property_id WHERE p.advertiser_id=? AND b.seller_id=? AND b.state='confirmed' AND b.starts_at>=UTC_TIMESTAMP())+(SELECT COUNT(*) FROM property_visit_requests v JOIN property_inquiries i ON i.id=v.inquiry_id JOIN properties p ON p.id=i.property_id WHERE p.advertiser_id=? AND v.status='confirmed' AND v.requested_at>=UTC_TIMESTAMP() AND NOT EXISTS(SELECT 1 FROM estate_visit_bookings b WHERE b.legacy_visit_id=v.id)) n`,
        [company.id, actor.id, company.id],
      );
      const leadGroups = await tx.query<Record<string, unknown>[]>(
        `SELECT CASE WHEN ${active} THEN ia.user_id ELSE NULL END agent_id,COUNT(*) open_leads,COALESCE(SUM(${stage}='new'),0) new_leads,COALESCE(SUM(${stage}='negotiation'),0) negotiation ${base} WHERE p.advertiser_id=? AND ${stage}<>'closed' GROUP BY agent_id`,
        [actor.id, company.id],
      );
      const taskGroups = await tx.query<Record<string, unknown>[]>(
        `SELECT CASE WHEN ${active} THEN ia.user_id ELSE NULL END agent_id,COUNT(*) pending_tasks,COALESCE(SUM(t.due_at<=UTC_TIMESTAMP(3)),0) overdue ${base} JOIN estate_inquiry_tasks t ON t.inquiry_id=i.id AND t.status='pending' WHERE p.advertiser_id=? AND ${stage}<>'closed' GROUP BY agent_id`,
        [actor.id, company.id],
      );
      const agents = await tx.query<{ id: string; name: string }[]>(
        "SELECT m.user_id id,CONCAT(u.firstName,' ',u.lastName) name FROM estate_company_members m JOIN estate_company_teams team ON team.id=m.team_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id AND u.isActive=1 WHERE team.owner_user_id=? AND m.status='active' AND m.role='agent' ORDER BY u.firstName,u.id LIMIT 1001",
        [actor.id],
      );
      const row = (id: string | null) => {
        const l = leadGroups.find((g) => (g.agent_id || null) === id),
          t = taskGroups.find((g) => (g.agent_id || null) === id);
        return {
          open_leads: Number(l?.open_leads || 0),
          new_leads: Number(l?.new_leads || 0),
          negotiation: Number(l?.negotiation || 0),
          pending_tasks: Number(t?.pending_tasks || 0),
          overdue: Number(t?.overdue || 0),
        };
      };
      return {
        eligible: true,
        company_name: company.name,
        updated_at: new Date().toISOString(),
        metrics: {
          ...numeric(leads),
          ...numeric(tasks),
          visits: Number(visits.n),
        },
        agents: agents.slice(0, 1000).map((a) => ({ ...a, ...row(a.id) })),
        direct: row(null),
        agents_truncated: agents.length > 1000,
      };
    });
  }
  async cases(
    actor: Actor,
    q: { kind?: unknown; agentId?: unknown; page?: unknown },
  ) {
    await this.ready();
    const company = await this.company(actor);
    if (!company)
      throw new ForbiddenException(
        'El resumen comercial es exclusivo de la empresa propietaria aprobada.',
      );
    const kind = choice(q.kind, kinds),
      page = q.page === undefined ? 1 : Number(q.page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Página inválida.');
    let agentId: string | null = null;
    if (q.agentId !== undefined) {
      agentId = q.agentId === 'unassigned' ? 'unassigned' : uuid(q.agentId);
      if (agentId !== 'unassigned') {
        const [m] = await this.db.query<{ id: string }[]>(
          "SELECT m.user_id id FROM estate_company_members m JOIN estate_company_teams team ON team.id=m.team_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id AND u.isActive=1 WHERE team.owner_user_id=? AND m.user_id=? AND m.status='active' AND m.role='agent'",
          [actor.id, agentId],
        );
        if (!m)
          throw new ForbiddenException(
            'Este agente ya no forma parte activa de tu empresa.',
          );
      }
    }
    const offset = (page - 1) * 50;
    let items: Record<string, unknown>[];
    if (kind === 'visits') {
      if (agentId)
        throw new BadRequestException(
          'Las visitas se consultan a nivel de empresa.',
        );
      items = await this.db.query<Record<string, unknown>[]>(
        `SELECT * FROM (SELECT b.id,vr.inquiry_id,b.id booking_id,p.title,CONVERT(u.firstName USING utf8mb4) COLLATE utf8mb4_unicode_ci name,DATE_FORMAT(b.starts_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,'confirmed' state FROM estate_visit_bookings b JOIN properties p ON p.id=b.property_id LEFT JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=b.buyer_id LEFT JOIN property_visit_requests vr ON vr.id=b.legacy_visit_id WHERE p.advertiser_id=? AND b.seller_id=? AND b.state='confirmed' AND b.starts_at>=UTC_TIMESTAMP() UNION ALL SELECT v.id,i.id inquiry_id,NULL booking_id,p.title,i.name,DATE_FORMAT(v.requested_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at,'confirmed' state FROM property_visit_requests v JOIN property_inquiries i ON i.id=v.inquiry_id JOIN properties p ON p.id=i.property_id WHERE p.advertiser_id=? AND v.status='confirmed' AND v.requested_at>=UTC_TIMESTAMP() AND NOT EXISTS(SELECT 1 FROM estate_visit_bookings b WHERE b.legacy_visit_id=v.id)) visits ORDER BY scheduled_at,id LIMIT 51 OFFSET ?`,
        [company.id, actor.id, company.id, offset],
      );
    } else {
      const where =
        kind === 'new_leads'
          ? `${stage}='new'`
          : kind === 'negotiation'
            ? `${stage}='negotiation'`
            : `${stage}<>'closed'`;
      const task = kind === 'pending_tasks' || kind === 'overdue';
      const bindings: unknown[] = [actor.id, company.id];
      let filter = '';
      if (kind === 'unassigned' || agentId === 'unassigned') {
        filter = `AND NOT(COALESCE(${active},0))`;
        bindings.push(actor.id);
      } else if (agentId) {
        filter = `AND ${active} AND ia.user_id=?`;
        bindings.push(actor.id, agentId);
      }
      items = await this.db.query<Record<string, unknown>[]>(
        `SELECT ${task ? 't.id' : 'i.id'},i.id inquiry_id,p.title,i.name,${stage} stage,CASE WHEN ${active} THEN CONCAT(agent.firstName,' ',agent.lastName) ELSE 'Atención de la empresa' END responsible_name,${task ? "t.kind task_kind,t.note,DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%sZ') scheduled_at" : 'NULL scheduled_at'} ${base} ${task ? "JOIN estate_inquiry_tasks t ON t.inquiry_id=i.id AND t.status='pending'" : ''} WHERE p.advertiser_id=? AND ${where} ${kind === 'overdue' ? 'AND t.due_at<=UTC_TIMESTAMP(3)' : ''} ${filter} ORDER BY ${task ? 't.due_at' : 'i.created_at DESC'},${task ? 't.id' : 'i.id'} LIMIT 51 OFFSET ?`,
        [...bindings, offset],
      );
    }
    return {
      kind,
      items: items.slice(0, 50),
      page,
      has_more: items.length > 50,
    };
  }
}
