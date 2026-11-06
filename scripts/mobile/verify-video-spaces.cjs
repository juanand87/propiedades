const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../.."),
  mysql = require(path.join(root, "backend/node_modules/mysql2/promise")),
  base = "http://127.0.0.1:3328/api";
let assertions = 0;
async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3327,
    user: "root",
    database: "propiedades",
  });
  let property, originalStatus, otherId, token;
  const ids = [];
  async function call(
    route,
    {
      method = "GET",
      body,
      auth = token,
      status = 200,
      headers = {},
      redirect = "follow",
    } = {},
  ) {
    const form = body instanceof FormData;
    const r = await fetch(base + route, {
      method,
      redirect,
      headers: {
        ...(auth ? { Authorization: "Bearer " + auth } : {}),
        ...(body && !form ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(90000),
    });
    assert.equal(r.status, status, route.split("?")[0]);
    assertions++;
    return r;
  }
  try {
    const [[i]] = await db.query("SELECT @@datadir d,@@port p");
    assert.equal(Number(i.p), 3327);
    assert.equal(
      path.resolve(i.d).toLowerCase(),
      path.join(root, "tmp/mobile-local/mysql-data").toLowerCase(),
    );
    assertions += 2;
    const env = await (
      await call("/mobile/environment", { auth: null })
    ).json();
    assert.equal(env.videoStorage, "spaces");
    assertions++;
    const credentials = JSON.parse(
      await fs.readFile(
        path.join(root, "tmp/mobile-local/credentials.json"),
        "utf8",
      ),
    );
    token = (
      await (
        await call("/auth/login", {
          method: "POST",
          auth: null,
          body: credentials,
          status: 201,
        })
      ).json()
    ).access_token;
    const [[p]] = await db.query(
      "SELECT p.id,p.publication_status FROM properties p LEFT JOIN property_videos v ON v.property_id=p.id AND v.status<>'archived' WHERE p.publication_status='published' GROUP BY p.id HAVING COUNT(v.id)<=1 LIMIT 1",
    );
    assert.ok(p);
    property = p.id;
    const bytes = await fs.readFile(
      path.join(root, "tmp/mobile-local/example-0.mp4"),
    );
    async function upload(
      key = crypto.randomUUID(),
      publish = true,
      title = "Recorrido Spaces QA",
      expected = 201,
    ) {
      const form = new FormData();
      form.append("title", title);
      form.append("capture_seconds", "15");
      form.append("request_id", key);
      form.append("publish", String(publish));
      form.append(
        "file",
        new Blob([bytes], { type: "video/mp4" }),
        "recorrido.mp4",
      );
      const v = await (
        await call(`/manage/properties/${property}/videos`, {
          method: "POST",
          body: form,
          status: expected,
        })
      ).json();
      if (v.id && !ids.includes(v.id)) ids.push(v.id);
      return v;
    }
    const key = crypto.randomUUID(),
      v = await upload(key);
    assert.equal(v.property_id, property);
    assert.equal(v.status, "published");
    assert.ok(v.duration_ms > 0);
    assertions += 3;
    const [[object]] = await db.query(
      "SELECT * FROM property_video_objects WHERE video_id=?",
      [v.id],
    );
    assert.equal(object.status, "ready");
    assert.ok(object.object_key.startsWith("propiedades/pruebas/videos/"));
    assert.equal(object.bucket, "propiedades-imagenes");
    assertions += 3;
    let localExists = true;
    try {
      await fs.access(path.join(root, "tmp/mobile-videos", v.id + ".mp4"));
    } catch {
      localExists = false;
    }
    assert.equal(localExists, false);
    assertions++;
    const response = await call(`/videos/${v.id}/content`, {
      auth: null,
      status: 307,
      redirect: "manual",
    });
    const signed = response.headers.get("location"),
      url = new URL(signed);
    assert.equal(
      url.hostname,
      "propiedades-imagenes.sfo3.digitaloceanspaces.com",
    );
    assert.equal(url.searchParams.get("X-Amz-Expires"), "120");
    assertions += 2;
    const file = await fetch(signed, { signal: AbortSignal.timeout(20000) });
    assert.equal(file.status, 200);
    assert.equal(
      crypto
        .createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex"),
      object.sha256,
    );
    assertions += 2;
    const anonymous = await fetch(
      `https://${url.hostname}/${object.object_key}`,
      { method: "HEAD", signal: AbortSignal.timeout(20000) },
    );
    assert.ok([401, 403].includes(anonymous.status));
    assertions++;
    const range = await call(`/videos/${v.id}/content`, {
      auth: null,
      headers: { Range: "bytes=0-31" },
      status: 206,
    });
    assert.equal((await range.arrayBuffer()).byteLength, 32);
    assertions++;
    const head = await call(`/videos/${v.id}/content`, {
      auth: null,
      method: "HEAD",
    });
    assert.equal(head.headers.get("content-type"), "video/mp4");
    assertions++;
    await call(`/videos/${v.id}/content`, {
      auth: null,
      headers: { Range: "bytes=999999999-" },
      status: 416,
    });
    const feed = await (await call("/videos", { auth: null })).json();
    assert.ok(
      feed.items.some((x) => x.id === v.id && x.property.id === property),
    );
    assertions++;
    const before = await db.query(
      "SELECT COUNT(*) n FROM property_video_objects",
    );
    const again = await upload(key);
    assert.equal(again.id, v.id);
    assert.equal(again.reused, true);
    const after = await db.query(
      "SELECT COUNT(*) n FROM property_video_objects",
    );
    assert.equal(before[0][0].n, after[0][0].n);
    assertions += 3;
    await upload(key, true, "Different title", 409);
    const email = `video-spaces-${crypto.randomUUID()}@qa.invalid`,
      password = crypto.randomBytes(20).toString("base64url");
    await call("/auth/register", {
      method: "POST",
      auth: null,
      status: 201,
      body: { email, password, firstName: "Video", lastName: "Spaces" },
    });
    const other = await (
      await call("/auth/login", {
        method: "POST",
        auth: null,
        status: 201,
        body: { email, password },
      })
    ).json();
    otherId = other.user.id;
    await call(`/manage/videos/${v.id}`, {
      method: "PATCH",
      auth: other.access_token,
      status: 403,
      body: { status: "draft" },
    });
    originalStatus = p.publication_status;
    await db.query(
      "UPDATE properties SET publication_status='paused' WHERE id=?",
      [property],
    );
    await call(`/videos/${v.id}/content`, { auth: null, status: 404 });
    await upload(crypto.randomUUID(), true, "Paused property", 400);
    await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
      originalStatus,
      property,
    ]);
    originalStatus = undefined;
    const draft = await upload(crypto.randomUUID(), false, "Draft private");
    await call(`/videos/${draft.id}/content`, { auth: null, status: 404 });
    await call(`/manage/videos/${v.id}`, {
      method: "PATCH",
      body: { status: "archived" },
    });
    await call(`/videos/${v.id}/content`, { auth: null, status: 404 });
    const deleted = await fetch(signed, {
      method: "HEAD",
      signal: AbortSignal.timeout(20000),
    });
    assert.ok([403, 404].includes(deleted.status));
    assertions++;
    console.log(
      JSON.stringify({
        result: "PASS",
        assertions,
        storage: "spaces",
        private: true,
        rangeStreaming: true,
        idempotent: true,
        localTemporaryFileRemoved: true,
        productionDatabaseConnections: 0,
        testPrefixOnly: true,
      }),
    );
  } finally {
    if (originalStatus)
      await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
        originalStatus,
        property,
      ]);
    const parsed = require(
      path.join(root, "backend/node_modules/dotenv"),
    ).parse(await fs.readFile(path.join(root, "backend/.env"), "utf8"));
    const env = {
      NODE_ENV: "test",
      SPACES_VIDEOS_ENABLED: "true",
      SPACES_VIDEOS_PREFIX: "propiedades/pruebas/videos",
    };
    for (const k of [
      "SPACES_BUCKET",
      "SPACES_REGION",
      "SPACES_ENDPOINT",
      "SPACES_ACCESS_KEY_ID",
      "SPACES_SECRET_ACCESS_KEY",
    ])
      env[k] = parsed[k];
    const { ConfigService } = require(
        path.join(root, "backend/node_modules/@nestjs/config"),
      ),
      { VideoStorageService } = require(
        path.join(root, "backend/dist/estate/video-storage.service"),
      );
    const storage = new VideoStorageService(new ConfigService(env));
    try {
      for (const id of ids) {
        await db.query(
          "UPDATE property_videos SET status='archived' WHERE id=?",
          [id],
        );
        const [[o]] = await db.query(
          "SELECT object_key,bucket FROM property_video_objects WHERE video_id=?",
          [id],
        );
        if (o) {
          assert.equal(o.bucket, "propiedades-imagenes");
          assert.ok(o.object_key.startsWith("propiedades/pruebas/videos/"));
          await storage.remove(o.object_key);
          await db.query(
            "DELETE FROM property_video_objects WHERE video_id=?",
            [id],
          );
        }
      }
    } finally {
      storage.onModuleDestroy();
      if (otherId)
        await db.query("UPDATE users SET isActive=0 WHERE id=?", [otherId]);
      await db.end();
    }
  }
}
main().catch((e) => {
  console.error(
    "Video Spaces integration failed:",
    e.name,
    e.message?.split("?")[0],
  );
  process.exitCode = 1;
});
