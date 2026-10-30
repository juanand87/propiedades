const mysql = require('mysql2/promise'),
  path = require('path'),
  crypto = require('crypto'),
  { spawn } = require('child_process');
(async () => {
  const root = path.resolve(__dirname, '../..'),
    db = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3317,
      user: 'root',
      database: 'propiedades',
    });
  const [[server]] = await db.query('SELECT @@datadir location');
  if (
    !String(server.location)
      .replace(/\\/g, '/')
      .toLowerCase()
      .startsWith(
        (root + '/tmp/qa-mysql-data').replace(/\\/g, '/').toLowerCase(),
      )
  )
    throw new Error('Not a QA instance');
  const password = crypto.randomBytes(24).toString('hex');
  await db.query("ALTER USER 'propiedades_qa'@'127.0.0.1' IDENTIFIED BY ?", [
    password,
  ]);
  await db.query(
    "UPDATE properties SET publication_status='published' WHERE code LIKE 'P-%' AND title='Casa de prueba inmobiliaria'",
  );
  await db.end();
  const app = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'backend'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PROJECT_ID: 'propiedades',
      DB_DATABASE: 'propiedades',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3317',
      DB_USERNAME: 'propiedades_qa',
      DB_PASSWORD: password,
      DB_SHARED_HOST: '',
      DB_SHARED_USERNAME: '',
      DB_SSL: 'false',
      DB_SSL_CA: '',
      JWT_SECRET: crypto.randomBytes(48).toString('hex'),
      INTEGRATIONS_ENABLED: 'false',
      SCHEDULED_JOBS_ENABLED: 'false',
      ADMIN_RECOVERY_ENABLED: 'false',
      PORT: '3318',
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  process.on('SIGINT', () => {
    app.kill();
    process.exit();
  });
  process.on('SIGTERM', () => {
    app.kill();
    process.exit();
  });
  app.on('exit', (code) => process.exit(code || 0));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
