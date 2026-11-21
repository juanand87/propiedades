// SQL + real MP4/HLS in the isolated local database. No production connections.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const { DataSource } = require(root + '/backend/node_modules/typeorm');
const { ConfigService } = require(root + '/backend/node_modules/@nestjs/config');
const { JwtService } = require(root + '/backend/node_modules/@nestjs/jwt');
const { EstateService } = require(root + '/backend/dist/estate/estate.service');
const { PropertyVideosService } = require(root + '/backend/dist/estate/property-videos.service');
const { VideoStorageService } = require(root + '/backend/dist/estate/video-storage.service');
const { VideoHlsService } = require(root + '/backend/dist/estate/video-hls.service');
const { VideoUploadJobsService } = require(root + '/backend/dist/estate/video-upload-jobs.service');
let passed = 0;
const check = value => { assert.ok(value); passed++; };
(async () => {
  const db = new DataSource({ type: 'mysql', host: '127.0.0.1', port: 3327, username: 'root', database: 'propiedades', extra: { multipleStatements: true } });
  const ids = [], videoIds = [], device = 'fcm_local_processing_' + randomUUID();
  let sourceKeys = [];
  await db.initialize();
  try {
    const [instance] = await db.query('SELECT @@datadir d,@@port p');
    assert.equal(Number(instance.p), 3327);
    assert.equal(path.resolve(instance.d).toLowerCase(), path.join(root, 'tmp/mobile-local/mysql-data').toLowerCase());
    const migration = await fs.readFile(root + '/database/PROCESAMIENTO_VIDEOS.sql', 'utf8');
    await db.query(migration); await db.query(migration); passed++;
    for (const name of ['VIDEOS_HLS.sql', 'NOTIFICACIONES_Y_PORTADAS.sql']) await db.query(await fs.readFile(root + '/database/' + name, 'utf8'));
    const config = new ConfigService({ NODE_ENV: 'development', PROJECT_ID: 'propiedades', DB_DATABASE: 'propiedades', DB_HOST: '127.0.0.1', DB_PORT: '3327', PROPERTY_VIDEOS_ENABLED: 'true', SOCIAL_VIDEOS_ENABLED: 'true', VIDEOS_HLS_ENABLED: 'true' });
    const jwt = new JwtService({ secret: 'isolated-upload-processing-test' });
    const storage = new VideoStorageService(config);
    const estate = new EstateService(db, jwt, undefined, storage, config);
    const hls = new VideoHlsService(db, config, storage, estate, jwt);
    const videos = new PropertyVideosService(db, config, estate, storage, jwt, hls);
    let deliveries = [], failDelivery = true;
    const push = { health: async () => ({ google_ready: true }), videoUploadReady: async (...args) => { if (failDelivery) throw Error('temporary Firebase outage'); deliveries.push(args); return true; } };
    const createWorker = () => new VideoUploadJobsService(db, config, storage, videos, estate, push);
    let worker = createWorker();
    const [user] = await db.query("SELECT id FROM users WHERE role='admin' AND isActive=1 LIMIT 1");
    assert.ok(user);
    const actor = await estate.actor(user.id);
    await db.query('INSERT INTO estate_push_devices(token,user_id) VALUES (?,?)', [device, actor.id]);
    const bytes = await fs.readFile(root + '/tmp/mobile-local/example-1.mp4');
    const file = { buffer: bytes, mimetype: 'video/mp4' };
    const id = randomUUID(); ids.push(id);
    const body = { request_id: id, title: 'QA procesamiento persistente', publish: 'false' };
    const receipt = await worker.receive(actor, body, file);
    check(receipt.processing_status === 'pending' && !receipt.video_id);
    const [staged] = await db.query('SELECT * FROM estate_video_upload_jobs WHERE id=?', [id]); sourceKeys.push(staged.source_key);
    assert.deepEqual(await fs.readFile(root + '/tmp/video-upload-jobs/' + staged.source_key + '.mp4'), bytes); passed++;
    await assert.rejects(worker.status({ ...actor, id: randomUUID() }, id), /Carga no encontrada/); passed++;
    await assert.rejects(worker.receive(actor, { ...body, title: 'Different' }, file), /otra carga/); passed++;
    assert.equal((await worker.receive(actor, body, file)).upload_id, id); passed++;
    await worker.notify(actor, id); passed++;
    // New worker instance simulates closing the app / restarting the API.
    worker = createWorker();
    await worker.processNext();
    const preparing = await worker.status(actor, id);
    check(preparing.processing_status === 'preparing' && preparing.video_id);
    videoIds.push(preparing.video_id);
    check(deliveries.length === 0); // never notify before actual preparation.
    const [saved] = await db.query('SELECT status FROM property_videos WHERE id=?', [preparing.video_id]);
    check(saved.status === 'draft');
    // Simulate a crash after committing the video but before recording job success.
    await db.query("UPDATE estate_video_upload_jobs SET status='processing',video_id=NULL,result_json=NULL WHERE id=?", [id]);
    worker = createWorker(); await worker.processNext();
    assert.equal((await worker.status(actor, id)).video_id, preparing.video_id); passed++;
    const [count] = await db.query('SELECT COUNT(*) n FROM property_video_recordings WHERE request_id=?', [id]);
    check(Number(count.n) === 1);
    await hls.processNext(preparing.video_id);
    await worker.processNext();
    check((await worker.status(actor, id)).processing_status === 'ready');
    const [notice] = await db.query('SELECT notified_at,notify_attempts,source_key FROM estate_video_upload_jobs WHERE id=?', [id]);
    check(!notice.notified_at && notice.notify_attempts >= 1 && !notice.source_key);
    failDelivery = false;
    await db.query('UPDATE estate_video_upload_jobs SET notify_due_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
    await createWorker().processNext();
    assert.deepEqual(deliveries, [[actor.id, preparing.video_id, id, false]]); passed++;
    await createWorker().processNext(); check(deliveries.length === 1);
    assert.equal((await worker.receive(actor, body, file)).video_id, preparing.video_id); passed++;
    // Invalid video accepted as bytes must end in failure, never a false ready notification.
    const bad = randomUUID(); ids.push(bad);
    const malformed = Buffer.alloc(40); malformed.write('ftyp', 4); malformed.write('isom', 8);
    await worker.receive(actor, { request_id: bad, title: 'QA invalid file' }, { buffer: malformed, mimetype: 'video/mp4' });
    await worker.notify(actor, bad);
    await worker.processNext();
    const failed = await worker.status(actor, bad);
    check(failed.processing_status === 'failed' && !failed.video_id && failed.message);
    assert.deepEqual(deliveries[1], [actor.id, '', bad, true]); passed++;
    await assert.rejects(worker.notify(actor, bad), /No se pudo leer/); passed++;
    await assert.rejects(worker.retry(actor, bad), /30 segundos/); passed++;
    await db.query('UPDATE estate_video_upload_jobs SET updated_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE id=?', [bad]);
    check((await worker.retry(actor, bad)).processing_status === 'pending');
    await worker.processNext();
    check((await worker.status(actor, bad)).processing_status === 'failed');
    await assert.rejects(worker.retry({ ...actor, id: randomUUID() }, bad), /Carga no encontrada/); passed++;
    const [existingCount] = await db.query('SELECT COUNT(*) n FROM property_video_recordings WHERE request_id=?', [id]);
    check(Number(existingCount.n) === 1);
    console.log(JSON.stringify({ passed, realVideoCompression: true, realHls: true, productionConnections: 0, firebaseCalls: 0 }));
  } finally {
    if (ids.length) sourceKeys.push(...(await db.query('SELECT source_key FROM estate_video_upload_jobs WHERE id IN (?)', [ids])).map(r => r.source_key).filter(Boolean));
    for (const key of sourceKeys) await fs.unlink(root + '/tmp/video-upload-jobs/' + key + '.mp4').catch(() => {});
    for (const id of videoIds) {
      await db.query('DELETE FROM property_video_hls WHERE video_id=?', [id]);
      await db.query('DELETE FROM property_video_posters WHERE video_id=?', [id]);
      await db.query('DELETE FROM property_video_recordings WHERE video_id=?', [id]);
      await db.query('DELETE FROM property_videos WHERE id=?', [id]);
      await fs.unlink(root + '/tmp/mobile-videos/' + id + '.mp4').catch(() => {});
      const target = path.resolve(root, 'tmp/mobile-hls', id);
      assert.equal(path.dirname(target), path.resolve(root, 'tmp/mobile-hls'));
      await fs.rm(target, { recursive: true, force: true });
    }
    for (const id of ids) await db.query('DELETE FROM estate_video_upload_jobs WHERE id=?', [id]);
    await db.query('DELETE FROM estate_push_devices WHERE token=?', [device]);
    await db.destroy();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
