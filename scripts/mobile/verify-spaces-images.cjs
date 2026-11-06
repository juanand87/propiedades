// Real Spaces + local MySQL integration. Never accepts host/DB arguments.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../.."),
  base = "http://127.0.0.1:3328/api";
const mysql = require(path.join(root, "backend/node_modules/mysql2/promise")),
  sharp = require(path.join(root, "backend/node_modules/sharp"));
let assertions = 0;
async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3327,
    user: "root",
    database: "propiedades",
  });
  let token, id, property, originalStatus, otherId, readUrl;
  async function call(
    route,
    {
      method = "GET",
      body,
      auth = token,
      status = 200,
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
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(r.status, status, `${method} ${route.split("?")[0]}`);
    assertions++;
    return r;
  }
  try {
    const [[instance]] = await db.query("SELECT @@datadir d,@@port port");
    assert.equal(Number(instance.port), 3327);
    assert.equal(
      path.resolve(instance.d).toLowerCase(),
      path.join(root, "tmp/mobile-local/mysql-data").toLowerCase(),
    );
    assertions += 2;
    const credentials = JSON.parse(
      await fs.readFile(
        path.join(root, "tmp/mobile-local/credentials.json"),
        "utf8",
      ),
    );
    const session = await (
      await call("/auth/login", {
        method: "POST",
        auth: null,
        status: 201,
        body: credentials,
      })
    ).json();
    token = session.access_token;
    const input = await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#639c8a" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append(
      "file",
      new Blob([input], { type: "image/png" }),
      "Spaces integración.png",
    );
    const uploaded = await (
      await call("/manage/media", { method: "POST", body: form, status: 201 })
    ).json();
    id = uploaded.id;
    assert.match(uploaded.url, /^\/api\/media\//);
    assertions++;
    const [[stored]] = await db.query(
      "SELECT m.size_bytes,OCTET_LENGTH(m.content) bytes,o.object_key,o.status,o.sha256 FROM estate_media m JOIN estate_media_objects o ON o.media_id=m.id WHERE m.id=?",
      [id],
    );
    assert.equal(Number(stored.bytes), 0);
    assert.equal(stored.status, "ready");
    assert.ok(stored.object_key.startsWith("propiedades/pruebas/imagenes/"));
    assertions += 3;
    await call("/media/" + id, { auth: null, status: 404 });
    const preview = await call(uploaded.url.replace("/api", ""), {
      auth: null,
      status: 302,
      redirect: "manual",
    });
    assert.equal(preview.headers.get("cache-control"), "private,no-store");
    assertions++;
    readUrl = preview.headers.get("location");
    const url = new URL(readUrl);
    assert.equal(
      url.hostname,
      "propiedades-imagenes.sfo3.digitaloceanspaces.com",
    );
    assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
    assertions += 2;
    const bytesResponse = await fetch(readUrl, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(bytesResponse.status, 200);
    const bytes = Buffer.from(await bytesResponse.arrayBuffer());
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      stored.sha256,
    );
    assert.equal(bytes.length, Number(stored.size_bytes));
    assertions += 3;
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    assertions++;
    const unsigned = await fetch(
      `https://${url.hostname}/${stored.object_key}`,
      { method: "HEAD", signal: AbortSignal.timeout(20000) },
    );
    assert.ok([401, 403].includes(unsigned.status));
    assertions++;
    const library = await (await call("/manage/media")).json();
    assert.ok(library.some((m) => m.id === id));
    assertions++;
    const address = `spaces-${crypto.randomUUID()}@qa.invalid`,
      password = crypto.randomBytes(18).toString("base64url");
    await call("/auth/register", {
      method: "POST",
      auth: null,
      status: 201,
      body: { email: address, password, firstName: "Spaces", lastName: "QA" },
    });
    const other = await (
      await call("/auth/login", {
        method: "POST",
        auth: null,
        status: 201,
        body: { email: address, password },
      })
    ).json();
    otherId = other.user.id;
    // A signature for the other user does not authorize this owner's private file.
    await call("/manage/media/" + id, {
      method: "DELETE",
      auth: other.access_token,
      status: 403,
    });
    const otherForm = new FormData();
    otherForm.append(
      "file",
      new Blob([input], { type: "image/png" }),
      "otra.png",
    );
    const otherMedia = await (
      await call("/manage/media", {
        method: "POST",
        auth: other.access_token,
        body: otherForm,
        status: 201,
      })
    ).json();
    try {
      const signature = new URL(
        otherMedia.url,
        "http://localhost",
      ).searchParams.get("signature");
      await call(
        "/media/" + id + "?signature=" + encodeURIComponent(signature),
        { auth: null, status: 404 },
      );
    } finally {
      await call("/manage/media/" + otherMedia.id, {
        method: "DELETE",
        auth: other.access_token,
      });
    }
    const [[p]] = await db.query(
      "SELECT id,publication_status FROM properties WHERE publication_status='published' LIMIT 1",
    );
    property = p.id;
    await db.query(
      "INSERT INTO property_media(property_id,media_id,sort_order,alt_text) VALUES (?,?,99,?)",
      [property, id, "Imagen temporal de integración Spaces"],
    );
    await call("/media/" + id, { auth: null, status: 302, redirect: "manual" });
    const detail = await (
      await call("/properties/" + property, { auth: null })
    ).json();
    assert.ok(detail.media.some((m) => m.id === id));
    assertions++;
    await call("/manage/media/" + id, { method: "DELETE", status: 409 });
    originalStatus = p.publication_status;
    await db.query(
      "UPDATE properties SET publication_status='paused' WHERE id=?",
      [property],
    );
    await call("/media/" + id, { auth: null, status: 404 });
    await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
      originalStatus,
      property,
    ]);
    originalStatus = undefined;
    await db.query(
      "DELETE FROM property_media WHERE property_id=? AND media_id=?",
      [property, id],
    );
    await call("/manage/media/" + id, { method: "DELETE" });
    await call("/media/" + id, { auth: null, status: 404 });
    const missing = await fetch(readUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(20000),
    });
    assert.ok([403, 404].includes(missing.status));
    assertions++;
    const [[refs]] = await db.query(
      "SELECT COUNT(*) n FROM estate_media_objects WHERE media_id=?",
      [id],
    );
    assert.equal(Number(refs.n), 0);
    assertions++;
    id = undefined;
    // Existing DB-backed photos still work with Spaces enabled.
    const [[old]] = await db.query(
      "SELECT m.id FROM estate_media m JOIN property_media pm ON pm.media_id=m.id JOIN properties p ON p.id=pm.property_id WHERE OCTET_LENGTH(m.content)>0 AND p.publication_status='published' LIMIT 1",
    );
    const legacy = await call("/media/" + old.id, { auth: null });
    assert.equal(legacy.headers.get("content-type"), "image/webp");
    assertions++;
    console.log(
      JSON.stringify({
        result: "PASS",
        assertions,
        privateUpload: true,
        webAndAppUrlsUnchanged: true,
        legacyImagesReadable: true,
        publicationPermissionsChecked: true,
        objectsCleaned: true,
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
    if (id) {
      await db.query("DELETE FROM property_media WHERE media_id=?", [id]);
      if (token)
        await fetch(base + "/manage/media/" + id, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        }).catch(() => {});
    }
    if (otherId)
      await db.query("UPDATE users SET isActive=0 WHERE id=?", [otherId]);
    await db.end();
  }
}
main().catch((e) => {
  console.error(
    "Spaces image integration failed:",
    e.name,
    e.message?.replace(/signature=[^\s]+/g, "signature=[hidden]"),
  );
  process.exitCode = 1;
});
