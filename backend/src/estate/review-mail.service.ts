import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { lookup } from 'node:dns/promises';
import { allowSmtpDestination } from '../config/project-isolation';
import { Actor, admin } from './rules';

type MailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  security: 'tls' | 'starttls';
  username: string;
  from_email: string;
  from_name: string;
  recipients: string[];
};
type StoredConfig = {
  config_json: MailConfig | string;
  password_encrypted: string | null;
};
type MailEvent = {
  id: string;
  property_id: string;
  title: string;
  attempts: number;
  recipients_json: string[] | string;
};
const defaults: MailConfig = {
  enabled: false,
  host: '',
  port: 587,
  security: 'starttls',
  username: '',
  from_email: '',
  from_name: 'Proppix',
  recipients: [],
};
const parse = <T>(value: T | string): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : value;
const address = (v: unknown) => {
  if (
    typeof v !== 'string' ||
    v.length > 254 ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
      v,
    )
  )
    throw new BadRequestException('Correo inválido.');
  return v.toLowerCase();
};
export function mailConfiguration(input: unknown): MailConfig {
  if (!input || typeof input !== 'object')
    throw new BadRequestException('Configuración inválida.');
  const b = input as Record<string, unknown>;
  if (
    typeof b.enabled !== 'boolean' ||
    !['tls', 'starttls'].includes(String(b.security))
  )
    throw new BadRequestException('Selecciona la seguridad SMTP.');
  const host = typeof b.host === 'string' ? b.host.trim() : '';
  if (
    !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host) ||
    host.includes('..')
  )
    throw new BadRequestException(
      'Indica el servidor SMTP sin https:// ni rutas.',
    );
  const port = Number(b.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new BadRequestException('Puerto SMTP inválido.');
  if (
    (port === 465 && b.security !== 'tls') ||
    (port === 587 && b.security !== 'starttls')
  )
    throw new BadRequestException('Usa TLS con 465 y STARTTLS con 587.');
  const username = typeof b.username === 'string' ? b.username.trim() : '';
  const from_name = typeof b.from_name === 'string' ? b.from_name.trim() : '';
  if (
    !username ||
    username.length > 255 ||
    /[\r\n\0]/.test(username) ||
    !from_name ||
    from_name.length > 100 ||
    /[\r\n\0]/.test(from_name)
  )
    throw new BadRequestException('Usuario o nombre del remitente inválido.');
  if (!Array.isArray(b.recipients) || b.recipients.length > 20)
    throw new BadRequestException(
      'Indica hasta 20 correos de administradores.',
    );
  return {
    enabled: b.enabled,
    host,
    port,
    security: b.security as MailConfig['security'],
    username,
    from_email: address(b.from_email),
    from_name,
    recipients: [...new Set(b.recipients.map(address))],
  };
}

export function publicSmtpIpv4(ip: string) {
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)))) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && [18, 19].includes(b)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

