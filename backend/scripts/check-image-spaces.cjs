// Reads ONLY image Spaces credentials. No database imports or connections.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config'),
  dotenv = require('dotenv'),
  sharp = require('sharp');
const { ImageStorageService } = require('../dist/estate/image-storage.service');
const { imageSpacesConfig } = require('../dist/config/image-spaces');
const { installNetworkIsolation } = require('../dist/config/project-isolation');
async function main() {
  const parsed = dotenv.parse(
    await fs.readFile(path.resolve(__dirname, '../.env'), 'utf8'),
  );
  const env = {
    NODE_ENV: 'test',
    SPACES_IMAGES_ENABLED: 'true',
    SPACES_IMAGES_PREFIX: 'propiedades/pruebas/imagenes',
    INTEGRATIONS_ENABLED: 'false',
  };
  for (const k of [
    'SPACES_BUCKET',
    'SPACES_REGION',
    'SPACES_ENDPOINT',
    'SPACES_ACCESS_KEY_ID',
    'SPACES_SECRET_ACCESS_KEY',
  ])
    env[k] = parsed[k];
  imageSpacesConfig(env);
  installNetworkIsolation(env);
  const storage = new ImageStorageService(new ConfigService(env));
  const key = storage.objectKey(crypto.randomUUID());
  let attempted = false,
    cleaned = false;
  try {
    const bytes = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#749579' },
    })
      .webp()
      .toBuffer();
    attempted = true;
    await storage.put(key, bytes);
    const signed = await storage.signedRead(key);
    const response = await fetch(signed, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const anonymous = await fetch(
      `https://propiedades-imagenes.sfo3.digitaloceanspaces.com/${key}`,
      { method: 'HEAD', signal: AbortSignal.timeout(20000) },
    );
    assert.ok(
      [401, 403].includes(anonymous.status),
      'The image must remain private',
    );
    await storage.remove(key);
    cleaned = true;
    const missing = await fetch(await storage.signedRead(key), {
      method: 'HEAD',
      signal: AbortSignal.timeout(20000),
    });
    assert.ok([403, 404].includes(missing.status));
    console.log(
      JSON.stringify({
        result: 'PASS',
        bucket: 'propiedades-imagenes',
        region: 'sfo3',
        upload: true,
        private: true,
        signedRead: true,
        bytesVerified: true,
        deleted: true,
        databaseConnections: 0,
        testPrefixOnly: true,
      }),
    );
  } catch (e) {
    console.error(
      'Spaces image check failed:',
      e?.name || 'Error',
      '; verify bucket permissions and credentials. No secrets printed.',
    );
    process.exitCode = 1;
  } finally {
    if (attempted && !cleaned) {
      try {
        await storage.remove(key);
        console.log('Temporary check image removed.');
      } catch {
        console.error('Temporary check object needs cleanup:', key);
      }
    }
    storage.onModuleDestroy();
  }
}
main().catch(() => {
  console.error(
    'No se pudo cargar la configuración exclusiva de Spaces. No se consultó ninguna BD.',
  );
  process.exitCode = 1;
});
