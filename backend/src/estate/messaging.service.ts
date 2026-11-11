import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { Actor, uuid } from './rules';
import { EstateService } from './estate.service';
import { DEMO_ADVERTISER_ID } from './demo-properties';
import { PushService } from './push.service';

export type NewConversation = { recipient_id?: unknown; property_id?: unknown };
export type NewMessage = { client_id?: unknown; body?: unknown };
export type HistoryQuery = { after?: unknown; before?: unknown };
type ConversationRow = {
  id: string;
  user_low_id: string;
  user_high_id: string;
  last_message_id: string;
};
type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_id: string;
  body: string;
  created_at: Date;
};
type PersonRow = {
  id: string;
  isActive: number;
  display_name: string;
  avatar_media_id: string | null;
};
type CountRow = { n: string | number };
type InboxRow = {
  id: string;
  last_message_id: string;
  updated_at: Date;
  last_message: string;
  sender_id: string;
  participant_id: string;
  unread: string | number;
};

function cursor(value: unknown) {
  if (value != null && typeof value !== 'string' && typeof value !== 'number')
    throw new BadRequestException('Página inválida.');
  if (typeof value === 'number' && !Number.isSafeInteger(value))
    throw new BadRequestException('Página inválida.');
  const result = String(value ?? '0');
  if (!/^\d{1,20}$/.test(result) || BigInt(result) > 18446744073709551615n)
    throw new BadRequestException('Página inválida.');
  return result;
}

@Injectable()
export class MessagingService {
  constructor(
    private db: DataSource,
    private estate: EstateService,
    private push: PushService,
  ) {}

  async capabilities() {
    const [row] = await this.db.query<CountRow[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_conversations','estate_direct_messages','estate_video_profiles')",
    );
    return {
      enabled: Number(row.n) === 3,
      push_tables_ready: await this.push.available(),
      push: await this.push.health(),
    };
  }

  private async ensureAvailable() {
    if (!(await this.capabilities()).enabled)
      throw new ServiceUnavailableException(
        'Los mensajes están temporalmente fuera de servicio. Intenta más tarde.',
      );
  }

  private async conversation(
    actor: Actor,
    id: string,
    db: Pick<DataSource, 'query'> | EntityManager = this.db,
    lock = false,
  ) {
    const [row] = await db.query<ConversationRow[]>(
      `SELECT *,CAST(last_message_id AS CHAR) last_message_id FROM estate_conversations WHERE id=? AND (user_low_id=? OR user_high_id=?)${lock ? ' FOR UPDATE' : ''}`,
      [uuid(id), actor.id, actor.id],
    );
    if (!row) throw new NotFoundException('Conversación no encontrada.');
    return row;
  }

  private async person(id: string) {
    const [row] = await this.db.query<PersonRow[]>(
      "SELECT u.id,u.isActive,COALESCE(p.display_name,u.firstName,'Usuario Proppix') display_name,p.avatar_media_id FROM users u LEFT JOIN estate_video_profiles p ON p.user_id=CONVERT(u.id USING utf8mb4) COLLATE utf8mb4_unicode_ci WHERE u.id=?",
      [id],
    );
    if (!row) throw new NotFoundException('Usuario no encontrado.');
    return {
      id: row.id,
      display_name: row.isActive ? row.display_name : 'Cuenta no disponible',
      available: Boolean(row.isActive),
      avatar_url:
        row.isActive && row.avatar_media_id
          ? this.estate.mediaUrl(row.avatar_media_id, { id: row.id } as Actor)
          : null,
    };
  }

  async create(actor: Actor, body: NewConversation) {
    await this.ensureAvailable();
    let recipient: string;
    if (body?.property_id) {
      const [property] = await this.db.query<{ user_id: string }[]>(
        "SELECT a.user_id FROM properties p JOIN advertisers a ON a.id=p.advertiser_id WHERE p.id=? AND p.publication_status='published' AND a.status='approved' AND a.id<>?",
        [uuid(body.property_id), DEMO_ADVERTISER_ID],
      );
      if (!property)
        throw new NotFoundException('La propiedad no está disponible.');
      recipient = property.user_id;
    } else recipient = uuid(body?.recipient_id);
    if (recipient.toLowerCase() === actor.id.toLowerCase())
      throw new BadRequestException('Elige otro usuario para conversar.');
    const person = await this.person(recipient);
    if (!person.available)
      throw new BadRequestException('Esta cuenta no puede recibir mensajes.');
    const [low, high] = [
      actor.id.toLowerCase(),
      recipient.toLowerCase(),
    ].sort();
    await this.db.query(
      'INSERT INTO estate_conversations(id,user_low_id,user_high_id,created_at,updated_at) VALUES (?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE id=id',
      [randomUUID(), low, high],
    );
    const [row] = await this.db.query<{ id: string }[]>(
      'SELECT id FROM estate_conversations WHERE user_low_id=? AND user_high_id=?',
      [low, high],
    );
    return { id: row.id, participant: person };
  }

