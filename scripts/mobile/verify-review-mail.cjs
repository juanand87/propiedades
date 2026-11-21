// SMTP integration tests: isolated local DB only; never sends a real email.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const mysql = require(root + '/backend/node_modules/mysql2/promise');
const base = 'http://127.0.0.1:3328/api';
let checks = 0;
async function call(route, { token, body, method = 'GET', status = 200 } = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.equal(response.status, status, route + ': ' + JSON.stringify(result).slice(0, 100)); checks++;
  return result;
}
async function main() {
  const db = await mysql.createConnection({ host: '127.0.0.1', port: 3327, user: 'root', database: 'propiedades', multipleStatements: true });
  let property, original, oldSettings;
  try {
    const [[instance]] = await db.query('SELECT @@datadir d,@@port p');
    assert.equal(Number(instance.p), 3327);
    assert.equal(path.resolve(instance.d).toLowerCase(), path.join(root, 'tmp/mobile-local/mysql-data').toLowerCase());
    assert.equal((await call('/mobile/environment')).environment, 'local-mobile');
    const migration = await fs.readFile(root + '/database/CORREOS_SMTP.sql', 'utf8');
    await db.query(migration); await db.query(migration); checks++;
    [oldSettings] = await db.query('SELECT * FROM estate_mail_settings WHERE id=1');
    await call('/admin/mail', { status: 401 });
    await call('/admin/mail', { method: 'PATCH', body: {}, status: 401 });
    await call('/admin/mail/test', { method: 'POST', body: {}, status: 401 });
    const credentials = JSON.parse(await fs.readFile(root + '/tmp/mobile-local/credentials.json', 'utf8'));
    const admin = await call('/auth/login', { method: 'POST', body: credentials, status: 201 });
    const token = admin.access_token;
    const customer = await call('/auth/register', { method: 'POST', body: { email: 'qa-smtp-' + crypto.randomUUID() + '@qa.invalid', password: crypto.randomBytes(24).toString('base64url'), firstName: 'SMTP', lastName: 'QA' }, status: 201 });
    await call('/admin/mail', { token: customer.access_token, status: 403 });
    await call('/admin/mail', { token: customer.access_token, method: 'PATCH', body: {}, status: 403 });
    await call('/admin/mail/test', { token: customer.access_token, method: 'POST', body: {}, status: 403 });
    // .invalid is reserved: worker attempts cannot reach any SMTP provider.
    const config = { enabled: true, host: 'smtp.proppix-qa.invalid', port: 587, security: 'starttls', username: 'qa-smtp-user', password: 'qa-only-smtp-secret', from_name: 'QA Proppix', from_email: 'sender@qa.invalid', recipients: ['admin@qa.invalid'] };
    const saved = await call('/admin/mail', { token, method: 'PATCH', body: config });
    assert.equal(saved.password_configured, true);
    assert.ok(!JSON.stringify(saved).includes(config.password));
    const [[secret]] = await db.query('SELECT password_encrypted FROM estate_mail_settings WHERE id=1');
    assert.ok(secret.password_encrypted && !secret.password_encrypted.includes(config.password));
    await call('/admin/mail', { token, method: 'PATCH', body: { ...config, password: '' } });
    const [[preserved]] = await db.query('SELECT password_encrypted FROM estate_mail_settings WHERE id=1');
    assert.equal(preserved.password_encrypted, secret.password_encrypted); checks += 4;
    const publicSettings = await call('/settings');
    assert.ok(!JSON.stringify(publicSettings).includes('qa-smtp-user')); checks++;
    await call('/admin/mail', { token, method: 'PATCH', body: { ...config, host: 'smtp://bad.test' }, status: 400 });
    const { DEMO_ADVERTISER_ID } = require(root + '/backend/dist/estate/demo-properties');
    const [[demo]] = await db.query('SELECT id,publication_status,title FROM properties WHERE advertiser_id=? LIMIT 1', [DEMO_ADVERTISER_ID]);
    assert.ok(demo); property = demo.id; original = demo;
    const [[before]] = await db.query('SELECT COUNT(*) n FROM estate_review_mail_outbox WHERE property_id=?', [property]);
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'draft' } });
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'pending_review' } });
    const [[after]] = await db.query('SELECT COUNT(*) n FROM estate_review_mail_outbox WHERE property_id=?', [property]);
    assert.equal(Number(after.n), Number(before.n) + 1); checks++;
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'pending_review' }, status: 400 });
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'draft' } });
    await db.query("UPDATE properties SET title='Corta' WHERE id=?", [property]);
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'pending_review' }, status: 400 });
    const [[rollback]] = await db.query('SELECT COUNT(*) n FROM estate_review_mail_outbox WHERE property_id=?', [property]);
    assert.equal(Number(rollback.n), Number(after.n)); checks++;
    await db.query('UPDATE properties SET title=? WHERE id=?', [original.title, property]);
    await call('/admin/mail', { token, method: 'PATCH', body: { ...config, enabled: false, password: '' } });
    await call('/manage/properties/' + property + '/status', { token, method: 'PATCH', body: { status: 'pending_review' } });
    const [[disabled]] = await db.query('SELECT COUNT(*) n FROM estate_review_mail_outbox WHERE property_id=?', [property]);
    assert.equal(Number(disabled.n), Number(after.n)); checks++;
    console.log(JSON.stringify({ passed: checks, productionConnections: 0, realEmailsSent: 0 }));
  } finally {
    if (property) {
      await db.query('UPDATE properties SET title=?,publication_status=? WHERE id=?', [original.title, original.publication_status, property]);
      await db.query('DELETE FROM estate_review_mail_outbox WHERE property_id=?', [property]);
    }
    if (oldSettings) {
      if (oldSettings[0]) { const r = oldSettings[0]; await db.query('UPDATE estate_mail_settings SET config_json=?,password_encrypted=?,updated_by=? WHERE id=1', [typeof r.config_json === 'string' ? r.config_json : JSON.stringify(r.config_json), r.password_encrypted, r.updated_by]); }
      else await db.query('DELETE FROM estate_mail_settings WHERE id=1');
    }
    await db.end();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
