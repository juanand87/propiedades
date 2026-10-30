// Explicit bootstrap. Password comes from stdin, never from source or command arguments.
const path = require('node:path'),
  fs = require('node:fs'),
  crypto = require('node:crypto');
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
  const email = String(process.argv[2] || 'admin@propiedades.local')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Correo inválido.');
  let password = '';
  for await (const part of process.stdin) {
    password += part;
    if (password.length > 200) throw new Error('Contraseña demasiado larga.');
  }
  password = password.replace(/\r?\n$/, '');
  if (password.length < 10 || Buffer.byteLength(password) > 72)
    throw new Error(
      'La contraseña debe tener al menos 10 caracteres y hasta 72 bytes.',
    );
  const hash = await require('bcrypt').hash(password, 12);
  password = '';
  installNetworkIsolation(process.env);
  const db = await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'propiedades',
    ssl: getDatabaseSsl(process.env),
  });
  try {
    const [rows] = await db.query('SELECT id,role FROM users WHERE email=?', [
      email,
    ]);
    if (rows.length)
      throw new Error(
        'La cuenta ya existe. No se cambió su contraseña ni su rol.',
      );
    await db.query(
      "INSERT INTO users(id,email,password,firstName,lastName,role,isActive,requirePasswordChange,createdBy,createdAt,updatedAt) VALUES (?,?,?,'Admin','Propiedades','admin',1,0,'self-registration',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
      [crypto.randomUUID(), email, hash],
    );
    console.log('Administrador creado en propiedades: ' + email);
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
