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
          logo_media_id: adminMedia.id,
          hero_media_id: adminMedia.id,
          sections: [...initialDesign.design.sections]
            .reverse()
            .map((s) => (s.id === 'types' ? { ...s, visible: false } : s)),
        },
      },
      admin,
    );
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
        { media_id: sliderA1.id, alt_text: 'Primera portada' },
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
        { media_id: global2.id, alt_text: 'Global dos' },
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
  console.error(e.message);
  process.exitCode = 1;
});
