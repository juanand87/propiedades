// Recording/publish tests use ONLY the dedicated mobile instance, never a remote URL.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."),
  mysql = require(path.join(root, "backend/node_modules/mysql2/promise")),
  ffmpeg = require(path.join(root, "mobile/node_modules/ffmpeg-static"));
const base = "http://127.0.0.1:3328/api";
let assertions = 0;
async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3327,
    user: "root",
    database: "propiedades",
  });
  let property, originalStatus;
  const created = [];
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
    const login = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(login.status, 201);
    assertions++;
    const session = await login.json();
    const [[candidate]] = await db.query(
      "SELECT p.id,p.publication_status FROM properties p LEFT JOIN property_videos v ON v.property_id=p.id AND v.status<>'archived' WHERE p.publication_status='published' GROUP BY p.id HAVING COUNT(v.id)<=1 LIMIT 1",
    );
    assert.ok(candidate);
    property = candidate.id;
    originalStatus = candidate.publication_status;
    async function send(
      duration,
      mode = duration,
      key = crypto.randomUUID(),
      title = "Recorrido grabado de prueba",
      publish = true,
      expected = 201,
    ) {
      const filename = path.join(
        root,
        `tmp/mobile-local/record-${duration}.mp4`,
      );
      try {
        await fs.access(filename);
      } catch {
        const r = spawnSync(
          ffmpeg,
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=teal:size=120x216:rate=5",
            "-t",
            String(duration),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            filename,
          ],
          { windowsHide: true, encoding: "utf8" },
        );
        assert.equal(r.status, 0, r.stderr);
        assertions++;
      }
      const form = new FormData();
      form.append("title", title);
      form.append("capture_seconds", String(mode));
      form.append("publish", String(publish));
      form.append("request_id", key);
      form.append(
        "file",
        new Blob([await fs.readFile(filename)], { type: "video/mp4" }),
        "grabado.mp4",
      );
      const r = await fetch(base + `/manage/properties/${property}/videos`, {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
        body: form,
      });
      const value = await r.json();
      assert.equal(r.status, expected, JSON.stringify(value));
      assertions++;
      if (r.ok && !created.includes(value.id)) created.push(value.id);
      return value;
    }
    for (const seconds of [15, 30, 45]) {
      const key = crypto.randomUUID(),
        v = await send(seconds, seconds, key);
      assert.equal(v.status, "published");
      assert.ok(Math.abs(v.duration_ms - seconds * 1000) <= 750);
      assert.equal(v.property_id, property);
      assertions += 3;
      const retry = await send(seconds, seconds, key);
      assert.equal(retry.id, v.id);
      assert.equal(retry.reused, true);
      assertions += 2;
      const feed = await (await fetch(base + "/videos")).json();
      assert.ok(
        feed.items.some((x) => x.id === v.id && x.property.id === property),
      );
      assertions++;
      await send(seconds, seconds, key, "Texto diferente", true, 409);
      await db.query(
        "UPDATE property_videos SET status='archived' WHERE id=?",
        [v.id],
      );
    }
    await send(46, 45, crypto.randomUUID(), "Demasiado largo", true, 400);
    await send(
      30,
      15,
      crypto.randomUUID(),
      "Supera el modo seleccionado",
      true,
      400,
    );
    await send(15, 20, crypto.randomUUID(), "Modo inválido", true, 400);
    await db.query(
      "UPDATE properties SET publication_status='paused' WHERE id=?",
      [property],
    );
    const key = crypto.randomUUID();
    await send(15, 15, key, "Propiedad pausada", true, 400);
    const [[missing]] = await db.query(
      "SELECT COUNT(*) n FROM property_video_recordings WHERE request_id=?",
      [key],
    );
    assert.equal(Number(missing.n), 0);
    assertions++;
    const draft = await send(
      15,
      15,
      crypto.randomUUID(),
      "Borrador de propiedad pausada",
      false,
    );
    assert.equal(draft.status, "draft");
    assertions++;
    await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
      originalStatus,
      property,
    ]);
    originalStatus = undefined;
    const requestId = crypto.randomUUID();
    const [one, two] = await Promise.all([
      send(15, 15, requestId, "Publicación concurrente"),
      send(15, 15, requestId, "Publicación concurrente"),
    ]);
    assert.equal(one.id, two.id);
    assert.ok(one.reused || two.reused);
    assertions += 2;
    console.log(
      JSON.stringify({
        result: "PASS",
        assertions,
        recordingModes: [15, 30, 45],
        actualDurationChecked: true,
        idempotent: true,
        productionConnections: 0,
      }),
    );
  } finally {
    if (originalStatus)
      await db.query("UPDATE properties SET publication_status=? WHERE id=?", [
        originalStatus,
        property,
      ]);
    for (const id of created)
      await db.query(
        "UPDATE property_videos SET status='archived' WHERE id=?",
        [id],
      );
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
