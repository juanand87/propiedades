// Retry ONLY deferred cleanup in the isolated mobile DB and test prefix.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../.."),
  mysql = require(path.join(root, "backend/node_modules/mysql2/promise"));
const { ConfigService } = require(
  path.join(root, "backend/node_modules/@nestjs/config"),
);
const { ImageStorageService } = require(
  path.join(root, "backend/dist/estate/image-storage.service"),
);
async function main() {
  const parsed = require(path.join(root, "backend/node_modules/dotenv")).parse(
    await fs.readFile(path.join(root, "backend/.env"), "utf8"),
  );
  const env = {
    NODE_ENV: "test",
    SPACES_IMAGES_ENABLED: "true",
    SPACES_IMAGES_PREFIX: "propiedades/pruebas/imagenes",
  };
  for (const k of [
    "SPACES_BUCKET",
    "SPACES_REGION",
    "SPACES_ENDPOINT",
    "SPACES_ACCESS_KEY_ID",
    "SPACES_SECRET_ACCESS_KEY",
  ])
    env[k] = parsed[k];
  const storage = new ImageStorageService(new ConfigService(env));
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3327,
    user: "root",
    database: "propiedades",
  });
  try {
    const [[i]] = await db.query("SELECT @@datadir d,@@port port");
    assert.equal(Number(i.port), 3327);
    assert.equal(
      path.resolve(i.d).toLowerCase(),
      path.join(root, "tmp/mobile-local/mysql-data").toLowerCase(),
    );
    const [rows] = await db.query(
      "SELECT o.media_id,o.object_key,o.bucket FROM estate_media_objects o LEFT JOIN estate_media m ON m.id=o.media_id WHERE o.status='pending_delete' AND m.id IS NULL",
    );
    let cleaned = 0;
    for (const row of rows) {
      assert.equal(row.bucket, "propiedades-imagenes");
      assert.ok(row.object_key.startsWith("propiedades/pruebas/imagenes/"));
      await storage.remove(row.object_key);
      await db.query(
        "DELETE FROM estate_media_objects WHERE media_id=? AND status='pending_delete'",
        [row.media_id],
      );
      cleaned++;
    }
    console.log(
      JSON.stringify({
        pending: rows.length,
        cleaned,
        productionDatabaseConnections: 0,
        testPrefixOnly: true,
      }),
    );
  } finally {
    await db.end();
    storage.onModuleDestroy();
  }
}
main().catch(() => {
  console.error(
    "No se pudo completar la limpieza local; revisa el entorno y los permisos de Spaces.",
  );
  process.exitCode = 1;
});
