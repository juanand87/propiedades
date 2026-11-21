import { ConfigService } from '@nestjs/config';
import {
  mailConfiguration,
  publicSmtpIpv4,
  ReviewMailService,
} from './review-mail.service';
import { EstateService } from './estate.service';
import { assertConnectionAllowed } from '../config/project-isolation';
import * as nodemailer from 'nodemailer';
import { lookup } from 'node:dns/promises';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
const admin: any = { id: 'administrator', role: 'admin' };
const config = {
  enabled: true,
  host: 'smtp.example.com',
  port: 587,
  security: 'starttls',
  username: 'smtp-user',
  from_name: 'Proppix',
  from_email: 'avisos@example.com',
  recipients: ['admin@example.com'],
};
const env = new ConfigService({
  JWT_SECRET: 's'.repeat(40),
  FRONTEND_URL: 'https://proppix.example.com',
});

describe('SMTP configuration and review notifications', () => {
  let db: any, mail: ReviewMailService, sendMail: jest.Mock, close: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    db = { query: jest.fn(), transaction: async (fn: any) => fn(db) };
    mail = new ReviewMailService(db, env);
    sendMail = jest
      .fn()
      .mockResolvedValue({ accepted: ['admin@example.com'], rejected: [] });
    close = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail,
      close,
    });
    (lookup as jest.Mock).mockResolvedValue({ address: '1.1.1.1', family: 4 });
  });
  const stored = () => ({
    config_json: JSON.stringify(config),
    password_encrypted: mail.encrypt('smtp-secret'),
  });
  it('rejects non-admin access before querying secrets or SMTP', async () => {
    const vendor: any = { role: 'vendor' };
    await expect(mail.settings(vendor)).rejects.toThrow('administración');
    await expect(mail.save(vendor, config)).rejects.toThrow('administración');
    await expect(mail.test(vendor)).rejects.toThrow('administración');
    expect(db.query).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('encrypts with random nonces, detects tampering and uses the configured key', () => {
    const a = mail.encrypt('secret'),
      b = mail.encrypt('secret');
    expect(a).not.toEqual(b);
    expect(a).not.toContain('secret');
    expect(mail.decrypt(a)).toBe('secret');
    expect(() =>
      mail.decrypt(a.replace(/^./, a[0] === 'A' ? 'B' : 'A')),
    ).toThrow();
    const other = new ReviewMailService(
      db,
      new ConfigService({ JWT_SECRET: 't'.repeat(40) }),
    );
    expect(() => other.decrypt(a)).toThrow();
  });
  it('validates TLS, host and headers and normalizes recipient duplicates', () => {
    expect(
      mailConfiguration({
        ...config,
        recipients: ['ADMIN@example.com', 'admin@example.com'],
      }).recipients,
    ).toEqual(['admin@example.com']);
    for (const patch of [
      { host: 'https://smtp.example.com/path' },
      { from_name: 'Proppix\r\nBcc: other@test.com' },
      { from_email: 'a@test.com\nb@test.com' },
      { port: 465 },
      { port: 65536 },
      { recipients: ['invalid'] },
    ])
      expect(() => mailConfiguration({ ...config, ...patch })).toThrow();
  });
  it('rejects loopback, metadata, private and reserved SMTP addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.2',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
    ])
      expect(publicSmtpIpv4(ip)).toBe(false);
    expect(publicSmtpIpv4('1.1.1.1')).toBe(true);
  });
  it('never returns the SMTP password or encrypted value', async () => {
    const secret = stored();
    db.query
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([secret])
      .mockResolvedValueOnce([{ pending: 0, failed: 0 }])
      .mockResolvedValueOnce([]);
    const result = await mail.settings(admin);
    expect(result.password_configured).toBe(true);
    expect(JSON.stringify(result)).not.toContain('smtp-secret');
    expect(JSON.stringify(result)).not.toContain(secret.password_encrypted);
  });
  it('preserves a stored password when saving with an empty password', async () => {
    const secret = stored();
    db.query.mockImplementation((sql: string) => {
      if (sql.includes('information_schema')) return [{ n: 2 }];
      if (sql.includes('SELECT config_json')) return [secret];
      if (sql.includes('SUM(status')) return [{ pending: 0, failed: 0 }];
      return [];
    });
    await mail.save(admin, { ...config, password: '' });
    const save = db.query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO estate_mail_settings'),
    );
    expect(save[1][1]).toBe(secret.password_encrypted);
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('queues review notifications with the transaction and property revision', async () => {
    db.query
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([stored()])
      .mockResolvedValueOnce([{ revision: 7, title: 'Casa de prueba' }])
      .mockResolvedValueOnce({ affectedRows: 1 });
    await mail.enqueue(db, 'property-id');
    expect(db.query.mock.calls[3][1].slice(1)).toEqual([
      'property-id',
      7,
      'Casa de prueba',
      '["admin@example.com"]',
    ]);
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('does not enqueue when email is disabled or the migration is absent', async () => {
    db.query.mockResolvedValueOnce([{ n: 0 }]);
    await mail.enqueue(db, 'property-id');
    expect(db.query).toHaveBeenCalledTimes(1);
    db.query
      .mockReset()
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([{ config_json: { ...config, enabled: false } }]);
    await mail.enqueue(db, 'property-id');
    expect(db.query).toHaveBeenCalledTimes(2);
  });
  it('uses TLS and BCC, sends the review link and records acceptance', async () => {
    db.query
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([stored()])
      .mockResolvedValueOnce([
        {
          id: 'event-id',
          property_id: 'property-id',
          title: 'Casa de prueba',
          attempts: 0,
          recipients_json: '["admin@example.com"]',
        },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 });
    await mail.flush();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '1.1.1.1',
        servername: config.host,
        requireTLS: true,
        secure: false,
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        bcc: ['admin@example.com'],
        text: expect.stringContaining(
          'https://proppix.example.com/panel/propiedades/property-id/editar',
        ),
      }),
    );
    expect(db.query.mock.calls[4][0]).toContain("status='sent'");
    expect(close).toHaveBeenCalled();
    expect(() =>
      assertConnectionAllowed([{ host: '1.1.1.1', port: 587 }], {
        PROJECT_ID: 'propiedades',
      }),
    ).toThrow('deshabilitadas');
  });
  it('retries failures without exposing server responses or credentials', async () => {
    sendMail.mockRejectedValue({
      code: 'EAUTH',
      message: 'raw smtp-secret server response',
    });
    db.query
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([stored()])
      .mockResolvedValueOnce([
        {
          id: 'event-id',
          property_id: 'property-id',
          title: 'Casa',
          attempts: 0,
          recipients_json: ['admin@example.com'],
        },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 });
    await expect(mail.flush()).resolves.toBeUndefined();
    const update = db.query.mock.calls[4][1];
    expect(update[0]).toBe('pending');
    expect(update[2]).toBe('Autenticación SMTP rechazada.');
    expect(JSON.stringify(update)).not.toContain('smtp-secret');
  });
  it('a worker does not deliver an event claimed by another instance', async () => {
    db.query
      .mockResolvedValueOnce([{ n: 2 }])
      .mockResolvedValueOnce([stored()])
      .mockResolvedValueOnce([{ id: 'event-id' }])
      .mockResolvedValueOnce({ affectedRows: 0 });
    await mail.flush();
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('a SMTP failure in the test action is sanitized and rate limited', async () => {
    sendMail.mockRejectedValue({ code: 'EAUTH', message: 'smtp-secret' });
    db.query.mockImplementation((sql: string) =>
      sql.includes('information_schema') ? [{ n: 2 }] : [stored()],
    );
    await expect(mail.test(admin)).rejects.toThrow(
      'Autenticación SMTP rechazada',
    );
    await expect(mail.test(admin)).rejects.toThrow('30 segundos');
  });
  it('records the event only when the status enters pending_review', async () => {
    const enqueue = jest.fn();
    const estate = new EstateService(db, {} as any, undefined, undefined, env, {
      enqueue,
    } as any);
    db.query.mockResolvedValue({ affectedRows: 1 });
    const history = (estate as any).history.bind(estate);
    await history(db, 'id', 'actor', 'draft', 'pending_review', '');
    await history(db, 'id', 'actor', 'published', 'pending_review', '');
    await history(db, 'id', 'actor', 'pending_review', 'pending_review', '');
    await history(db, 'id', 'actor', 'pending_review', 'published', '');
    expect(enqueue).toHaveBeenCalledTimes(2);
  });
});
