import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Actor, email, uuid } from './rules';
import { EstateService } from './estate.service';
import { ReviewMailService } from './review-mail.service';
import {
  invitationToken,
  invitedEmail,
  proposalChanges,
} from './company-team.rules';
type DB = Pick<EntityManager, 'query'>;
type Team = {
  id: string;
  name: string;
  owner_user_id: string;
  advertiser_id: string;
};
type Access = {
  owner_user_id: string;
  can_edit: number;
  revision: number;
  publication_status: string;
};
@Injectable()
export class CompanyTeamService {
  constructor(
    private db: DataSource,
    private estate: EstateService,
    private mail: ReviewMailService,
    private config: ConfigService,
  ) {}
  async available() {
    const [r] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_company_teams','estate_company_members','estate_company_property_assignments','estate_company_invitations','estate_company_assignment_access','estate_company_property_proposals')",
    );
    return Number(r.n) === 6;
  }
  private async ready() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'La sección Mi equipo está pendiente de activar.',
      );
  }
  private async owner(actor: Actor, tx: DB = this.db, lock = false) {
    const [team] = await tx.query<Team[]>(
      `SELECT t.*,a.id advertiser_id FROM estate_company_teams t JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND u.isActive=1 JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' WHERE t.owner_user_id=? ${lock ? 'FOR UPDATE' : ''}`,
      [actor.id],
    );
    if (!team)
      throw new ForbiddenException(
        'Solo la empresa propietaria y aprobada puede administrar este equipo.',
      );
    return team;
  }
  private async eligible(actor: Actor, tx: DB = this.db) {
    const [r] = await tx.query<{ display_name: string }[]>(
      "SELECT a.display_name FROM estate_profile_identity pi JOIN advertisers a ON a.user_id=pi.user_id AND a.status='approved' WHERE pi.user_id=? AND pi.profile_kind='company'",
      [actor.id],
    );
    return r;
  }
  async overview(actor: Actor) {
    await this.ready();
    const eligibility = await this.eligible(actor);
    let team: Team | null = null;
    if (eligibility) {
      try {
        team = await this.owner(actor);
      } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
      }
    }
    const memberships = await this.db.query<{ id: string; name: string }[]>(
      "SELECT t.id,t.name FROM estate_company_members m JOIN estate_company_teams t ON t.id=m.team_id JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND owner.isActive=1 JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' WHERE m.user_id=? AND m.status='active' AND t.owner_user_id<>?",
      [actor.id, actor.id],
    );
    if (!team)
      return {
        eligible: !!eligibility,
        company_name: eligibility?.display_name || '',
        team: null,
        memberships,
      };
    const [members, invitations, properties, assignments, proposals] =
      await Promise.all([
        this.db.query<Record<string, unknown>[]>(
          'SELECT m.user_id,m.role,m.status,u.firstName,u.lastName,u.email FROM estate_company_members m JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=m.user_id WHERE m.team_id=? ORDER BY m.created_at',
          [team.id],
        ),
        this.db.query<Record<string, unknown>[]>(
          "SELECT id,email,status,expires_at FROM estate_company_invitations WHERE team_id=? AND status='pending' AND expires_at>UTC_TIMESTAMP(3) ORDER BY created_at DESC",
          [team.id],
        ),
        this.db.query<Record<string, unknown>[]>(
          "SELECT id,title,publication_status,revision FROM properties WHERE advertiser_id=? AND publication_status<>'archived' ORDER BY created_at DESC LIMIT 500",
          [team.advertiser_id],
        ),
        this.db.query<Record<string, unknown>[]>(
          'SELECT pa.*,COALESCE(ac.can_edit,0) can_edit FROM estate_company_property_assignments pa LEFT JOIN estate_company_assignment_access ac ON ac.team_id=pa.team_id AND ac.user_id=pa.user_id AND ac.property_id=pa.property_id WHERE pa.team_id=?',
          [team.id],
        ),
        this.db.query<Record<string, unknown>[]>(
          'SELECT pr.*,p.title,u.firstName FROM estate_company_property_proposals pr JOIN properties p ON p.id=pr.property_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=pr.user_id WHERE pr.team_id=? ORDER BY pr.created_at DESC LIMIT 100',
          [team.id],
        ),
      ]);
    return {
      eligible: true,
      team,
      memberships,
      members,
      invitations,
      properties,
      assignments,
      proposals,
    };
  }
  async create(actor: Actor) {
    await this.ready();
    return this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      const eligible = await this.eligible(actor, tx);
      if (!eligible)
        throw new ForbiddenException(
          'Necesitas un perfil Empresa con anunciante aprobado.',
        );
      const [exists] = await tx.query<{ id: string }[]>(
        'SELECT id FROM estate_company_teams WHERE owner_user_id=?',
        [actor.id],
      );
      if (exists) return exists;
      const id = randomUUID();
      await tx.query(
        'INSERT INTO estate_company_teams(id,owner_user_id,name) VALUES (?,?,?)',
        [id, actor.id, eligible.display_name],
      );
      await tx.query(
        "INSERT INTO estate_company_members(team_id,user_id,role,status) VALUES (?,?,'owner','active')",
        [id, actor.id],
      );
      return { id };
    });
  }
  async invite(actor: Actor, address: unknown) {
    await this.ready();
    const recipient = email(address);
    if (recipient === actor.email.toLowerCase())
      throw new BadRequestException('Tu cuenta ya administra la empresa.');
    const token = randomBytes(32).toString('hex'),
      id = randomUUID();
    const team = await this.db.transaction(async (tx) => {
      const t = await this.owner(actor, tx, true);
      const [rate] = await tx.query<{ n: number }[]>(
        'SELECT COUNT(*) n FROM estate_company_invitations WHERE team_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE)',
        [t.id],
      );
      if (Number(rate.n) >= 10)
        throw new BadRequestException(
          'Espera un minuto para enviar más invitaciones.',
        );
      await tx.query(
        "UPDATE estate_company_invitations SET status='revoked' WHERE team_id=? AND email=? AND status='pending'",
        [t.id, recipient],
      );
      await tx.query(
        'INSERT INTO estate_company_invitations(id,team_id,email,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY))',
        [id, t.id, recipient, createHash('sha256').update(token).digest('hex')],
      );
      return t;
    });
    const base =
      this.config.get<string>('FRONTEND_URL') ||
      'https://propiedades-eta.vercel.app';
    const url = new URL('/invitaciones/equipo', base);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new ServiceUnavailableException(
        'Configura la dirección pública de Proppix.',
      );
    url.hash = 'token=' + token;
    let mail_sent = false;
    try {
      await this.mail.sendCompanyInvitation(
        recipient,
        url.toString(),
        team.name,
        id,
      );
      mail_sent = true;
    } catch {
      /* The owner can share the same email-bound invitation manually. */
    }
    return {
      id,
      mail_sent,
      invitation_url: url.toString(),
      message: mail_sent
        ? 'Invitación enviada por correo.'
        : 'Invitación creada. El correo no pudo enviarse; puedes copiar el enlace y revisar SMTP.',
    };
  }
  async cancelInvite(actor: Actor, id: string) {
    const team = await this.owner(actor);
    await this.db.query(
      "UPDATE estate_company_invitations SET status='revoked' WHERE id=? AND team_id=? AND status='pending'",
      [uuid(id), team.id],
    );
    return { success: true };
  }
  async accept(actor: Actor, raw: unknown) {
    await this.ready();
    const hash = createHash('sha256')
      .update(invitationToken(raw))
      .digest('hex');
    return this.db.transaction(async (tx) => {
      const [inv] = await tx.query<
        { id: string; team_id: string; email: string; owner_user_id: string }[]
      >(
        "SELECT i.id,i.team_id,i.email,t.owner_user_id FROM estate_company_invitations i JOIN estate_company_teams t ON t.id=i.team_id JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND u.isActive=1 WHERE i.token_hash=? AND i.status='pending' AND i.expires_at>UTC_TIMESTAMP(3) FOR UPDATE",
        [hash],
      );
      if (!inv)
        throw new BadRequestException(
          'La invitación venció, fue revocada o ya se utilizó.',
        );
      invitedEmail(actor.email, inv.email);
      if (inv.owner_user_id === actor.id)
        throw new BadRequestException('Ya administras este equipo.');
      await tx.query(
        "INSERT INTO estate_company_members(team_id,user_id,role,status) VALUES (?,?,'agent','active') ON DUPLICATE KEY UPDATE status='active',role='agent'",
        [inv.team_id, actor.id],
      );
      await tx.query(
        "UPDATE estate_company_invitations SET status='accepted',accepted_by=? WHERE id=?",
        [actor.id, inv.id],
      );
      return { success: true };
    });
  }
  async revoke(actor: Actor, userId: string) {
    return this.db.transaction(async (tx) => {
      const team = await this.owner(actor, tx, true);
      userId = uuid(userId);
      if (userId === actor.id)
        throw new BadRequestException('No puedes retirar al propietario.');
      await tx.query(
        "UPDATE estate_company_members SET status='revoked' WHERE team_id=? AND user_id=? AND role<>'owner'",
        [team.id, userId],
      );
      await tx.query(
        'DELETE FROM estate_company_property_assignments WHERE team_id=? AND user_id=?',
        [team.id, userId],
      );
      const [leads] = await tx.query<{ n: number }[]>(
        "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_inquiry_assignments','estate_inquiry_events')",
      );
      if (Number(leads?.n) === 2) {
        await tx.query(
          "INSERT INTO estate_inquiry_events(id,inquiry_id,actor_id,action,previous_value,next_value) SELECT UUID(),inquiry_id,?,'assignment',user_id,NULL FROM estate_inquiry_assignments WHERE team_id=? AND user_id=?",
          [actor.id, team.id, userId],
        );
        await tx.query(
          'DELETE FROM estate_inquiry_assignments WHERE team_id=? AND user_id=?',
          [team.id, userId],
        );
      }
      await tx.query(
        "UPDATE estate_company_property_proposals SET status='rejected',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(3) WHERE team_id=? AND user_id=? AND status='pending'",
        [actor.id, team.id, userId],
      );
      return { success: true };
    });
  }
  async assign(
    actor: Actor,
    body: {
      user_id?: unknown;
      property_id?: unknown;
      can_edit?: unknown;
      remove?: unknown;
    },
  ) {
    const user = uuid(body.user_id),
      property = uuid(body.property_id);
    if (typeof body.can_edit !== 'boolean' && body.remove !== true)
      throw new BadRequestException('Selecciona el permiso de edición.');
    return this.db.transaction(async (tx) => {
      const team = await this.owner(actor, tx, true);
      const [member] = await tx.query<{ user_id: string }[]>(
        "SELECT user_id FROM estate_company_members WHERE team_id=? AND user_id=? AND status='active' AND role='agent' FOR UPDATE",
        [team.id, user],
      );
      const [owned] = await tx.query<{ id: string }[]>(
        'SELECT id FROM properties WHERE id=? AND advertiser_id=? FOR UPDATE',
        [property, team.advertiser_id],
      );
      if (!member || !owned)
        throw new ForbiddenException(
          'Solo puedes asignar tus propiedades a agentes activos de tu equipo.',
        );
      if (body.remove === true) {
        await tx.query(
          'DELETE FROM estate_company_property_assignments WHERE team_id=? AND user_id=? AND property_id=?',
          [team.id, user, property],
        );
      } else {
        await tx.query(
          'INSERT IGNORE INTO estate_company_property_assignments(team_id,user_id,property_id) VALUES (?,?,?)',
          [team.id, user, property],
        );
        await tx.query(
          'INSERT INTO estate_company_assignment_access(team_id,user_id,property_id,can_edit) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE can_edit=VALUES(can_edit)',
          [team.id, user, property, body.can_edit ? 1 : 0],
        );
      }
      return { success: true };
    });
  }
  private async access(
    actor: Actor,
    team: string,
    property: string,
    tx: DB = this.db,
    lock = false,
  ) {
    const [r] = await tx.query<Access[]>(
      `SELECT t.owner_user_id,COALESCE(ac.can_edit,0) can_edit,p.revision,p.publication_status FROM estate_company_property_assignments pa JOIN estate_company_members m ON m.team_id=pa.team_id AND m.user_id=pa.user_id AND m.status='active' JOIN estate_company_teams t ON t.id=pa.team_id JOIN users owner ON CONVERT(owner.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=t.owner_user_id AND owner.isActive=1 JOIN estate_profile_identity pi ON pi.user_id=t.owner_user_id AND pi.profile_kind='company' JOIN advertisers a ON a.user_id=t.owner_user_id AND a.status='approved' JOIN properties p ON p.id=pa.property_id AND p.advertiser_id=a.id LEFT JOIN estate_company_assignment_access ac ON ac.team_id=pa.team_id AND ac.user_id=pa.user_id AND ac.property_id=pa.property_id WHERE pa.team_id=? AND pa.property_id=? AND pa.user_id=? ${lock ? 'FOR UPDATE' : ''}`,
      [uuid(team), uuid(property), actor.id],
    );
    if (!r)
      throw new ForbiddenException(
        'Esta propiedad no está asignada a tu cuenta o el acceso fue retirado.',
      );
    return r;
  }
  async assigned(actor: Actor, team: string) {
    const rows = await this.db.query<{ property_id: string }[]>(
      'SELECT property_id FROM estate_company_property_assignments WHERE team_id=? AND user_id=? LIMIT 500',
      [uuid(team), actor.id],
    );
    const items: unknown[] = [];
    for (const r of rows) {
      try {
        const access = await this.access(actor, team, r.property_id);
        const owner = await this.estate.actor(access.owner_user_id);
        const p = (await this.estate.get(r.property_id, owner)) as Record<
          string,
          unknown
        >;
        items.push({ ...p, team_can_edit: !!Number(access.can_edit) });
      } catch (e) {
        if (
          !(e instanceof ForbiddenException) &&
          !(e instanceof NotFoundException)
        )
          throw e;
      }
    }
    return { items };
  }
  async propose(
    actor: Actor,
    team: string,
    property: string,
    body: { revision?: unknown; changes?: unknown },
  ) {
    const changes = proposalChanges(body.changes);
    return this.db.transaction(async (tx) => {
      const access = await this.access(actor, team, property, tx, true);
      if (!Number(access.can_edit))
        throw new ForbiddenException('Tu permiso es solo de lectura.');
      if (
        !Number.isSafeInteger(body.revision) ||
        Number(body.revision) !== Number(access.revision)
      )
        throw new ConflictException(
          'La propiedad cambió. Recarga sus datos antes de proponer cambios.',
        );
      const [pending] = await tx.query<{ n: number }[]>(
        "SELECT COUNT(*) n FROM estate_company_property_proposals WHERE team_id=? AND property_id=? AND user_id=? AND status='pending'",
        [team, property, actor.id],
      );
      if (Number(pending.n) >= 5)
        throw new BadRequestException(
          'Espera la revisión de tus cambios pendientes.',
        );
      const id = randomUUID();
      await tx.query(
        'INSERT INTO estate_company_property_proposals(id,team_id,user_id,property_id,base_revision,changes_json) VALUES (?,?,?,?,?,?)',
        [
          id,
          team,
          actor.id,
          property,
          access.revision,
          JSON.stringify(changes),
        ],
      );
      return { id };
    });
  }
  async review(actor: Actor, id: string, accept: unknown) {
    if (typeof accept !== 'boolean')
      throw new BadRequestException('Indica si apruebas los cambios.');
    return this.db.transaction(async (tx) => {
      const team = await this.owner(actor, tx, true);
      const [p] = await tx.query<
        {
          id: string;
          property_id: string;
          user_id: string;
          base_revision: number;
          changes_json: string | Record<string, unknown>;
        }[]
      >(
        "SELECT * FROM estate_company_property_proposals WHERE id=? AND team_id=? AND status='pending' FOR UPDATE",
        [uuid(id), team.id],
      );
      if (!p) throw new NotFoundException('Propuesta no disponible.');
      if (accept) {
        const [member] = await tx.query<{ user_id: string }[]>(
          "SELECT m.user_id FROM estate_company_members m JOIN estate_company_property_assignments pa ON pa.team_id=m.team_id AND pa.user_id=m.user_id JOIN estate_company_assignment_access ac ON ac.team_id=pa.team_id AND ac.user_id=pa.user_id AND ac.property_id=pa.property_id AND ac.can_edit=1 WHERE m.team_id=? AND m.user_id=? AND m.status='active' AND pa.property_id=? FOR UPDATE",
          [team.id, p.user_id, p.property_id],
        );
        if (!member)
          throw new ForbiddenException(
            'El agente ya no tiene permiso para esta propiedad.',
          );
        const [owned] = await tx.query<{ advertiser_id: string }[]>(
          'SELECT advertiser_id FROM properties WHERE id=?',
          [p.property_id],
        );
        if (owned?.advertiser_id !== team.advertiser_id)
          throw new ForbiddenException();
        const changes = proposalChanges(
          typeof p.changes_json === 'string'
            ? JSON.parse(p.changes_json)
            : p.changes_json,
        );
        await this.estate.saveProperty(
          actor,
          { ...changes, revision: p.base_revision },
          p.property_id,
          tx,
        );
      }
      await tx.query(
        'UPDATE estate_company_property_proposals SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(3) WHERE id=?',
        [accept ? 'applied' : 'rejected', actor.id, p.id],
      );
      return { success: true };
    });
  }
}
