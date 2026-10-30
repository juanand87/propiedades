// Explicit migration runner: normal application startup never executes DDL.
const path = require('node:path'),
  fs = require('node:fs');
require('dotenv').config({
  path: path.join(__dirname, '../.env'),
  quiet: true,
});
const compiled = fs.existsSync(
  path.join(__dirname, '../dist/config/project-isolation.js'),
);
if (!compiled) require('ts-node/register/transpile-only');
const base = path.join(
  __dirname,
  compiled ? '../dist/config' : '../src/config',
);
const { validateProjectEnvironment, installNetworkIsolation } = require(
  path.join(base, 'project-isolation'),
);
const { getDatabaseSsl } = require(path.join(base, 'database-ssl'));
async function main() {
  validateProjectEnvironment(process.env);
  if (process.env.INTEGRATIONS_ENABLED === 'true')
    throw new Error('Apaga las integraciones antes de migrar.');
  const files = ['estate-schema.sql'];
  if (!process.argv.includes('--apply')) {
    console.log(
      'Plan: aplicar ' +
        files.join(', ') +
        ' solo en propiedades. No se realizó ninguna conexión. No se eliminan tablas ni cuentas.',
    );
    return;
  }
  installNetworkIsolation(process.env);
  const mysql = require('mysql2/promise');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'propiedades',
    ssl: getDatabaseSsl(process.env),
    multipleStatements: true,
  });
  try {
    const [[identity]] = await db.query('SELECT DATABASE() name');
    if (identity.name !== 'propiedades') throw new Error('Esquema incorrecto.');
    for (const file of files) {
      const source = path.join(__dirname, file);
      if (!fs.existsSync(source))
        throw new Error(
          'Falta ' +
            file +
            '. Usa el SQL entregado o copia database al despliegue.',
        );
      await db.query(fs.readFileSync(source, 'utf8'));
    }
    console.log(
      'Esquema inmobiliario actualizado. No se copió información musical ni se crearon usuarios.',
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
