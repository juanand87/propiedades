// Real SQL checks inside a rolled-back transaction on the isolated mobile DB.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const mysql = require(path.join(root, 'backend/node_modules/mysql2/promise'));
const { ConfigService } = require(path.join(root, 'backend/node_modules/@nestjs/config'));
const { VideoSocialService } = require(path.join(root, 'backend/dist/estate/video-social.service'));
async function main() {
  const db = await mysql.createConnection({ host: '127.0.0.1', port: 3327, user: 'root', database: 'propiedades' });
  let transaction = false;
  try {
    const [[instance]] = await db.query('SELECT @@port p,@@datadir d');
    assert.equal(Number(instance.p), 3327);
    assert.ok(instance.d.replaceAll('\\', '/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
    const qa = JSON.parse(await fs.readFile(path.join(root, 'tmp/mobile-local/social-qa.json'), 'utf8'));
    await db.beginTransaction(); transaction = true;
    const parentId = randomUUID(), targetId = randomUUID();
    const entries = [parentId, targetId, ...Array.from({ length: 105 }, () => randomUUID())];
    for (let i = 0; i < entries.length; i++)
      await db.query('INSERT INTO estate_video_comments(id,video_id,user_id,body,created_at) VALUES (?,?,?,?,?)', [entries[i], qa.videoId, qa.userId, 'Notification QA ' + i, new Date(Date.UTC(2030, 0, 1, 0, 0, i))]);
    await db.query('INSERT INTO estate_video_comment_replies(comment_id,parent_id) VALUES (?,?)', [targetId, parentId]);
    const service = new VideoSocialService({ query: async (sql, params) => (await db.query(sql, params))[0] }, new ConfigService({ SOCIAL_VIDEOS_ENABLED: 'true' }), {}, {}, {}, {}, {});
    const normal = await service.comments(qa.videoId);
    assert.equal(normal.length, 100);
    assert.ok(!normal.some(c => c.id === targetId || c.id === parentId));
    const contextual = await service.comments(qa.videoId, undefined, targetId);
    assert.equal(contextual.length, 102);
    assert.equal(contextual[0].id, parentId);
    assert.equal(contextual[1].id, targetId);
    assert.equal(contextual[1].parent_id, parentId);
    assert.equal(new Set(contextual.map(c => c.id)).size, 102);
    const recent = await service.comments(qa.videoId, undefined, entries.at(-1));
    assert.equal(recent.length, 100);
    await assert.rejects(service.comments(qa.videoId, undefined, randomUUID()), /ya no está disponible/);
    await assert.rejects(service.comments(randomUUID(), undefined, targetId), /Video no disponible/);
    await db.query("UPDATE property_videos SET status='draft' WHERE id=?", [qa.videoId]);
    await assert.rejects(service.comments(qa.videoId, { id: randomUUID(), role: 'user' }, targetId), /Video no disponible/);
    assert.equal((await service.comments(qa.videoId, { id: qa.userId, role: 'user' }, targetId)).length, 102);
    console.log('PASS: 12 notification comment SQL checks. Local DB only; all changes rolled back.');
  } finally {
    if (transaction) await db.rollback();
    await db.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
