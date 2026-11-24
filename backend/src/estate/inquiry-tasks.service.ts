import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Actor, choice, isAdmin, uuid } from './rules';
import { InquiryWorkflowService } from './inquiry-workflow.service';
import { taskDeadline, taskKinds } from './inquiry-task.rules';
import { sqlVisitTime } from './visit-rules';
const joins = `FROM estate_inquiry_tasks t JOIN property_inquiries i ON i.id=t.inquiry_id JOIN properties p ON p.id=i.property_id JOIN advertisers a ON a.id=p.advertiser_id
 JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id AND owner.isActive=1
 LEFT JOIN estate_inquiry_assignments ia ON ia.inquiry_id=i.id
 LEFT JOIN estate_company_members m ON m.team_id=ia.team_id AND m.user_id=ia.user_id AND m.status='active'
 LEFT JOIN estate_company_teams team ON team.id=ia.team_id AND team.owner_user_id=a.user_id
 LEFT JOIN estate_profile_identity pi ON pi.user_id=a.user_id
 LEFT JOIN users agent ON CONVERT(agent.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=ia.user_id AND agent.isActive=1`;
const assigned = `m.user_id IS NOT NULL AND team.id IS NOT NULL AND pi.profile_kind='company' AND a.status='approved' AND agent.id IS NOT NULL`;
const recipient = `CASE WHEN ${assigned} THEN ia.user_id ELSE a.user_id END`;
const scope = `CAST(COALESCE((SELECT MAX(n.id) FROM estate_inquiry_notices n WHERE n.inquiry_id=i.id),0) AS CHAR)`;
const visible = `(?=1 OR a.user_id=? OR (ia.user_id=? AND ${assigned}))`;
const due = `t.status='pending' AND t.due_at<=UTC_TIMESTAMP(3) AND t.due_at>UTC_TIMESTAMP(3)-INTERVAL 1 DAY AND i.status<>'closed'`;
type Task = {
  id: string;
  inquiry_id: string;
  kind: string;
  note: string;
  due_at: string | Date;
  status: string;
  revision: number;
  created_by: string;
};
@Injectable()
export class InquiryTasksService {
  constructor(
    private db: DataSource,
    private leads: InquiryWorkflowService,
  ) {}
  async available() {
    const [r] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_tasks','estate_inquiry_task_events','estate_inquiry_task_push')",
    );
    return Number(r.n) === 3;
  }
  private async ready() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'Las próximas acciones están pendientes de activar.',
      );
  }
  private input(body: {
    kind?: unknown;
    note?: unknown;
    date?: unknown;
    time?: unknown;
  }) {
    if (
      body.note !== undefined &&
      (typeof body.note !== 'string' || body.note.length > 1000)
    )
      throw new BadRequestException('La nota admite hasta 1.000 caracteres.');
    return {
      kind: choice(body.kind, taskKinds),
      note: typeof body.note === 'string' ? body.note.trim() : '',
      due_at: sqlVisitTime(taskDeadline(body.date, body.time)),
    };
  }
  private async record(
    tx: EntityManager,
    actor: Actor,
    task: Task,
    action: string,
  ) {
    await tx.query(
      'INSERT INTO estate_inquiry_task_events(id,task_id,actor_id,action,snapshot_json) VALUES (?,?,?,?,?)',
      [
        randomUUID(),
        task.id,
        actor.id,
        action,
        JSON.stringify({
          kind: task.kind,
          note: task.note,
          due_at:
            task.due_at instanceof Date
              ? task.due_at.toISOString()
              : String(task.due_at).replace(' ', 'T') +
                (String(task.due_at).endsWith('Z') ? '' : 'Z'),
          status: task.status,
        }),
      ],
    );
  }
  async create(
    actor: Actor,
    inquiryId: string,
    body: {
      id?: unknown;
      kind?: unknown;
      note?: unknown;
      date?: unknown;
      time?: unknown;
    },
  ) {
    await this.ready();
    const id = uuid(body.id);
    return this.db.transaction(async (tx) => {
      const lead = await this.leads.authorize(actor, inquiryId, tx, true);
      const [old] = await tx.query<Task[]>(
        'SELECT * FROM estate_inquiry_tasks WHERE id=?',
        [id],
      );
      if (old) {
        if (old.inquiry_id !== inquiryId || old.created_by !== actor.id)
          throw new ConflictException('Identificador de tarea no disponible.');
        return { id };
      }
      if (lead.status === 'closed')
        throw new BadRequestException(
          'Reabre el interesado antes de programar una acción.',
        );
      const input = this.input(body);
      const [count] = await tx.query<{ n: number }[]>(
        "SELECT COUNT(*) n FROM estate_inquiry_tasks WHERE inquiry_id=? AND status='pending'",
        [inquiryId],
      );
      if (Number(count.n) >= 20)
        throw new BadRequestException(
          'Completa o cancela algunas de las 20 acciones pendientes de este interesado.',
        );
      await tx.query(
        'INSERT INTO estate_inquiry_tasks(id,inquiry_id,kind,note,due_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?)',
        [
          id,
          inquiryId,
          input.kind,
          input.note,
          input.due_at,
          actor.id,
          actor.id,
        ],
      );
      await this.record(
        tx,
        actor,
        {
          ...input,
          id,
          inquiry_id: inquiryId,
          status: 'pending',
          revision: 1,
          created_by: actor.id,
        },
        'created',
      );
      return { id };
    });
  }
  async update(
    actor: Actor,
    id: string,
    body: {
      revision?: unknown;
      action?: unknown;
      kind?: unknown;
      note?: unknown;
      date?: unknown;
      time?: unknown;
    },
  ) {
    await this.ready();
    id = uuid(id);
    const action = choice(body.action, ['complete', 'cancel', 'reschedule']);
    return this.db.transaction(async (tx) => {
      const [initial] = await tx.query<{ inquiry_id: string }[]>(
        'SELECT inquiry_id FROM estate_inquiry_tasks WHERE id=?',
        [id],
      );
      if (!initial) throw new NotFoundException('Tarea no disponible.');
      const lead = await this.leads.authorize(
        actor,
        initial.inquiry_id,
        tx,
        true,
      );
      const [row] = await tx.query<Task[]>(
        "SELECT t.*,DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%sZ') due_at FROM estate_inquiry_tasks t WHERE id=? FOR UPDATE",
        [id],
      );
      if (
        !Number.isSafeInteger(body.revision) ||
        body.revision !== Number(row.revision)
      )
        throw new ConflictException(
          'La tarea cambió. Recarga antes de modificarla.',
        );
      if (row.status !== 'pending')
        throw new BadRequestException(
          'La tarea ya fue completada o cancelada.',
        );
      let next = { ...row };
      if (action === 'reschedule') {
        if (lead.status === 'closed')
          throw new BadRequestException('El interesado está cerrado.');
        next = { ...next, ...this.input(body) };
        await tx.query(
          'UPDATE estate_inquiry_tasks SET kind=?,note=?,due_at=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
          [next.kind, next.note, next.due_at, actor.id, id],
        );
      } else {
        next.status = action === 'complete' ? 'completed' : 'cancelled';
        await tx.query(
          "UPDATE estate_inquiry_tasks SET status=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3),completed_at=IF(?='completed',UTC_TIMESTAMP(3),NULL) WHERE id=?",
          [next.status, actor.id, next.status, id],
        );
      }
      await this.record(
        tx,
        actor,
        next,
        action === 'reschedule' ? 'rescheduled' : next.status,
      );
      return { success: true };
    });
  }
  async list(
    actor: Actor,
    q: { inquiryId?: unknown; status?: unknown; due?: unknown } = {},
  ) {
    await this.ready();
    const status = choice(
        q.status,
        ['pending', 'completed', 'cancelled', 'all'],
        'pending',
      ),
      filter = choice(q.due, ['all', 'overdue', 'upcoming'], 'all');
    const id = q.inquiryId ? uuid(q.inquiryId) : null;
    if (id) await this.leads.authorize(actor, id);
    const params = [
      isAdmin(actor) ? 1 : 0,
      actor.id,
      actor.id,
      ...(id ? [id] : []),
    ];
    const where = `${visible} ${id ? 'AND t.inquiry_id=?' : ''}`;
    const [summary] = await this.db.query<Record<string, unknown>[]>(
      `SELECT COALESCE(SUM(t.status='pending'),0) pending,COALESCE(SUM(t.status='pending' AND t.due_at<=UTC_TIMESTAMP(3)),0) overdue,COALESCE(SUM(t.status='completed'),0) completed ${joins} WHERE ${where}`,
      params,
    );
    const items = await this.db.query<Record<string, unknown>[]>(
      `SELECT t.id,t.inquiry_id,t.kind,t.note,t.status,t.revision,DATE_FORMAT(t.due_at,'%Y-%m-%dT%H:%i:%sZ') due_at,(t.status='pending' AND t.due_at<=UTC_TIMESTAMP(3)) overdue,i.name,p.title,a.display_name company_name,CASE WHEN ${assigned} THEN CONCAT(agent.firstName,' ',agent.lastName) ELSE CONCAT(owner.firstName,' ',owner.lastName) END responsible_name ${joins} WHERE ${where} ${status === 'all' ? '' : 'AND t.status=?'} ${filter === 'all' ? '' : filter === 'overdue' ? "AND t.status='pending' AND t.due_at<=UTC_TIMESTAMP(3)" : "AND t.status='pending' AND t.due_at>UTC_TIMESTAMP(3)"} ORDER BY (t.status='pending') DESC,t.due_at,t.id LIMIT 201`,
      [...params, ...(status === 'all' ? [] : [status])],
    );
    return {
      items: items.slice(0, 200).map((t) => ({
        ...t,
        revision: Number(t.revision),
        overdue: !!Number(t.overdue),
      })),
      summary: Object.fromEntries(
        Object.entries(summary).map(([k, v]) => [k, Number(v)]),
      ),
      truncated: items.length > 200,
    };
  }
  async history(actor: Actor, id: string) {
    await this.ready();
    const [row] = await this.db.query<{ inquiry_id: string }[]>(
      'SELECT inquiry_id FROM estate_inquiry_tasks WHERE id=?',
      [uuid(id)],
    );
    if (!row) throw new NotFoundException('Tarea no disponible.');
    await this.leads.authorize(actor, row.inquiry_id);
    return this.db.query<Record<string, unknown>[]>(
      "SELECT e.id,e.action,e.snapshot_json,DATE_FORMAT(e.created_at,'%Y-%m-%dT%H:%i:%sZ') created_at,u.firstName actor_name FROM estate_inquiry_task_events e LEFT JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=e.actor_id WHERE e.task_id=? ORDER BY e.created_at,e.id",
      [id],
    );
  }
  async flush(
    deliver: (
      token: string,
      key: string,
      inquiryId: string,
      taskId: string,
    ) => Promise<'sent' | 'invalid' | 'unregistered'>,
  ) {
    if (!(await this.available())) return;
    await this.db.query(
      `INSERT IGNORE INTO estate_inquiry_task_push(task_id,task_revision,scope_key,user_id,token) SELECT t.id,t.revision,${scope},${recipient},d.token ${joins} JOIN estate_push_devices d ON d.user_id=${recipient} AND d.updated_at>UTC_TIMESTAMP()-INTERVAL 90 DAY WHERE ${due} AND NOT EXISTS(SELECT 1 FROM estate_inquiry_task_push existing WHERE existing.task_id=t.id AND existing.task_revision=t.revision AND existing.scope_key=${scope} AND existing.user_id=${recipient} AND existing.token=d.token) ORDER BY t.due_at LIMIT 100`,
    );
    const rows = await this.db.query<
      {
        id: string;
        task_id: string;
        task_revision: number;
        scope_key: string;
        user_id: string;
        token: string;
        attempts: number;
      }[]
    >(
      "SELECT CAST(id AS CHAR) id,task_id,task_revision,scope_key,user_id,token,attempts FROM estate_inquiry_task_push WHERE status='pending' AND due_at<=UTC_TIMESTAMP(3) ORDER BY due_at,id LIMIT 25",
    );
    for (const row of rows) {
      const update = (status: string) =>
        this.db.query(
          'UPDATE estate_inquiry_task_push SET status=? WHERE id=?',
          [status, row.id],
        );
      const [event] = await this.db.query<{ inquiry_id: string }[]>(
        `SELECT t.inquiry_id ${joins} JOIN estate_push_devices d ON d.user_id=${recipient} AND d.token=? WHERE t.id=? AND t.revision=? AND ${recipient}=? AND ${scope}=? AND ${due}`,
        [row.token, row.task_id, row.task_revision, row.user_id, row.scope_key],
      );
      if (!event || !/^[A-Za-z0-9_:-]{20,255}$/.test(row.token)) {
        await update('done');
        continue;
      }
      if (row.attempts >= 12) {
        await update('failed');
        continue;
      }
      await this.db.query(
        'UPDATE estate_inquiry_task_push SET attempts=attempts+1,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)) WHERE id=?',
        [Math.min(3600, 30 * 2 ** row.attempts), row.id],
      );
      try {
        const result = await deliver(
          row.token,
          row.id,
          event.inquiry_id,
          row.task_id,
        );
        if (result === 'unregistered')
          await this.db.query(
            'DELETE FROM estate_push_devices WHERE token=? AND user_id=?',
            [row.token, row.user_id],
          );
        await update(result === 'invalid' ? 'failed' : 'done');
      } catch {
        /* Persisted retry. */
      }
    }
  }
}
