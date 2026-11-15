import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Actor, admin, text, uuid } from './rules';
import { ModerationService } from './moderation.service';
import { MessagingService } from './messaging.service';
import { notBlocked } from './moderation-rules';
import { DEMO_ADVERTISER_ID } from './demo-properties';
import {
  nextVisitState,
  santiagoParts,
  sqlVisitTime,
  validateVisitWindow,
  visitInstant,
  visitLabels,
  VisitState,
} from './visit-rules';
type Booking = {
  id: string;
  legacy_visit_id: string;
  property_id: string;
  property_title: string;
  buyer_id: string;
  seller_id: string;
  conversation_id: string;
  state: VisitState;
  version: number;
  starts_at: string;
  proposer_id: string;
  note: string;
  request_hash: string;
  [key: string]: unknown;
};
type PropertyRow = {
  id: string;
  title: string;
  seller_id: string;
  advertiser_id: string;
  publication_status: string;
  availability: string;
  advertiser_status: string;
  isActive: number;
};
export type VisitInput = {
  property_id?: unknown;
  request_id?: unknown;
  date?: unknown;
  time?: unknown;
  note?: unknown;
  consent?: unknown;
};
@Injectable()
export class VisitsService {
  constructor(
    private db: DataSource,
    private moderation: ModerationService,
    private messaging: MessagingService,
  ) {}
  async available() {
    const [r] = await this.db.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_visit_bookings','estate_visit_events','estate_visit_message_links','estate_visit_notices','estate_visit_push')",
    );
    return Number(r.n) === 5;
  }
  private async guard() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'La agenda está pendiente de configurar.',
      );
  }
  private async property(
    id: string,
    db: Pick<DataSource, 'query'> | EntityManager = this.db,
  ) {
    const [p] = await db.query<PropertyRow[]>(
      'SELECT p.id,p.title,p.advertiser_id,a.user_id seller_id,p.publication_status,p.availability,a.status advertiser_status,u.isActive FROM properties p JOIN advertisers a ON a.id=p.advertiser_id JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=a.user_id WHERE p.id=?',
      [uuid(id)],
    );
    if (!p) throw new NotFoundException('Propiedad no disponible.');
    return p;
  }
  private assertProperty(p: PropertyRow) {
    if (
      p.advertiser_id === DEMO_ADVERTISER_ID ||
      p.publication_status !== 'published' ||
      p.availability !== 'available' ||
      p.advertiser_status !== 'approved' ||
      !Number(p.isActive)
    )
      throw new BadRequestException(
        'Esta propiedad no admite visitas en este momento.',
      );
  }
  private async lockPeople(tx: EntityManager, buyer: string, seller: string) {
    for (const id of [buyer, seller].sort())
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [id]);
  }
  private async conflict(
    tx: EntityManager,
    buyer: string,
    seller: string,
    time: string,
    exclude = '',
  ) {
    const [row] = await tx.query<{ id: string }[]>(
      "SELECT id FROM estate_visit_bookings WHERE state='confirmed' AND id<>? AND (buyer_id IN (?,?) OR seller_id IN (?,?)) AND starts_at<TIMESTAMPADD(MINUTE,30,?) AND TIMESTAMPADD(MINUTE,30,starts_at)>? LIMIT 1",
      [exclude, buyer, seller, buyer, seller, time, time],
    );
    if (row)
      throw new ConflictException(
        'Ese horario coincide con otra visita confirmada. Elige otro horario.',
      );
  }
  private async notice(
    tx: EntityManager,
    b: Booking,
    recipient: string,
    kind: string,
    title: string,
    due: string,
  ) {
    await tx.query(
      'INSERT IGNORE INTO estate_visit_notices(id,booking_id,version,user_id,kind,title,due_at) VALUES (?,?,?,?,?,?,?)',
      [randomUUID(), b.id, b.version, recipient, kind, title, due],
    );
  }
  private async record(tx: EntityManager, b: Booking, actor: Actor) {
    await tx.query(
      'UPDATE estate_visit_notices SET expanded=1 WHERE booking_id=? AND version<?',
      [b.id, b.version],
    );
    await tx.query(
      "UPDATE estate_visit_push d JOIN estate_visit_notices n ON n.id=d.notice_id SET d.status='done' WHERE n.booking_id=? AND n.version<? AND d.status='pending'",
      [b.id, b.version],
    );
    const eventId = randomUUID();
    await tx.query(
      'INSERT INTO estate_visit_events(id,booking_id,actor_id,state,version,starts_at,note) VALUES (?,?,?,?,?,?,?)',
      [eventId, b.id, actor.id, b.state, b.version, b.starts_at, b.note],
    );
    const parts = santiagoParts(new Date(b.starts_at.replace(' ', 'T') + 'Z'));
    const message = `${visitLabels[b.state]} · ${b.property_title} · ${parts.date} ${parts.time} (Santiago). Abre Mis visitas para ver los detalles.`;
    await tx.query(
      'SELECT id FROM estate_conversations WHERE id=? FOR UPDATE',
      [b.conversation_id],
    );
    await tx.query(
      'INSERT INTO estate_direct_messages(conversation_id,sender_id,client_id,body,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))',
      [b.conversation_id, actor.id, eventId, message],
    );
    const [stored] = await tx.query<{ id: string }[]>(
      'SELECT CAST(id AS CHAR) id FROM estate_direct_messages WHERE sender_id=? AND client_id=?',
      [actor.id, eventId],
    );
    await tx.query(
      'INSERT INTO estate_visit_message_links(message_id,booking_id,event_id) VALUES (?,?,?)',
      [stored.id, b.id, eventId],
    );
    await tx.query(
      'UPDATE estate_conversations SET last_message_id=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
      [stored.id, b.conversation_id],
    );
    const recipient = actor.id === b.buyer_id ? b.seller_id : b.buyer_id;
    await this.notice(
      tx,
      b,
      recipient,
      'event',
      visitLabels[b.state],
      sqlVisitTime(new Date()),
    );
    if (actor.id !== b.buyer_id && actor.id !== b.seller_id)
      await this.notice(
        tx,
        b,
        b.seller_id,
        'event',
        visitLabels[b.state],
        sqlVisitTime(new Date()),
      );
    if (b.state === 'confirmed')
      for (const [kind, hours] of [
        ['reminder24', 24],
        ['reminder1', 1],
      ] as const) {
        const due =
          new Date(b.starts_at.replace(' ', 'T') + 'Z').getTime() -
          hours * 3600000;
        if (due > Date.now())
          for (const recipient of [b.buyer_id, b.seller_id])
            await this.notice(
              tx,
              b,
              recipient,
              kind,
              'Recordatorio de visita',
              sqlVisitTime(new Date(due)),
            );
      }
  }
  async create(actor: Actor, input: VisitInput) {
    await this.guard();
    const propertyId = uuid(input.property_id),
      requestId = uuid(input.request_id),
      instant = visitInstant(input.date, input.time);
    if (input.consent !== true)
      throw new BadRequestException(
        'Autoriza compartir tu nombre y correo con el anunciante para coordinar la visita.',
      );
    const note = text(input.note, 1000),
      hash = createHash('sha256')
        .update(JSON.stringify([propertyId, instant.toISOString(), note]))
        .digest('hex');
    const [receipt] = await this.db.query<
      { id: string; request_hash: string }[]
    >(
      'SELECT id,request_hash FROM estate_visit_bookings WHERE buyer_id=? AND request_id=?',
      [actor.id, requestId],
    );
    if (receipt) {
      if (receipt.request_hash !== hash)
        throw new ConflictException(
          'Esta solicitud ya se utilizó con otros datos.',
        );
      return this.get(actor, receipt.id);
    }
    validateVisitWindow(instant);
    const p = await this.property(propertyId);
    this.assertProperty(p);
    if (p.seller_id === actor.id)
      throw new BadRequestException(
        'No puedes solicitar una visita a tu propia propiedad.',
      );
    await this.moderation.assertContact(actor.id, p.seller_id);
    const conversation = await this.messaging.create(actor, {
      recipient_id: p.seller_id,
    });
    const id = await this.db.transaction(async (tx) => {
      await this.lockPeople(tx, actor.id, p.seller_id);
      const current = await this.property(propertyId, tx);
      this.assertProperty(current);
      if (current.seller_id !== p.seller_id)
        throw new ConflictException(
          'El anunciante cambió. Vuelve a abrir la propiedad.',
        );
      await this.moderation.assertContact(actor.id, p.seller_id, tx);
      const [retry] = await tx.query<{ id: string; request_hash: string }[]>(
        'SELECT id,request_hash FROM estate_visit_bookings WHERE buyer_id=? AND request_id=?',
        [actor.id, requestId],
      );
      if (retry) {
        if (retry.request_hash !== hash)
          throw new ConflictException(
            'Esta solicitud ya se utilizó con otros datos.',
          );
        return retry.id;
      }
      const [active] = await tx.query<{ id: string }[]>(
        "SELECT id FROM estate_visit_bookings WHERE buyer_id=? AND property_id=? AND state IN ('requested','proposed','confirmed') LIMIT 1",
        [actor.id, propertyId],
      );
      if (active)
        throw new ConflictException(
          'Ya tienes una visita pendiente o confirmada para esta propiedad. Revisa Mis visitas.',
        );
      const [rate] = await tx.query<{ n: number }[]>(
        'SELECT COUNT(*) n FROM estate_visit_bookings WHERE buyer_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 DAY',
        [actor.id],
      );
      if (Number(rate.n) >= 20)
        throw new BadRequestException(
          'Alcanzaste el límite diario de solicitudes de visita.',
        );
      const time = sqlVisitTime(instant);
      await this.conflict(tx, actor.id, p.seller_id, time);
      const inquiryId = randomUUID(),
        legacyId = randomUUID(),
        id = randomUUID();
      const [user] = await tx.query<
        {
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
        }[]
      >('SELECT firstName,lastName,email,phone FROM users WHERE id=?', [
        actor.id,
      ]);
      await tx.query(
        'INSERT INTO property_inquiries(id,property_id,user_id,name,email,phone,message,consent_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())',
        [
          inquiryId,
          propertyId,
          actor.id,
          `${user.firstName} ${user.lastName}`.slice(0, 120),
          user.email,
          user.phone,
          note || 'Solicitud de visita desde Proppix.',
        ],
      );
      await tx.query(
        'INSERT INTO property_visit_requests(id,inquiry_id,requested_at) VALUES (?,?,?)',
        [legacyId, inquiryId, time],
      );
      const booking: Booking = {
        id,
        legacy_visit_id: legacyId,
        property_id: propertyId,
        property_title: p.title,
        buyer_id: actor.id,
        seller_id: p.seller_id,
        conversation_id: conversation.id,
        request_hash: hash,
        state: 'requested',
        version: 1,
        starts_at: time,
        proposer_id: actor.id,
        note,
      };
      await tx.query(
        'INSERT INTO estate_visit_bookings(id,legacy_visit_id,property_id,property_title,buyer_id,seller_id,conversation_id,request_id,request_hash,starts_at,proposer_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          id,
          legacyId,
          propertyId,
          p.title,
          actor.id,
          p.seller_id,
          conversation.id,
          requestId,
          hash,
          time,
          actor.id,
          note,
        ],
      );
      await this.record(tx, booking, actor);
      return id;
    });
    return this.get(actor, id);
  }
  private select = `SELECT b.*,DATE_FORMAT(b.starts_at,'%Y-%m-%dT%H:%i:%s.000Z') starts_at,COALESCE(bp.display_name,buyer.firstName) buyer_name,COALESCE(sp.display_name,seller.firstName) seller_name,
 (p.publication_status='published' AND p.availability='available' AND a.status='approved' AND seller.isActive=1) property_available,(${notBlocked('b.buyer_id', 'b.seller_id')}) contact_allowed,buyer.isActive buyer_active,seller.isActive seller_active
 FROM estate_visit_bookings b JOIN properties p ON p.id=b.property_id JOIN advertisers a ON a.id=p.advertiser_id JOIN users buyer ON CONVERT(buyer.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=b.buyer_id JOIN users seller ON CONVERT(seller.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=b.seller_id LEFT JOIN estate_video_profiles bp ON bp.user_id=b.buyer_id LEFT JOIN estate_video_profiles sp ON sp.user_id=b.seller_id`;
  private item(b: Booking, actor: Actor) {
    const actions: string[] = [];
    for (const action of [
      'accept',
      'propose',
      'reject',
      'cancel',
      'complete',
    ]) {
      try {
        nextVisitState(
          b.state,
          action,
          actor.id,
          b.buyer_id,
          b.seller_id,
          b.proposer_id,
          actor.role === 'admin',
        );
        if (
          ['accept', 'propose', 'reject'].includes(action) &&
          (!Number(b.contact_allowed) ||
            !Number(b.property_available) ||
            !Number(b.buyer_active) ||
            !Number(b.seller_active))
        )
          continue;
        if (action === 'complete' && Date.parse(b.starts_at) > Date.now())
          continue;
        actions.push(action);
      } catch {
        /* Unavailable action. */
      }
    }
    return {
      id: b.id,
      property_id: b.property_id,
      property_title: b.property_title,
      buyer_id: b.buyer_id,
      seller_id: b.seller_id,
      buyer_name: b.buyer_name,
      seller_name: b.seller_name,
      conversation_id: b.conversation_id,
      state: b.state,
      version: Number(b.version),
      starts_at: b.starts_at,
      proposer_id: b.proposer_id,
      note: b.note,
      created_at: b.created_at,
      updated_at: b.updated_at,
      property_available: !!Number(b.property_available),
      contact_allowed: !!Number(b.contact_allowed),
      allowed_actions: actions,
      duration_minutes: 30,
      time_zone: 'America/Santiago',
    };
  }
  async list(
    actor: Actor,
    query: { page?: string; conversation_id?: string },
    all = false,
  ) {
    await this.guard();
    if (all) admin(actor);
    const page = Math.max(
      1,
      Math.min(10000, parseInt(query.page || '1', 10) || 1),
    );
    const condition =
      (all ? '1=1' : '(b.buyer_id=? OR b.seller_id=?)') +
      (query.conversation_id ? ' AND b.conversation_id=?' : '');
    const params = [
      ...(all ? [] : [actor.id, actor.id]),
      ...(query.conversation_id ? [uuid(query.conversation_id)] : []),
    ];
    const rows = await this.db.query<Booking[]>(
      this.select +
        ' WHERE ' +
        condition +
        ' ORDER BY b.updated_at DESC,b.id LIMIT 21 OFFSET ?',
      [...params, (page - 1) * 20],
    );
    return {
      items: rows.slice(0, 20).map((b) => this.item(b, actor)),
      has_more: rows.length > 20,
      page,
    };
  }
  async act(
    actor: Actor,
    id: string,
    input: {
      action?: unknown;
      version?: unknown;
      date?: unknown;
      time?: unknown;
      note?: unknown;
    },
  ) {
    await this.guard();
    const snapshot = await this.get(actor, id);
    if (!Number.isInteger(input.version) || Number(input.version) < 1)
      throw new BadRequestException(
        'Vuelve a cargar la visita antes de responder.',
      );
    await this.db.transaction(async (tx) => {
      await this.lockPeople(tx, snapshot.buyer_id, snapshot.seller_id);
      const [row] = await tx.query<Booking[]>(
        "SELECT b.*,DATE_FORMAT(b.starts_at,'%Y-%m-%d %H:%i:%s') starts_at FROM estate_visit_bookings b WHERE b.id=? FOR UPDATE",
        [id],
      );
      if (!row) throw new NotFoundException('Visita no disponible.');
      if (Number(row.version) !== input.version)
        throw new ConflictException(
          'La visita cambió. Actualiza para ver el último horario.',
        );
      const state = nextVisitState(
        row.state,
        input.action,
        actor.id,
        row.buyer_id,
        row.seller_id,
        row.proposer_id,
        actor.role === 'admin',
      );
      if (['accept', 'propose', 'reject'].includes(String(input.action))) {
        await this.moderation.assertContact(row.buyer_id, row.seller_id, tx);
        this.assertProperty(await this.property(row.property_id, tx));
        const users = await tx.query<{ isActive: number }[]>(
          'SELECT isActive FROM users WHERE id IN (?,?)',
          [row.buyer_id, row.seller_id],
        );
        if (users.some((u) => !Number(u.isActive)))
          throw new BadRequestException(
            'Una de las cuentas ya no está disponible.',
          );
      }
      let time = row.starts_at,
        proposer = row.proposer_id;
      if (input.action === 'propose') {
        const [rate] = await tx.query<{ n: number }[]>(
          'SELECT COUNT(*) n FROM estate_visit_events WHERE actor_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL 10 MINUTE',
          [actor.id],
        );
        if (Number(rate.n) >= 20)
          throw new BadRequestException(
            'Espera antes de proponer más cambios de horario.',
          );
        const date = visitInstant(input.date, input.time);
        validateVisitWindow(date);
        time = sqlVisitTime(date);
        proposer = actor.id;
        await this.conflict(tx, row.buyer_id, row.seller_id, time, row.id);
      }
      if (state === 'confirmed') {
        if (Date.parse(time.replace(' ', 'T') + 'Z') < Date.now() + 5 * 60000)
          throw new BadRequestException(
            'Ese horario ya pasó o está demasiado cerca. Propón otro.',
          );
        await this.conflict(tx, row.buyer_id, row.seller_id, time, row.id);
      }
      if (
        state === 'completed' &&
        Date.parse(time.replace(' ', 'T') + 'Z') > Date.now()
      )
        throw new BadRequestException('La visita todavía no ha comenzado.');
      const note = text(input.note, 1000),
        version = Number(row.version) + 1;
      const updated = {
        ...row,
        state,
        starts_at: time,
        proposer_id: proposer,
        note,
        version,
      };
      await tx.query(
        'UPDATE estate_visit_bookings SET state=?,version=?,starts_at=?,proposer_id=?,note=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
        [state, version, time, proposer, note, id],
      );
      const legacy = ['requested', 'proposed'].includes(state)
        ? 'requested'
        : state === 'rejected'
          ? 'cancelled'
          : state;
      await tx.query(
        'UPDATE property_visit_requests SET status=?,requested_at=?,note=? WHERE id=?',
        [legacy, time, note || null, row.legacy_visit_id],
      );
      await tx.query(
        'UPDATE property_inquiries i JOIN property_visit_requests v ON v.inquiry_id=i.id SET i.status=? WHERE v.id=?',
        [
          ['cancelled', 'rejected', 'completed'].includes(state)
            ? 'closed'
            : 'contacted',
          row.legacy_visit_id,
        ],
      );
      await this.record(tx, updated, actor);
    });
    return this.get(actor, id);
  }
  async get(actor: Actor, id: string) {
    await this.guard();
    const [b] = await this.db.query<Booking[]>(
      this.select +
        " WHERE b.id=? AND (b.buyer_id=? OR b.seller_id=? OR ?='admin')",
      [uuid(id), actor.id, actor.id, actor.role],
    );
    if (!b) throw new NotFoundException('Visita no disponible.');
    const events = await this.db.query<Record<string, unknown>[]>(
      "SELECT e.id,e.state,e.version,e.note,DATE_FORMAT(e.starts_at,'%Y-%m-%dT%H:%i:%s.000Z') starts_at,DATE_FORMAT(e.created_at,'%Y-%m-%dT%H:%i:%s.000Z') created_at,u.firstName actor_name FROM estate_visit_events e JOIN users u ON CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci=e.actor_id WHERE e.booking_id=? ORDER BY e.version",
      [id],
    );
    return { ...this.item(b, actor), events };
  }
}
