// Integration checks against the dedicated mobile sandbox, never production.
const assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../.."),
  origin = "http://127.0.0.1:3328/api";
const mysql = require(path.join(root, "backend/node_modules/mysql2/promise"));
let assertions = 0;
async function call(
  route,
  { method = "GET", body, token, status = 200, headers = {} } = {},
) {
  const form = body instanceof FormData;
  const r = await fetch(origin + route, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  assert.equal(r.status, status, `${method} ${route}`);
  assertions++;
  return r;
}
async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3327,
    user: "root",
    database: "propiedades",
  });
  let video, property, originalStatus, otherId;
  try {
    const [[instance]] = await db.query("SELECT @@datadir d,@@port port");
    assert.equal(Number(instance.port), 3327);
    assert.equal(
      path.resolve(instance.d).toLowerCase(),
      path.join(root, "tmp/mobile-local/mysql-data").toLowerCase(),
    );
    assertions += 2;
    const env = await (await call("/mobile/environment")).json();
    assert.equal(env.environment, "local-mobile");
    assertions++;
    const credentials = JSON.parse(
      await fs.readFile(
        path.join(root, "tmp/mobile-local/credentials.json"),
        "utf8",
      ),
    );
    const admin = await (
      await call("/auth/login", {
        method: "POST",
        body: credentials,
        status: 201,
      })
    ).json();
    const feed = await (await call("/videos")).json();
    assert.ok(feed.total >= 20);
    assert.equal(feed.items.length, 5);
    assertions += 2;
    const allIds = new Set();
    for (let page = 1; page <= feed.pages; page++) {
      const result = await (await call("/videos?page=" + page)).json();
      for (const v of result.items) {
        assert.ok(!allIds.has(v.id));
        allIds.add(v.id);
        assert.equal(v.property_id, v.property.id);
        assert.ok(v.property.is_demo);
        assert.ok(!("created_by" in v));
        assertions += 4;
      }
    }
    const v = feed.items[0];
    property = v.property_id;
    const detail = await (await call("/properties/" + property)).json();
    assert.equal(detail.title, v.property.title);
    assertions++;
    const stream = await call(v.url.replace("/api", ""), {
      headers: { Range: "bytes=0-31" },
      status: 206,
    });
    assert.match(stream.headers.get("content-range"), /^bytes 0-31\/\d+$/);
    assert.equal((await stream.arrayBuffer()).byteLength, 32);
    assertions += 2;
    const suffix = await call(`/videos/${v.id}/content`, {
      headers: { Range: "bytes=-20" },
      status: 206,
    });
    assert.equal((await suffix.arrayBuffer()).byteLength, 20);
    assertions++;
    const head = await call(`/videos/${v.id}/content`, { method: "HEAD" });
    assert.equal(head.headers.get("content-type"), "video/mp4");
    assertions++;
    await call(`/videos/${v.id}/content`, {
      headers: { Range: "bytes=999999999-" },
      status: 416,
    });
    await call(`/videos/${v.id}/content`, {
      headers: { Range: "bytes=0-1,3-4" },
      status: 416,
    });
    await call(`/manage/properties/${property}/videos`, { status: 401 });
    const otherEmail = `video-qa-${crypto.randomUUID()}@qa.invalid`;
    await call("/auth/register", {
      method: "POST",
      status: 201,
      body: {
        email: otherEmail,
        password: "Video-qa-local-2026!",
        firstName: "Video",
        lastName: "QA",
      },
    });
    const other = await (
      await call("/auth/login", {
        method: "POST",
        status: 201,
        body: { email: otherEmail, password: "Video-qa-local-2026!" },
      })
    ).json();
    otherId = other.user.id;
    await call(`/manage/properties/${property}/videos`, {
      token: other.access_token,
      status: 403,
    });
    await call(`/manage/videos/${v.id}`, {
      method: "PATCH",
      token: other.access_token,
      body: { status: "draft" },
      status: 403,
    });
    const invalid = new FormData();
    invalid.append("title", "Invalid");
    invalid.append(
      "file",
      new Blob(["fake"], { type: "video/mp4" }),
      "fake.mp4",
    );
    await call(`/manage/properties/${property}/videos`, {
      method: "POST",
      token: admin.access_token,
      body: invalid,
      status: 400,
    });
    const clip = await fs.readFile(
      path.join(root, "tmp/mobile-local/example-0.mp4"),
    );
    const form = new FormData();
    form.append("title", "Recorrido de prueba de integración");
    form.append("file", new Blob([clip], { type: "video/mp4" }), "local.mp4");
    video = await (
      await call(`/manage/properties/${property}/videos`, {
        method: "POST",
        token: admin.access_token,
        body: form,
        status: 201,
      })
    ).json();
    assert.equal(video.property_id, property);
    assert.equal(video.status, "draft");
    assertions += 2;
    await call(`/videos/${video.id}/content`, { status: 404 });
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: other.access_token,
      body: { status: "published" },
      status: 403,
    });
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: admin.access_token,
      body: { status: "invalid" },
      status: 400,
    });
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: admin.access_token,
      body: { title: "" },
      status: 400,
    });
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: admin.access_token,
      body: { title: "Título actualizado", status: "published" },
    });
    await call(`/videos/${video.id}/content`, {
      headers: { Range: "bytes=0-15" },
      status: 206,
    });
    const [[p]] = await db.query(
      "SELECT publication_status FROM properties WHERE id=?",
      [property],
    );
    originalStatus = p.publication_status;
    await db.query(
      "UPDATE properties SET publication_status='paused' WHERE id=?",
      [property],
    );
    await call(`/videos/${video.id}/content`, { status: 404 });
    const hidden = await (await call("/videos")).json();
    assert.ok(hidden.items.every((x) => x.property_id !== property));
    assertions++;
    await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
      originalStatus,
      property,
    ]);
    originalStatus = undefined;
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: admin.access_token,
      body: { status: "archived" },
    });
    await call(`/videos/${video.id}/content`, { status: 404 });
    const listed = await (
      await call(`/manage/properties/${property}/videos`, {
        token: admin.access_token,
      })
    ).json();
    assert.ok(!listed.some((x) => x.id === video.id));
    assertions++;
    await call(`/manage/videos/${video.id}`, {
      method: "PATCH",
      token: admin.access_token,
      body: { status: "published" },
      status: 404,
    });
    console.log(
      JSON.stringify({
        assertions,
        productionConnections: 0,
        linkedDemoVideos: 20,
        result: "PASS",
      }),
    );
  } finally {
    if (originalStatus)
      await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
        originalStatus,
        property,
      ]);
    if (video)
      await db.query(
        "UPDATE property_videos SET status='archived' WHERE id=?",
        [video.id],
      );
    if (otherId)
      await db.query("UPDATE users SET isActive=0 WHERE id=?", [otherId]);
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