  async inbox(actor: Actor, rawPage: unknown) {
    await this.ensureAvailable();
    const page = Math.max(1, Math.min(10000, Number(cursor(rawPage))));
    const rows = await this.db.query<InboxRow[]>(
      `SELECT c.id,CAST(c.last_message_id AS CHAR) last_message_id,c.updated_at,m.body last_message,m.sender_id,
      IF(c.user_low_id=?,c.user_high_id,c.user_low_id) participant_id,
      (SELECT COUNT(*) FROM estate_direct_messages unread WHERE unread.conversation_id=c.id AND unread.sender_id<>? AND unread.id>IF(c.user_low_id=?,c.low_read_id,c.high_read_id)) unread
      FROM estate_conversations c JOIN estate_direct_messages m ON m.id=c.last_message_id
      WHERE c.user_low_id=? OR c.user_high_id=? ORDER BY c.updated_at DESC,c.id LIMIT 25 OFFSET ?`,
      [actor.id, actor.id, actor.id, actor.id, actor.id, (page - 1) * 24],
    );
    return {
      items: await Promise.all(
        rows.slice(0, 24).map(async (row) => ({
          id: row.id,
          last_message_id: String(row.last_message_id),
          last_message: row.last_message,
          from_me: row.sender_id.toLowerCase() === actor.id.toLowerCase(),
          updated_at: row.updated_at,
          unread: Number(row.unread),
          participant: await this.person(row.participant_id),
        })),
      ),
      has_more: rows.length > 24,
      page,
    };
  }

  async history(actor: Actor, id: string, query: HistoryQuery) {
    await this.ensureAvailable();
    const conversation = await this.conversation(actor, id);
    const after = query.after === undefined ? null : cursor(query.after);
    const before = query.before === undefined ? null : cursor(query.before);
    if (after !== null && before !== null)
      throw new BadRequestException('Elige una sola dirección de lectura.');
    const params: unknown[] = [id];
    let condition = '';
    if (after !== null) {
      condition = ' AND id>?';
      params.push(after);
    }
    if (before !== null) {
      condition = ' AND id<?';
      params.push(before);
    }
    const rows = await this.db.query<MessageRow[]>(
      `SELECT CAST(id AS CHAR) id,conversation_id,sender_id,client_id,body,created_at FROM estate_direct_messages WHERE conversation_id=?${condition} ORDER BY estate_direct_messages.id ${after !== null ? 'ASC' : 'DESC'} LIMIT 51`,
      params,
    );
    const items = rows.slice(0, 50);
    if (after === null) items.reverse();
    return {
      id: conversation.id,
      participant: await this.person(
        conversation.user_low_id === actor.id.toLowerCase()
          ? conversation.user_high_id
          : conversation.user_low_id,
      ),
      items,
      has_more: rows.length > 50,
      last_message_id: String(conversation.last_message_id),
    };
  }

  async send(actor: Actor, id: string, body: NewMessage) {
    await this.ensureAvailable();
    const clientId = uuid(body?.client_id);
    const message = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!message || message.length > 4000)
      throw new BadRequestException(
        'Escribe un mensaje de hasta 4000 caracteres.',
      );
    return this.db.transaction(async (tx) => {
      // Serialize sends from an account so retries and the rate limit stay consistent.
      await tx.query('SELECT id FROM users WHERE id=? FOR UPDATE', [actor.id]);
      const conversation = await this.conversation(actor, id, tx, true);
      const [existing] = await tx.query<MessageRow[]>(
        'SELECT CAST(id AS CHAR) id,conversation_id,sender_id,client_id,body,created_at FROM estate_direct_messages WHERE sender_id=? AND client_id=?',
        [actor.id, clientId],
      );
      if (existing) {
        if (
          existing.conversation_id.toLowerCase() !== id.toLowerCase() ||
          existing.body !== message
        )
          throw new ConflictException(
            'Este envío ya se utilizó para otro mensaje.',
          );
        return existing;
      }
      const recipient =
        conversation.user_low_id === actor.id.toLowerCase()
          ? conversation.user_high_id
          : conversation.user_low_id;
      const [person] = await tx.query<{ isActive: number }[]>(
        'SELECT isActive FROM users WHERE id=?',
        [recipient],
      );
      if (!person?.isActive)
        throw new ForbiddenException('Esta cuenta no puede recibir mensajes.');
      const [rate] = await tx.query<CountRow[]>(
        'SELECT COUNT(*) n FROM estate_direct_messages WHERE sender_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 MINUTE',
        [actor.id],
      );
      if (Number(rate.n) >= 30)
        throw new HttpException(
          'Espera un momento antes de enviar más mensajes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      await tx.query(
        'INSERT INTO estate_direct_messages(conversation_id,sender_id,client_id,body,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(3))',
        [id, actor.id, clientId, message],
      );
      const [created] = await tx.query<MessageRow[]>(
        'SELECT CAST(id AS CHAR) id,conversation_id,sender_id,client_id,body,created_at FROM estate_direct_messages WHERE sender_id=? AND client_id=?',
        [actor.id, clientId],
      );
      await tx.query(
        'UPDATE estate_conversations SET last_message_id=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
        [created.id, id],
      );
      await this.push.enqueue(tx, created.id, recipient);
      return created;
    });
  }

  async markRead(actor: Actor, id: string, rawCursor: unknown) {
    await this.ensureAvailable();
    const lastRead = cursor(rawCursor);
    const conversation = await this.conversation(actor, id);
    if (BigInt(lastRead) > BigInt(conversation.last_message_id))
      throw new BadRequestException('Mensaje fuera de la conversación.');
    if (lastRead !== '0') {
      const [message] = await this.db.query<{ id: string }[]>(
        'SELECT id FROM estate_direct_messages WHERE id=? AND conversation_id=?',
        [lastRead, id],
      );
      if (!message)
        throw new BadRequestException('Mensaje fuera de la conversación.');
    }
    const column =
      conversation.user_low_id === actor.id.toLowerCase()
        ? 'low_read_id'
        : 'high_read_id';
    await this.db.query(
      `UPDATE estate_conversations SET ${column}=GREATEST(${column},?) WHERE id=?`,
      [lastRead, id],
    );
    return { success: true };
  }
}
