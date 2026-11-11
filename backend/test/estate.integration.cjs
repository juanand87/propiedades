// Runs ONLY against our isolated local QA server. Never accepts a remote hostname.
const mysql = require('mysql2/promise'),
  fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  crypto = require('crypto'),
  { spawn } = require('child_process');
const bcrypt = require('bcrypt'),
  sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
async function main() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3317,
    user: 'root',
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  let app;
  try {
    const [[instance]] = await db.query(
      'SELECT @@datadir location,@@port port',
    );
    assert.equal(Number(instance.port), 3317);
    assert.ok(
      String(instance.location)
        .replace(/\\/g, '/')
        .toLowerCase()
        .startsWith(
          (root + '/tmp/qa-mysql-data').replace(/\\/g, '/').toLowerCase(),
        ),
      'Refusing to reset a non-QA database',
    );
    await db.query('DROP DATABASE IF EXISTS propiedades');
    await db.query(
      'CREATE DATABASE IF NOT EXISTS propiedades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
    );
    const migration = fs.readFileSync(
      path.join(root, 'database/ACTUALIZAR_PROPIEDADES.sql'),
      'utf8',
    );
    await db.query(migration);
    await db.query(
      fs.readFileSync(path.join(root, 'database/PLANES_MEMBRESIA.sql'), 'utf8'),
    );
    for (const file of [
      'SPACES_VIDEOS_PROPIEDADES.sql',
      'PERFILES_Y_VIDEOS_SOCIALES.sql',
      'NOTIFICACIONES_Y_PORTADAS.sql',
      'MENSAJES_PROPPIX.sql',
      'MENSAJES_PROPPIX.sql',
    ]) {
      await db.query(
        fs.readFileSync(path.join(root, 'database', file), 'utf8'),
      );
    }
    // Simulate a compatible legacy users table with a different collation.
    // This is exclusively the disposable instance validated by the guard above.
    await db.query(
      'ALTER TABLE propiedades.users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    );
    const [[count]] = await db.query('SELECT COUNT(*) n FROM estate_regions');
    assert.equal(count.n, 16);
    const [[communes]] = await db.query(
      'SELECT COUNT(*) n FROM estate_communes',
    );
    assert.equal(communes.n, 346);
    const adminId = crypto.randomUUID(),
      password = 'QA-only-password-2026';
    await db.query(
      'INSERT INTO propiedades.users(id,email,password,firstName,lastName,role) VALUES (?,?,?,?,?,?)',
      [
        adminId,
        'admin@qa.invalid',
        await bcrypt.hash(password, 10),
        'QA',
        'Admin',
        'admin',
      ],
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS propiedades.qa_legacy_sentinel(id int PRIMARY KEY,note varchar(100)); INSERT IGNORE INTO propiedades.qa_legacy_sentinel VALUES (1,'preserve')",
    );
    const legacyUser = crypto.randomUUID(),
      legacyVendor = crypto.randomUUID();
    await db.query(
      "INSERT INTO propiedades.users(id,email,password,firstName,lastName,role) VALUES (?,?,?,'Legacy','QA','vendor')",
      [legacyUser, 'legacy@qa.invalid', await bcrypt.hash(password, 10)],
    );
    await db.query(
      'CREATE TABLE propiedades.vendors(id varchar(36) PRIMARY KEY,userId varchar(36),storeName varchar(255),slug varchar(255)) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    );
    await db.query(
      'INSERT INTO propiedades.vendors(id,userId,storeName,slug) VALUES (?,?,?,?)',
      [legacyVendor, legacyUser, 'Cuenta heredada QA', 'legacy-qa'],
    );
    await db.query(migration);
    const [[preservedAdvertiser]] = await db.query(
      'SELECT user_id,status FROM advertisers WHERE legacy_vendor_id=?',
      [legacyVendor],
    );
    assert.equal(preservedAdvertiser.user_id, legacyUser);
    assert.equal(preservedAdvertiser.status, 'pending');
    const [[saved]] = await db.query(
      'SELECT COUNT(*) n FROM propiedades.users WHERE id=?',
      [adminId],
    );
    assert.equal(saved.n, 1);
    const [[sentinel]] = await db.query(
      'SELECT note FROM propiedades.qa_legacy_sentinel WHERE id=1',
    );
    assert.equal(sentinel.note, 'preserve');
    const dbPassword = crypto.randomBytes(24).toString('hex');
    await db.query(
      "CREATE USER IF NOT EXISTS 'propiedades_qa'@'127.0.0.1' IDENTIFIED BY ?",
      [dbPassword],
    );
    await db.query("ALTER USER 'propiedades_qa'@'127.0.0.1' IDENTIFIED BY ?", [
      dbPassword,
    ]);
    await db.query(
      "GRANT SELECT,INSERT,UPDATE,DELETE ON propiedades.* TO 'propiedades_qa'@'127.0.0.1'",
    );
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      PROJECT_ID: 'propiedades',
      DB_DATABASE: 'propiedades',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3317',
      DB_USERNAME: 'propiedades_qa',
      DB_PASSWORD: dbPassword,
      DB_SHARED_HOST: '',
      DB_SHARED_USERNAME: '',
      DB_SSL: 'false',
      DB_SSL_CA: '',
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      INTEGRATIONS_ENABLED: 'false',
      SPACES_IMAGES_ENABLED: 'false',
      SPACES_VIDEOS_ENABLED: 'false',
      PROPERTY_VIDEOS_ENABLED: 'false',
      SCHEDULED_JOBS_ENABLED: 'false',
      ADMIN_RECOVERY_ENABLED: 'false',
      PORT: '3318',
    };
    app = spawn(process.execPath, ['dist/main.js'], {
      cwd: path.join(root, 'backend'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let startup = '';
    app.stdout.on('data', (b) => (startup += b));
    app.stderr.on('data', (b) => (startup += b));
    let ready = false;
    for (let i = 0; i < 70; i++) {
      try {
        const r = await fetch('http://127.0.0.1:3318/api/ready');
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, 'QA backend did not start: ' + startup);
    let assertions = 0;
    async function call(method, url, body, token, expected = 200) {
      const isForm = body instanceof FormData;
      const r = await fetch('http://127.0.0.1:3318/api' + url, {
        method,
        headers: {
          ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      assert.equal(
        r.status,
        expected,
        `${method} ${url}: ${JSON.stringify(data)}`,
      );
      assertions++;
      return data;
    }
    const admin = (
      await call(
        'POST',
        '/auth/panel/login',
        { email: 'admin@qa.invalid', password },
        null,
        201,
      )
    ).access_token;
    const beforeDesign = await call('GET', '/settings');
    assert.equal(beforeDesign.design_ready, false);
    assertions++;
    await call(
      'PATCH',
      '/admin/design',
      { design: beforeDesign.design, revision: 1 },
      admin,
      503,
    );
    const designMigration = fs.readFileSync(
      path.join(root, 'database/004_diseno_sitio.sql'),
      'utf8',
    );
    await db.query(designMigration);
    await db.query(designMigration);
    const initialDesign = await call('GET', '/settings');
    assert.equal(initialDesign.design_ready, true);
    assertions++;
    const catalog = await call('GET', '/catalog');
    assert.equal(catalog.communes.length, 346);
    assertions++;
    const one = await call(
      'POST',
      '/auth/register',
      { email: 'one@qa.invalid', password, firstName: 'One', lastName: 'Test' },
      null,
      201,
    );
    const two = await call(
      'POST',
      '/auth/register',
      { email: 'two@qa.invalid', password, firstName: 'Two', lastName: 'Test' },
      null,
      201,
    );
    const a = await call(
      'POST',
      '/me/advertiser',
      { display_name: 'QA One', kind: 'owner' },
      one.access_token,
      201,
    );
    const b = await call(
      'POST',
      '/me/advertiser',
      { display_name: 'QA Two', kind: 'broker' },
      two.access_token,
      201,
    );
    await call(
      'PATCH',
      '/admin/advertisers/' + a.id,
      { status: 'approved' },
      admin,
    );
    await call(
      'PATCH',
      '/admin/advertisers/' + b.id,
      { status: 'approved' },
      admin,
    );
    const fd = new FormData();
    fd.set(
      'file',
      new Blob(
        [
          await sharp({
            create: {
              width: 300,
              height: 200,
              channels: 3,
              background: '#abc',
            },
          })
            .png()
            .toBuffer(),
        ],
        { type: 'image/png' },
      ),
      'qa-fotografía.png',
    );
    const media = await call(
      'POST',
      '/manage/media',
      fd,
      one.access_token,
      201,
    );
    assert.equal(media.name, 'qa-fotografía.png');
    assertions++;
    const c = catalog.communes[0];
    const payload = {
      title: 'Casa de prueba inmobiliaria',
      description:
        'Descripción suficientemente extensa para validar la publicación de esta casa de pruebas.',
      type_id: 'house',
      price_amount: '12000.1234',
      price_unit: 'UF',
      built_area: '120.5',
      land_area: '400',
      bedrooms: '3',
      bathrooms: '2',
      region_id: c.region_id,
      commune_id: c.id,
      address: 'Dirección privada QA',
      latitude: '-33.4',
      longitude: '-70.6',
      show_exact_address: false,
      amenity_ids: ['garden'],
      media_ids: [media.id],
    };
    const p = await call(
      'POST',
      '/manage/properties',
      payload,
      one.access_token,
      201,
    );
    const draft = await call(
      'GET',
      '/manage/properties/' + p.id,
      null,
      one.access_token,
    );
    await call('POST', '/manage/properties', payload, one.access_token, 403);
    await call(
      'PATCH',
      '/admin/users/' + one.user.id,
      { membership_plan: 'basic' },
      admin,
    );
    await call(
      'POST',
      '/manage/properties',
      { ...payload, price_unit: 'CLP', price_amount: '1000.1' },
      one.access_token,
      400,
    );
    await call('POST', '/manage/properties', payload, null, 401);
    await call('POST', '/manage/properties', payload, two.access_token, 403);
    await call(
      'DELETE',
      '/manage/media/' + media.id,
      null,
      one.access_token,
      409,
    );
    await call('GET', '/properties/' + p.id, null, null, 404);
    await call(
      'GET',
      '/manage/properties/' + p.id,
      null,
      two.access_token,
      403,
    );
    await call(
      'PATCH',
      '/manage/properties/' + p.id,
      { ...payload },
      two.access_token,
      403,
    );
    await call(
      'PATCH',
      `/manage/properties/${p.id}/status`,
      { status: 'published' },
      one.access_token,
      400,
    );
    await call(
      'PATCH',
      `/manage/properties/${p.id}/status`,
      { status: 'pending_review' },
      one.access_token,
    );
    await call(
      'PATCH',
      `/manage/properties/${p.id}/status`,
      { status: 'published' },
      admin,
    );
    const pub = await call('GET', '/properties/' + p.id);
    const saleListings = await call('GET', '/properties?operation_type=sale');
    assert.ok(saleListings.items.some((item) => item.id === p.id));
    const rentalListings = await call('GET', '/properties?operation_type=rent');
    assert.ok(!rentalListings.items.some((item) => item.id === p.id));
    assertions += 2;
    await call(
      'PATCH',
      '/manage/properties/' + p.id,
      { title: 'Edición desactualizada', revision: draft.revision },
      one.access_token,
      409,
    );
    await call('GET', '/properties?sort=toString', null, null, 200);
    assert.equal(pub.location, null);
    assert.ok(!('moderation_reason' in pub));
    assert.equal(pub.price_amount, '12000.1234');
    assertions += 3;
    const result = await call(
      'GET',
      '/properties?price_unit=UF&min_price=12000&sort=price_asc',
    );
    assert.ok(result.items.some((x) => x.id === p.id));
    assertions++;
    await call('GET', '/properties?sort=price_asc', null, null, 400);
    await call('GET', '/properties?min_price=10', null, null, 400);
    await call('POST', '/me/favorites/' + p.id, {}, two.access_token, 201);
    assert.equal(
      (await call('GET', '/me/favorites', null, two.access_token)).length,
      1,
    );
    assertions++;
    await call(
      'POST',
      `/properties/${p.id}/inquiries`,
      {
        name: 'Interesado',
        email: 'lead@qa.invalid',
        message: 'Me gustaría conocer la propiedad',
        consent: true,
        requested_at: new Date(Date.now() + 86400000).toISOString(),
      },
      null,
      201,
    );
    const contacts = await call(
      'GET',
      '/manage/inquiries',
      null,
      one.access_token,
    );
    assert.equal(contacts.length, 1);
    assertions++;
    assert.equal(
      (await call('GET', '/manage/inquiries', null, two.access_token)).length,
      0,
    );
    assertions++;
    await call(
      'PATCH',
      '/manage/inquiries/' + contacts[0].id,
      {
        status: 'contacted',
        message: 'Nota interna QA',
        visit_status: 'confirmed',
      },
      one.access_token,
    );
    await call(
      'GET',
      '/manage/inquiries/' + contacts[0].id + '/messages',
      null,
      two.access_token,
      403,
    );
    assert.equal((await call('GET', '/messages/capabilities')).enabled, true);
    await call('GET', '/messages/conversations', null, null, 401);
    const pushToken = 'fcm_QA_local_only_0123456789';
    await call('POST', '/messages/devices', { token: pushToken }, null, 401);
    await call('POST', '/messages/devices', { token: 'invalid' }, two.access_token, 400);
    await call('POST', '/messages/devices', { token: pushToken }, two.access_token, 201);
    await call('POST', '/messages/devices', { token: pushToken, enabled: false }, one.access_token, 201);
    assert.equal((await db.query('SELECT user_id FROM estate_push_devices WHERE token=?', [pushToken]))[0][0].user_id, two.user.id);
    const chat = await call(
      'POST',
      '/messages/conversations',
      { recipient_id: two.user.id },
      one.access_token,
      201,
    );
    const reverseChat = await call(
      'POST',
      '/messages/conversations',
      { property_id: p.id },
      two.access_token,
      201,
    );
    assert.equal(chat.id, reverseChat.id);
    await call(
      'POST',
      '/messages/conversations',
      { recipient_id: one.user.id },
      one.access_token,
      400,
    );
    await call('GET', '/messages/conversations/' + chat.id, null, admin, 404);
    await call(
      'POST',
      '/messages/conversations/' + chat.id,
      { body: 'Privado', client_id: crypto.randomUUID() },
      admin,
      404,
    );
    const outgoing = {
      body: 'Consulta privada sobre mi próximo hogar <texto>',
      client_id: crypto.randomUUID(),
    };
    const delivered = await Promise.all(
      [0, 1].map(() =>
        call(
          'POST',
          '/messages/conversations/' + chat.id,
          outgoing,
          one.access_token,
          201,
        ),
      ),
    );
    assert.equal(delivered[0].id, delivered[1].id);
    const [pushRows] = await db.query('SELECT user_id,status FROM estate_push_deliveries WHERE message_id=?', [delivered[0].id]);
    assert.equal(pushRows.length, 1);
    assert.equal(pushRows[0].user_id, two.user.id);
    assert.equal(pushRows[0].status, 'pending');
    await call('POST', '/messages/devices', { token: pushToken, enabled: false }, two.access_token, 201);
    assert.equal((await db.query('SELECT token FROM estate_push_devices WHERE token=?', [pushToken]))[0].length, 0);
    await call(
      'POST',
      '/messages/conversations/' + chat.id,
      { ...outgoing, body: 'Otro contenido con el mismo envío' },
      one.access_token,
      409,
    );
    const firstHistory = await call(
      'GET',
      '/messages/conversations/' + chat.id,
      null,
      two.access_token,
    );
    assert.equal(firstHistory.items.length, 1);
    assert.equal(firstHistory.items[0].body, outgoing.body);
    let recipientInbox = await call(
      'GET',
      '/messages/conversations',
      null,
      two.access_token,
    );
    assert.equal(recipientInbox.items[0].unread, 1);
    await call(
      'POST',
      '/messages/conversations/' + chat.id + '/read',
      { last_message_id: delivered[0].id },
      two.access_token,
      201,
    );
    recipientInbox = await call(
      'GET',
      '/messages/conversations',
      null,
      two.access_token,
    );
    assert.equal(recipientInbox.items[0].unread, 0);
    const reply = await call(
      'POST',
      '/messages/conversations/' + chat.id,
      { body: 'Sí, conversemos por Proppix.', client_id: crypto.randomUUID() },
      two.access_token,
      201,
    );
    const nextMessages = await call(
      'GET',
      '/messages/conversations/' + chat.id + '?after=' + delivered[0].id,
      null,
      one.access_token,
    );
    assert.equal(nextMessages.items.length, 1);
    assert.equal(nextMessages.items[0].id, reply.id);
    await call(
      'POST',
      '/messages/conversations/' + chat.id + '/read',
      { last_message_id: '999999999999' },
      two.access_token,
      400,
    );
    await call(
      'POST',
      '/messages/conversations/' + chat.id,
      { body: 'x'.repeat(4001), client_id: crypto.randomUUID() },
      two.access_token,
      400,
    );
    const chatOther = await call(
      'POST',
      '/messages/conversations',
      { recipient_id: two.user.id },
      admin,
      201,
    );
    const foreignMessage = await call(
      'POST',
      '/messages/conversations/' + chatOther.id,
      { body: 'Otra conversación', client_id: crypto.randomUUID() },
      admin,
      201,
    );
    await call(
      'POST',
      '/messages/conversations/' + chat.id + '/read',
      { last_message_id: foreignMessage.id },
      two.access_token,
      400,
    );
    for (let index = 0; index < 60; index++)
      await db.query(
        'INSERT INTO estate_direct_messages(conversation_id,sender_id,client_id,body,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP()-INTERVAL 2 MINUTE)',
        [
          chat.id,
          index % 2 ? one.user.id : two.user.id,
          crypto.randomUUID(),
          'Historial ' + index,
        ],
      );
    await db.query(
      'UPDATE estate_conversations SET last_message_id=(SELECT MAX(id) FROM estate_direct_messages WHERE conversation_id=?) WHERE id=?',
      [chat.id, chat.id],
    );
    const historyPage = await call(
      'GET',
      '/messages/conversations/' + chat.id,
      null,
      one.access_token,
    );
    assert.equal(historyPage.items.length, 50);
    assert.equal(historyPage.has_more, true);
    const olderMessages = await call(
      'GET',
      '/messages/conversations/' +
        chat.id +
        '?before=' +
        historyPage.items[0].id,
      null,
      one.access_token,
    );
    assert.equal(olderMessages.items.length, 12);
    assert.equal(olderMessages.has_more, false);
    await call(
      'POST',
      '/messages/conversations/' + chat.id + '/read',
      { last_message_id: foreignMessage.id },
      two.access_token,
      400,
    );
    const catchUp = await call(
      'GET',
      '/messages/conversations/' + chat.id + '?after=' + delivered[0].id,
      null,
      two.access_token,
    );
    assert.equal(catchUp.items.length, 50);
    assert.equal(catchUp.has_more, true);
    const catchUpEnd = await call(
      'GET',
      '/messages/conversations/' +
        chat.id +
        '?after=' +
        catchUp.items.at(-1).id,
      null,
      two.access_token,
    );
    assert.equal(catchUpEnd.items.length, 11);
    assert.equal(catchUpEnd.has_more, false);
    assertions += 4;
    const allMessageIds = [...olderMessages.items, ...historyPage.items].map(
      (item) => item.id,
    );
    assert.equal(new Set(allMessageIds).size, 62);
    for (let index = 0; index < 29; index++)
      await db.query(
        'INSERT INTO estate_direct_messages(conversation_id,sender_id,client_id,body,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',
        [chat.id, one.user.id, crypto.randomUUID(), 'Límite ' + index],
      );
    await call(
      'POST',
      '/messages/conversations/' + chat.id,
      { body: 'Límite alcanzado', client_id: crypto.randomUUID() },
      one.access_token,
      429,
    );
    await db.query(
      fs.readFileSync(path.join(root, 'database/MENSAJES_PROPPIX.sql'), 'utf8'),
    );
    const [[preservedMessages]] = await db.query(
      'SELECT COUNT(*) n FROM estate_direct_messages WHERE conversation_id=?',
      [chat.id],
    );
    assert.equal(Number(preservedMessages.n), 91);
    assertions += 17;
    const signature = new URL('http://qa' + media.url).searchParams.get(
      'signature',
    );
    await call('GET', '/auth/profile', null, signature, 401);
    await call(
      'PATCH',
      '/manage/properties/' + p.id,
      { ...payload, description: payload.description + ' Edición.' },
      one.access_token,
    );
    await call('GET', '/properties/' + p.id, null, null, 404);
    await call('POST', '/products/download-discogs-images', {}, admin, 404);
    await call('GET', '/orders', null, admin, 404);
    await call('GET', '/vendors/any/discogs/search', null, admin, 404);
    const stats = await call('GET', '/manage/stats', null, admin);
    assert.equal(Number(stats.inquiries), 1);
    assertions++;
    await call('PATCH', '/admin/design', {}, null, 401);
    await call(
      'PATCH',
      '/admin/design',
      { design: initialDesign.design, revision: 1 },
      one.access_token,
      403,
    );
    await call(
      'PATCH',
      '/admin/design',
      {
        design: { ...initialDesign.design, primary_color: '#ffffff' },
        revision: 1,
      },
      admin,
      400,
    );
    await call(
      'PATCH',
      '/admin/design',
      {
        design: { ...initialDesign.design, logo_media_id: media.id },
        revision: 1,
      },
      admin,
      403,
    );
    const adminMedia = await call('POST', '/manage/media', fd, admin, 201);
    await call('GET', '/media/' + adminMedia.id, null, null, 404);
    const designed = await call(
      'PATCH',
      '/admin/design',
      {
        revision: 1,
        design: {
          ...initialDesign.design,
          primary_color: '#18436a',
          hero_copy: {
            title: 'Portal visual QA',
            subtitle: 'Texto común del portal.',
          },
          header_sticky: true,
          header_shrink: true,
          header_shrink_percent: 70,
          header_overlay: {
            enabled: true,
            cover_text_color: '#102b50',
            scroll_background_color: '#18436a',
            scroll_text_color: '#ffffff',
          },
          header_style: {
            logo_height: 56,
            height: 104,
            background_color: '#102b50',
            text_color: '#ffffff',
            hover_color: '#f1cc88',
            button_color: '#18436a',
            button_text_color: '#ffffff',
          },
          header_links: [
            { label: 'Comprar', href: '/propiedades', new_tab: false },
            { label: 'Equipo', href: '/informacion', new_tab: false },
          ],
          header_button: {
            label: 'Publica aquí',
            href: '/register',
            new_tab: false,
            visible: true,
          },
          footer_text: 'Portal principal independiente.',
          footer_contact: {
            phone: '+56 9 4444 4444',
            whatsapp: '+56 9 4444 4444',
            email: 'portal@qa.invalid',
          },
          footer_socials: [
            { network: 'facebook', url: 'https://www.facebook.com/qa-portal/' },
          ],
          logo_media_id: adminMedia.id,
          hero_media_id: adminMedia.id,
          sections: [...initialDesign.design.sections]
            .reverse()
            .map((s) => (s.id === 'types' ? { ...s, visible: false } : s)),
        },
      },
      admin,
    );
    assert.deepEqual(
      designed.design.header_links.map((link) => link.label),
      ['Comprar', 'Equipo'],
    );
    assert.equal(designed.design.header_button.label, 'Publica aquí');
    assertions += 2;
    await call(
      'PATCH',
      '/admin/design',
      {
        design: {
          ...designed.design,
          header_links: [
            { label: 'Peligroso', href: 'javascript:alert(1)', new_tab: false },
          ],
        },
        revision: 2,
      },
      admin,
      400,
    );
    assert.equal(designed.design_version, 10);
    const publicMainFooter = await call('GET', '/settings');
    assert.equal(publicMainFooter.design.header_sticky, true);
    assert.equal(publicMainFooter.design.hero_copy.title, 'Portal visual QA');
    assertions++;
    assert.equal(
      publicMainFooter.design.header_overlay.scroll_background_color,
      '#18436a',
    );
    assert.equal(publicMainFooter.design.header_overlay.enabled, true);
    assertions += 2;
    assert.equal(publicMainFooter.design.header_shrink, true);
    assert.equal(publicMainFooter.design.header_shrink_percent, 70);
    assertions += 2;
    assertions++;
    assert.equal(publicMainFooter.design.header_style.height, 104);
    assert.equal(publicMainFooter.design.header_style.logo_height, 56);
    assertions += 2;
    await call(
      'PATCH',
      '/admin/design',
      {
        revision: 2,
        design: {
          ...designed.design,
          header_style: { ...designed.design.header_style, height: 999 },
        },
      },
      admin,
      400,
    );
    assert.equal(
      publicMainFooter.design.footer_text,
      'Portal principal independiente.',
    );
    assert.equal(
      publicMainFooter.design.footer_contact.email,
      'portal@qa.invalid',
    );
    assert.equal(publicMainFooter.design.footer_socials[0].network, 'facebook');
    assertions += 4;
    await call(
      'PATCH',
      '/admin/design',
      {
        design: {
          ...designed.design,
          footer_socials: [
            { network: 'facebook', url: 'https://instagram.com/qa/' },
          ],
        },
        revision: 2,
      },
      admin,
      400,
    );
    assert.equal((await call('GET', '/settings')).design_revision, 2);
    assertions++;
    assert.equal(designed.design_revision, 2);
    assert.equal(designed.design.primary_color, '#18436a');
    assert.equal(designed.design.sections[0].id, 'publish');
    assert.equal(
      designed.design.sections.find((s) => s.id === 'types').visible,
      false,
    );
    assert.equal(designed.design.logo_url, '/api/media/' + adminMedia.id);
    assertions += 5;
    await call('GET', '/media/' + adminMedia.id);
    await call('DELETE', '/manage/media/' + adminMedia.id, null, admin, 409);
    await call(
      'PATCH',
      '/admin/design',
      { design: initialDesign.design, revision: 1 },
      admin,
      409,
    );
    const restored = await call(
      'PATCH',
      '/admin/design',
      { design: initialDesign.design, revision: 2 },
      admin,
    );
    assert.equal(restored.design.hero_media_id, null);
    assertions++;
    await call('GET', '/media/' + adminMedia.id, null, null, 404);
    await call('DELETE', '/manage/media/' + adminMedia.id, null, admin);
    const pendingBrokerSite = await call(
      'GET',
      '/me/site',
      null,
      one.access_token,
    );
    assert.equal(pendingBrokerSite.design_ready, false);
    assert.equal(pendingBrokerSite.advertiser.id, a.id);
    assertions += 2;
    await call('GET', '/me/site', null, null, 401);
    await call('GET', '/me/site', null, admin, 400);
    await call(
      'PATCH',
      '/me/site',
      { design: pendingBrokerSite.design, revision: 0 },
      one.access_token,
      503,
    );
    const brokerMigration = fs.readFileSync(
      path.join(root, 'database/005_sitios_corredores.sql'),
      'utf8',
    );
    await db.query(brokerMigration);
    await db.query(brokerMigration);
    const baseBroker = await call('GET', '/me/site', null, one.access_token);
    assert.equal(baseBroker.design_ready, true);
    assert.equal(baseBroker.design_revision, 0);
    assertions += 2;
    const brokerMediaA = await call(
      'POST',
      '/manage/media',
      fd,
      one.access_token,
      201,
    );
    const brokerMediaB = await call(
      'POST',
      '/manage/media',
      fd,
      two.access_token,
      201,
    );
    await call('GET', '/media/' + brokerMediaA.id, null, null, 404);
    const designA = {
      ...baseBroker.design,
      primary_color: '#18436a',
      hero_title: 'Corredor Azul · Tu próximo lugar',
      hero_copy: {
        title: 'Portada visual de inmobiliaria',
        subtitle: 'Asesoría local.',
      },
      header_sticky: true,
      header_shrink: true,
      header_shrink_percent: 80,
      header_overlay: {
        enabled: true,
        cover_text_color: '#ffffff',
        scroll_background_color: '#102b50',
        scroll_text_color: '#f1cc88',
      },
      header_style: {
        logo_height: 64,
        height: 120,
        background_color: '#ffffff',
        text_color: '#18436a',
        hover_color: '#075ce5',
        button_color: null,
        button_text_color: null,
      },
      header_links: [
        { label: 'Mis casas', href: '#propiedades', new_tab: false },
        { label: 'Equipo Azul', href: '#nosotros', new_tab: false },
      ],
      header_button: {
        label: 'Agenda una visita',
        href: '#contacto',
        new_tab: false,
        visible: true,
      },
      footer_text: 'Equipo Azul, asesoría inmobiliaria local.',
      footer_note: 'Atención con cita previa.',
      footer_contact: {
        phone: '+56 9 1111 1111',
        whatsapp: '+56 9 1111 1111',
        email: 'sitio-azul@qa.invalid',
      },
      footer_socials: [
        { network: 'instagram', url: 'https://www.instagram.com/qa-azul/' },
      ],
      hero_media_id: brokerMediaA.id,
      logo_media_id: brokerMediaA.id,
      sections: [...baseBroker.design.sections].reverse(),
    };
    const savedSiteA = await call(
      'PATCH',
      '/me/site',
      { design: designA, revision: 0, advertiser_id: b.id },
      one.access_token,
    );
    assert.equal(savedSiteA.advertiser.id, a.id);
    assert.equal(savedSiteA.design_revision, 1);
    assertions += 2;
    await call(
      'PATCH',
      '/me/site',
      { design: designA, revision: 0 },
      one.access_token,
      409,
    );
    await call(
      'PATCH',
      '/me/site',
      { design: { ...designA, logo_media_id: brokerMediaB.id }, revision: 1 },
      one.access_token,
      403,
    );
    await call(
      'PATCH',
      '/me/site',
      { design: designA, revision: 0 },
      admin,
      403,
    );
    const publicSiteA = await call('GET', '/advertisers/' + a.slug);
    assert.deepEqual(publicSiteA.site.header_style, designA.header_style);
    assert.deepEqual(publicSiteA.site.hero_copy, designA.hero_copy);
    assert.equal((await call('GET', '/settings')).design.hero_copy, null);
    assertions += 2;
    assert.deepEqual(publicSiteA.site.header_overlay, designA.header_overlay);
    assert.equal((await call('GET', '/settings')).design.header_overlay, null);
    assertions += 2;
    assert.equal(publicSiteA.site.header_sticky, true);
    assert.equal(publicSiteA.site.header_shrink_percent, 80);
    assert.equal(publicSiteA.site.header_shrink, true);
    assertions += 2;
    assert.equal((await call('GET', '/settings')).design.header_sticky, false);
    assertions += 2;
    assert.equal((await call('GET', '/settings')).design.header_style, null);
    assertions += 2;
    assert.deepEqual(publicSiteA.site.header_links, designA.header_links);
    assert.equal(
      publicSiteA.site.header_button.label,
      designA.header_button.label,
    );
    assertions += 2;
    await call(
      'PATCH',
      '/me/site',
      {
        design: {
          ...designA,
          header_button: {
            label: 'Inseguro',
            href: '//otro.cl',
            new_tab: true,
            visible: true,
          },
        },
        revision: 1,
      },
      one.access_token,
      400,
    );
    assert.equal(publicSiteA.site.footer_text, designA.footer_text);
    assert.equal(
      publicSiteA.site.footer_contact.email,
      designA.footer_contact.email,
    );
    assert.deepEqual(publicSiteA.site.footer_socials, designA.footer_socials);
    assert.equal(baseBroker.design_version, 10);
    const profileAfterFooter = await call(
      'GET',
      '/me/advertiser',
      null,
      one.access_token,
    );
    assert.notEqual(
      profileAfterFooter.public_email,
      designA.footer_contact.email,
    );
    assertions += 5;
    await call(
      'PATCH',
      '/me/site',
      {
        design: {
          ...designA,
          footer_socials: [
            { network: 'instagram', url: 'javascript:alert(1)' },
          ],
        },
        revision: 1,
      },
      one.access_token,
      400,
    );
    assert.equal(
      (await call('GET', '/me/site', null, one.access_token)).design_revision,
      1,
    );
    assertions++;
    assert.equal(publicSiteA.site.hero_title, designA.hero_title);
    assert.equal(publicSiteA.site.sections[0].id, 'contact');
    for (const key of ['user_id', 'tax_id', 'legal_name', 'password'])
      assert.ok(!(key in publicSiteA));
    assertions += 6;
    await call('GET', '/media/' + brokerMediaA.id);
    await call(
      'DELETE',
      '/manage/media/' + brokerMediaA.id,
      null,
      one.access_token,
      409,
    );
    await call(
      'DELETE',
      '/manage/media/' + brokerMediaA.id,
      null,
      two.access_token,
      403,
    );
    const ownB = await call(
      'GET',
      '/me/site?advertiser_id=' + a.id,
      null,
      two.access_token,
    );
    assert.equal(ownB.advertiser.id, b.id);
    assert.equal(ownB.design.primary_color, '#075ce5');
    assert.equal(ownB.design.header_links, null);
    assert.equal(ownB.design.header_style, null);
    assert.equal(ownB.design.header_sticky, false);
    assert.equal(ownB.design.hero_copy, null);
    assertions++;
    assert.equal(ownB.design.header_overlay, null);
    assertions++;
    assert.equal(ownB.design.header_shrink, false);
    assert.equal(ownB.design.header_shrink_percent, 75);
    assertions += 2;
    assertions++;
    assertions++;
    assert.equal(ownB.design.header_button, null);
    assertions += 2;
    assert.equal(ownB.design.footer_contact, null);
    assert.notEqual(ownB.design.footer_text, 'Portal principal independiente.');
    assert.equal(ownB.design.footer_note, '');
    assertions += 2;
    assert.deepEqual(ownB.design.footer_socials, []);
    assertions += 2;
    assert.equal(ownB.design_revision, 0);
    assert.equal(ownB.design.hero_media_id, null);
    assertions += 4;
    await call(
      'PATCH',
      '/me/site',
      {
        design: {
          ...ownB.design,
          primary_color: '#701d40',
          hero_title: 'Corredor Rosa',
          hero_media_id: brokerMediaB.id,
        },
        revision: 0,
        advertiser_id: a.id,
      },
      two.access_token,
    );
    assert.equal(
      (await call('GET', '/advertisers/' + a.slug)).site.primary_color,
      '#18436a',
    );
    assertions++;
    await call(
      'PATCH',
      '/admin/advertisers/' + a.id,
      { status: 'suspended' },
      admin,
    );
    await call('GET', '/advertisers/' + a.slug, null, null, 404);
    await call('GET', '/media/' + brokerMediaA.id, null, null, 404);
    const privatePreview = await call(
      'GET',
      '/me/site',
      null,
      one.access_token,
    );
    await call('GET', privatePreview.design.hero_url.slice(4), null, null, 200);
    await call('GET', '/advertisers/' + b.slug);
    await call(
      'PATCH',
      '/admin/advertisers/' + a.id,
      { status: 'approved' },
      admin,
    );
    await call('GET', '/advertisers/' + a.slug);
    await call(
      'PATCH',
      '/me/site',
      {
        design: { ...designA, hero_media_id: null, logo_media_id: null },
        revision: 1,
      },
      one.access_token,
    );
    await call('GET', '/media/' + brokerMediaA.id, null, null, 404);
    await call(
      'DELETE',
      '/manage/media/' + brokerMediaA.id,
      null,
      one.access_token,
    );
    const freshBrokerImage = await call(
      'POST',
      '/manage/media',
      fd,
      one.access_token,
      201,
    );
    await call(
      'PATCH',
      '/me/site',
      {
        design: {
          ...designA,
          hero_media_id: freshBrokerImage.id,
          logo_media_id: freshBrokerImage.id,
          sections: baseBroker.design.sections,
        },
        revision: 2,
      },
      one.access_token,
    );
    await db.query(brokerMigration);
    assert.equal(
      (await call('GET', '/me/site', null, one.access_token)).design_revision,
      3,
    );
    assertions++;
    await call(
      'PATCH',
      `/manage/properties/${p.id}/status`,
      { status: 'published' },
      admin,
    );
    const pB = await call(
      'POST',
      '/manage/properties',
      {
        ...payload,
        title: 'Casa del segundo corredor',
        media_ids: [brokerMediaB.id],
      },
      two.access_token,
      201,
    );
    await call(
      'PATCH',
      `/manage/properties/${pB.id}/status`,
      { status: 'pending_review' },
      two.access_token,
    );
    await call(
      'PATCH',
      `/manage/properties/${pB.id}/status`,
      { status: 'published' },
      admin,
    );
    const listA = await call('GET', '/properties?advertiser_id=' + a.id);
    const listB = await call('GET', '/properties?advertiser_id=' + b.id);
    assert.equal(listA.items.length, 1);
    assert.equal(listA.items[0].id, p.id);
    assert.equal(listB.items.length, 1);
    assert.equal(listB.items[0].id, pB.id);
    assertions += 4;
    const sliderA1 = await call(
      'POST',
      '/manage/media',
      fd,
      one.access_token,
      201,
    );
    const sliderA2 = await call(
      'POST',
      '/manage/media',
      fd,
      one.access_token,
      201,
    );
    await call('GET', '/media/' + sliderA1.id, null, null, 404);
    const currentBroker = await call('GET', '/me/site', null, one.access_token);
    const brokerSlider = {
      ...currentBroker.design,
      hero_mode: 'slider',
      hero_slides: [
        {
          media_id: sliderA1.id,
          alt_text: 'Primera portada',
          copy: {
            title: 'Terraza con texto propio',
            subtitle: 'Primera foto independiente.',
          },
        },
        { media_id: sliderA2.id, alt_text: 'Segunda portada' },
      ],
      hero_interval: 4,
      hero_autoplay: true,
    };
    await call(
      'PATCH',
      '/me/site',
      {
        revision: currentBroker.design_revision,
        design: {
          ...brokerSlider,
          hero_slides: [
            brokerSlider.hero_slides[0],
            { media_id: brokerMediaB.id, alt_text: 'Ajena' },
          ],
        },
      },
      one.access_token,
      403,
    );
    const savedSlider = await call(
      'PATCH',
      '/me/site',
      { revision: currentBroker.design_revision, design: brokerSlider },
      one.access_token,
    );
    assert.equal(savedSlider.design.hero_mode, 'slider');
    assert.equal(savedSlider.design.hero_slides.length, 2);
    assert.ok(savedSlider.design.hero_slides[0].url.includes('signature='));
    assertions += 3;
    const publicSlider = await call('GET', '/advertisers/' + a.slug);
    assert.equal(publicSlider.site.hero_slides[1].media_id, sliderA2.id);
    assert.equal(
      publicSlider.site.hero_slides[0].copy.title,
      'Terraza con texto propio',
    );
    assert.equal(publicSlider.site.hero_slides[1].copy, undefined);
    assertions += 2;
    assert.ok(!publicSlider.site.hero_slides[0].url.includes('signature='));
    assertions += 2;
    await call('GET', '/media/' + sliderA2.id);
    await call(
      'DELETE',
      '/manage/media/' + sliderA2.id,
      null,
      one.access_token,
      409,
    );
    await call(
      'PATCH',
      '/admin/advertisers/' + a.id,
      { status: 'suspended' },
      admin,
    );
    await call('GET', '/media/' + sliderA2.id, null, null, 404);
    await call(
      'PATCH',
      '/admin/advertisers/' + a.id,
      { status: 'approved' },
      admin,
    );
    const clearedSlider = await call(
      'PATCH',
      '/me/site',
      {
        revision: savedSlider.design_revision,
        design: { ...brokerSlider, hero_mode: 'image', hero_slides: [] },
      },
      one.access_token,
    );
    await call('GET', '/media/' + sliderA2.id, null, null, 404);
    await call(
      'DELETE',
      '/manage/media/' + sliderA2.id,
      null,
      one.access_token,
    );
    await call(
      'DELETE',
      '/manage/media/' + sliderA1.id,
      null,
      one.access_token,
    );
    const global1 = await call('POST', '/manage/media', fd, admin, 201);
    const global2 = await call('POST', '/manage/media', fd, admin, 201);
    const currentGlobal = await call('GET', '/settings');
    const globalSlider = {
      ...currentGlobal.design,
      hero_mode: 'slider',
      hero_slides: [
        { media_id: global1.id, alt_text: 'Global uno' },
        {
          media_id: global2.id,
          alt_text: 'Global dos',
          copy: { title: 'Segunda foto del portal', subtitle: '' },
        },
      ],
    };
    await call(
      'PATCH',
      '/admin/design',
      {
        revision: currentGlobal.design_revision,
        design: {
          ...globalSlider,
          hero_slides: [
            globalSlider.hero_slides[0],
            { media_id: brokerMediaB.id, alt_text: 'Ajena' },
          ],
        },
      },
      admin,
      403,
    );
    const savedGlobal = await call(
      'PATCH',
      '/admin/design',
      { revision: currentGlobal.design_revision, design: globalSlider },
      admin,
    );
    await call('GET', '/media/' + global2.id);
    await call('DELETE', '/manage/media/' + global2.id, null, admin, 409);
    const reorderedGlobal = await call(
      'PATCH',
      '/admin/design',
      {
        revision: savedGlobal.design_revision,
        design: {
          ...globalSlider,
          hero_slides: [...globalSlider.hero_slides].reverse(),
        },
      },
      admin,
    );
    assert.equal(reorderedGlobal.design.hero_slides[0].media_id, global2.id);
    assert.equal(
      reorderedGlobal.design.hero_slides[0].copy.title,
      'Segunda foto del portal',
    );
    assertions++;
    assertions++;
    await call(
      'PATCH',
      '/admin/design',
      {
        revision: reorderedGlobal.design_revision,
        design: {
          ...currentGlobal.design,
          hero_mode: 'image',
          hero_slides: [],
        },
      },
      admin,
    );
    await call('GET', '/media/' + global2.id, null, null, 404);
    await call('DELETE', '/manage/media/' + global1.id, null, admin);
    await call('DELETE', '/manage/media/' + global2.id, null, admin);
    // Only our disposable QA schema receives these examples.
    await call('GET', '/admin/examples', null, null, 401);
    await call('GET', '/admin/examples', null, one.access_token, 403);
    await call(
      'POST',
      '/admin/examples',
      { mode: 'published' },
      one.access_token,
      403,
    );
    await call('POST', '/admin/examples', { mode: 'invalid' }, admin, 400);
    const demo = await call(
      'POST',
      '/admin/examples',
      { mode: 'draft' },
      admin,
      201,
    );
    assert.equal(demo.created, 20);
    assert.equal(demo.total, 20);
    assert.equal(demo.published, 0);
    assertions += 3;
    const repeatedDemo = await call(
      'POST',
      '/admin/examples',
      { mode: 'published' },
      admin,
      201,
    );
    assert.equal(repeatedDemo.created, 0);
    assert.equal(repeatedDemo.existing, 20);
    assert.equal(repeatedDemo.published, 0);
    assertions += 3;
    const visibleDemo = await call(
      'PATCH',
      '/admin/examples/publish',
      {},
      admin,
    );
    assert.equal(visibleDemo.published, 20);
    assertions++;
    const feedExamples = await call('GET', '/properties?limit=6');
    assert.ok(feedExamples.total >= 22);
    assert.equal(feedExamples.items.length, 6);
    assertions += 2;
    const demoEntry = feedExamples.items.find((p) => p.is_demo);
    assert.ok(demoEntry);
    assert.equal(demoEntry.media.length, 3);
    assertions += 2;
    const firstDemo = await call('GET', '/properties/' + demoEntry.id);
    assert.equal(firstDemo.is_demo, true);
    assertions++;
    await call(
      'POST',
      '/properties/' + demoEntry.id + '/inquiries',
      {
        name: 'QA',
        email: 'qa@qa.invalid',
        message: 'Consulta de prueba no debe guardarse',
        consent: true,
      },
      null,
      400,
    );
    await call('PATCH', '/admin/examples/pause', {}, one.access_token, 403);
    const pausedDemo = await call('PATCH', '/admin/examples/pause', {}, admin);
    assert.equal(pausedDemo.published, 0);
    assert.equal(pausedDemo.total, 20);
    assertions += 2;
    await call('GET', '/properties/' + demoEntry.id, null, null, 404);
    await call('GET', '/media/' + demoEntry.media[0].id, null, null, 404);
    assert.equal((await call('GET', '/properties/' + p.id)).is_demo, false);
    assertions++;
    const afterPause = await call(
      'POST',
      '/admin/examples',
      { mode: 'published' },
      admin,
      201,
    );
    assert.equal(afterPause.published, 0);
    assertions++;
    await call('PATCH', '/admin/examples/publish', {}, admin);
    console.log(
      JSON.stringify({
        passed: true,
        assertions,
        regions: 16,
        communes: 346,
        migration: 'applied twice; identity and sentinel preserved',
        productionConnections: 0,
      }),
    );
  } finally {
    if (app) app.kill();
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.stack || e.message);
  process.exitCode = 1;
});
