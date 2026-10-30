// Run from backend: node scripts/init-properties-db.cjs [--apply]
// Does not import legacy dumps, accounts, credentials or marketplace settings.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('ts-node/register/transpile-only');
const { DataSource } = require('typeorm');
const { validateProjectEnvironment, installNetworkIsolation } = require('../src/config/project-isolation');
const { getDatabaseSsl } = require('../src/config/database-ssl');

async function main() {
  validateProjectEnvironment(process.env);
  if (process.env.INTEGRATIONS_ENABLED === 'true') throw new Error('Desactiva las integraciones antes de inicializar.');
  if (!process.argv.includes('--apply')) {
    console.log('Plan: crear únicamente tablas del código actual en propiedades, si está vacía. No se realizó ninguna conexión. Usa --apply para ejecutar.');
    return;
  }
  installNetworkIsolation(process.env);
  const db = new DataSource({
    type: 'mysql', host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: 'propiedades', charset: 'utf8mb4', synchronize: false,
    ssl: getDatabaseSsl(process.env),
    entities: [path.join(__dirname, '../src/**/*.entity.ts')],
  });
  await db.initialize();
  try {
    const [row] = await db.query('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()');
    if (Number(row.total) !== 0) throw new Error('BD no vacía: no se modifica. Usa migraciones revisadas para continuar.');
    await db.synchronize(false);
    console.log('Esquema inicial creado. No se copiaron datos ni se crearon cuentas.');
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