@Injectable()
export class ReviewMailService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private testAt = 0;
  constructor(
    private readonly db: DataSource,
    private readonly env: ConfigService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flush().catch(() => undefined);
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async available(tx: Pick<EntityManager, 'query'> = this.db) {
    const [r] = await tx.query<{ n: number }[]>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('estate_mail_settings','estate_review_mail_outbox')",
    );
    return Number(r.n) === 2;
  }
  private async requireTables() {
    if (!(await this.available()))
      throw new ServiceUnavailableException(
        'Ejecuta CORREOS_SMTP.sql para configurar los correos.',
      );
  }
  private key() {
    const secret =
      this.env.get<string>('SMTP_SETTINGS_ENCRYPTION_KEY') ||
      this.env.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32)
      throw new ServiceUnavailableException(
        'Configura una clave segura SMTP_SETTINGS_ENCRYPTION_KEY en el backend.',
      );
    return createHash('sha256')
      .update('proppix:smtp:v1:' + secret)
      .digest();
  }
  encrypt(password: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([
      cipher.update(password, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString('base64'))
      .join('.');
  }
  decrypt(value: string) {
    const [iv, tag, data] = value
      .split('.')
      .map((v) => Buffer.from(v, 'base64'));
    const cipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString(
      'utf8',
    );
  }
  private async stored(
    tx: Pick<EntityManager, 'query'> = this.db,
  ): Promise<{ config: MailConfig; password: string | null }> {
    const [r] = await tx.query<StoredConfig[]>(
      'SELECT config_json,password_encrypted FROM estate_mail_settings WHERE id=1',
    );
    return {
      config: r ? parse<MailConfig>(r.config_json) : { ...defaults },
      password: r?.password_encrypted || null,
    };
  }
  async settings(actor: Actor) {
    admin(actor);
    await this.requireTables();
    const { config, password } = await this.stored();
    const [delivery] = await this.db.query<
      { pending: number; failed: number; last_sent_at: string | null }[]
    >(
      "SELECT COALESCE(SUM(status IN ('pending','processing')),0) pending,COALESCE(SUM(status='failed'),0) failed,MAX(sent_at) last_sent_at FROM estate_review_mail_outbox",
    );
    const [last] = await this.db.query<{ last_error: string | null }[]>(
      'SELECT last_error FROM estate_review_mail_outbox WHERE last_error IS NOT NULL ORDER BY created_at DESC LIMIT 1',
    );
    return {
      ...config,
      password_configured: !!password,
      delivery,
      last_error: last?.last_error || null,
    };
  }
  async save(actor: Actor, input: unknown) {
    admin(actor);
    await this.requireTables();
    const config = mailConfiguration(input),
      b = input as Record<string, unknown>;
    if (
      b.password !== undefined &&
      (typeof b.password !== 'string' ||
        b.password.length > 4096 ||
        /[\r\n\0]/.test(b.password))
    )
      throw new BadRequestException('Contraseña SMTP inválida.');
    const newPassword = typeof b.password === 'string' ? b.password : '';
    await this.db.transaction(async (tx) => {
      // Serialize saves; an empty password always preserves the stored secret.
      await tx.query(
        'SELECT id FROM estate_mail_settings WHERE id=1 FOR UPDATE',
      );
      const old = await this.stored(tx);
      const password = newPassword ? this.encrypt(newPassword) : old.password;
      if (!password)
        throw new BadRequestException('Ingresa la contraseña SMTP.');
      await tx.query(
        'INSERT INTO estate_mail_settings(id,config_json,password_encrypted,updated_by) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json),password_encrypted=VALUES(password_encrypted),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(3)',
        [JSON.stringify(config), password, actor.id],
      );
    });
    return this.settings(actor);
  }
  private async recipients(
    config: MailConfig,
    tx: Pick<EntityManager, 'query'> = this.db,
  ) {
    if (config.recipients.length) return config.recipients;
    const users = await tx.query<{ email: string }[]>(
      "SELECT email FROM users WHERE role='admin' AND isActive=1 ORDER BY id LIMIT 20",
    );
    return [
      ...new Set<string>(users.map((u: { email: string }) => address(u.email))),
    ];
  }
  async enqueue(tx: EntityManager, propertyId: string) {
    if (!(await this.available(tx))) return;
    const { config } = await this.stored(tx);
    if (!config.enabled) return;
    const recipients = await this.recipients(config, tx);
    const [p] = await tx.query<{ title: string; revision: number }[]>(
      'SELECT title,revision FROM properties WHERE id=?',
      [propertyId],
    );
    await tx.query(
      'INSERT IGNORE INTO estate_review_mail_outbox(id,property_id,property_revision,title,recipients_json) VALUES (?,?,?,?,?)',
      [
        randomUUID(),
        propertyId,
        p.revision,
        p.title,
        JSON.stringify(recipients),
      ],
    );
  }
  private reviewUrl(id: string) {
    const base =
      this.env.get<string>('FRONTEND_URL') ||
      'https://propiedades-eta.vercel.app';
    const url = new URL(
      '/panel/propiedades/' + encodeURIComponent(id) + '/editar',
      base,
    );
    if (!['https:', 'http:'].includes(url.protocol))
      throw new Error('CONFIGURATION');
    return url.toString();
  }
  private async deliver(
    config: MailConfig,
    encrypted: string | null,
    recipients: string[],
    subject: string,
    text: string,
    messageId: string,
  ) {
    if (!encrypted || !recipients.length)
      throw new Error('MAIL_NOT_CONFIGURED');
    const password = this.decrypt(encrypted);
    const resolved = await lookup(config.host, { family: 4 });
    if (!publicSmtpIpv4(resolved.address)) throw new Error('SMTP_PRIVATE_HOST');
    const releaseDestination = allowSmtpDestination(
      resolved.address,
      config.port,
    );
    let transport:
      | nodemailer.Transporter<SMTPTransport.SentMessageInfo>
      | undefined;
    try {
      transport = nodemailer.createTransport({
        host: resolved.address,
        servername: config.host,
        port: config.port,
        secure: config.security === 'tls',
        requireTLS: config.security === 'starttls',
        auth: { user: config.username, pass: password },
        tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
        dnsTimeout: 10000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      // BCC keeps administrator addresses private from one another.
      const result = await transport.sendMail({
        from: { name: config.from_name, address: config.from_email },
        bcc: recipients,
        subject,
        text,
        messageId,
      });
      if (result.rejected?.length || !result.accepted?.length)
        throw new Error('RECIPIENT_REJECTED');
    } finally {
      transport?.close();
      releaseDestination();
    }
  }
  private safeError(e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'EAUTH') return 'Autenticación SMTP rechazada.';
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNECTION' ||
      code === 'ESOCKET' ||
      code === 'EDNS'
    )
      return 'No se pudo conectar al servidor SMTP con TLS.';
    return 'No se pudo enviar el correo. Revisa SMTP y destinatarios.';
  }
  async test(actor: Actor) {
    admin(actor);
    await this.requireTables();
    if (Date.now() - this.testAt < 30000)
      throw new BadRequestException(
        'Espera 30 segundos antes de repetir la prueba.',
      );
    this.testAt = Date.now();
    const { config, password } = await this.stored();
    try {
      await this.deliver(
        config,
        password,
        await this.recipients(config),
        'Proppix · Prueba de correo',
        'La configuración SMTP de Proppix funciona. Recibirás aquí los avisos de propiedades enviadas a revisión.',
        `<test-${randomUUID()}@proppix.local>`,
      );
    } catch (e) {
      throw new ServiceUnavailableException(this.safeError(e));
    }
    return {
      success: true,
      message:
        'El servidor SMTP aceptó el correo de prueba. Revisa la bandeja de entrada y spam.',
    };
  }
  async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.available())) return;
      const { config, password } = await this.stored();
      if (!config.enabled) return;
      const rows = await this.db.query<MailEvent[]>(
        "SELECT * FROM estate_review_mail_outbox WHERE status IN ('pending','processing') AND due_at<=UTC_TIMESTAMP(3) ORDER BY created_at LIMIT 5",
      );
      for (const row of rows) {
        const lease = randomUUID();
        const claimed = await this.db.query<{ affectedRows: number }>(
          "UPDATE estate_review_mail_outbox SET status='processing',lease_id=?,due_at=TIMESTAMPADD(MINUTE,10,UTC_TIMESTAMP(3)),attempts=attempts+1 WHERE id=? AND status IN ('pending','processing') AND due_at<=UTC_TIMESTAMP(3)",
          [lease, row.id],
        );
        if (!claimed.affectedRows) continue;
        try {
          await this.deliver(
            config,
            password,
            parse<string[]>(row.recipients_json),
            'Proppix · Propiedad pendiente de revisión',
            `Una propiedad fue enviada a revisión.\n\n${row.title}\n\nRevisar en el panel:\n${this.reviewUrl(row.property_id)}\n\nIngresa con una cuenta de administrador para aprobarla o rechazarla.`,
            `<review-${row.id}@proppix.local>`,
          );
          await this.db.query(
            "UPDATE estate_review_mail_outbox SET status='sent',sent_at=UTC_TIMESTAMP(3),lease_id=NULL,last_error=NULL WHERE id=? AND lease_id=?",
            [row.id, lease],
          );
        } catch (e) {
          const attempts = Number(row.attempts) + 1;
          await this.db.query(
            'UPDATE estate_review_mail_outbox SET status=?,due_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP(3)),lease_id=NULL,last_error=? WHERE id=? AND lease_id=?',
            [
              attempts >= 8 ? 'failed' : 'pending',
              Math.min(3600, 30 * 2 ** attempts),
              this.safeError(e),
              row.id,
              lease,
            ],
          );
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
