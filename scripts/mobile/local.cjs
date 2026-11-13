// Dedicated sandbox. --spaces-images reads ONLY Spaces credentials, never DB env.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."),
  state = path.join(root, "tmp/mobile-local"),
  datadir = path.join(state, "mysql-data");
const mysql = require(path.join(root, "backend/node_modules/mysql2/promise"));
const bcrypt = require(path.join(root, "backend/node_modules/bcrypt"));
const backendUrl = "http://127.0.0.1:3328/api";
let sqlProcess,
  app,
  db,
  closing = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function stop() {
  if (closing) return;
  closing = true;
  if (app) app.kill();
  if (db) {
    try {
      await db.query("SHUTDOWN");
    } catch {}
    await db.end().catch(() => {});
  } else if (sqlProcess) sqlProcess.kill();
  // SHUTDOWN closes the TCP listener before InnoDB releases its files on Windows.
  if(sqlProcess&&sqlProcess.exitCode===null)await Promise.race([new Promise(resolve=>sqlProcess.once('exit',resolve)),sleep(10000)]);
}
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () => void stop().then(() => process.exit(0)));
function run(exe, args, cwd = root) {
  const r = spawnSync(exe, args, { cwd, windowsHide: true, encoding: "utf8" });
  if (r.status !== 0)
    throw Error(
      `${path.basename(exe)} failed: ${r.stderr || r.stdout || r.error}`,
    );
}
async function request(route, body, token, method = "POST") {
  const form = body instanceof FormData;
  const r = await fetch(backendUrl + route, {
    method,
    headers: {
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw Error(`Local API ${route}: ${value.message}`);
  return value;
}
async function main() {
  if (process.platform !== "win32")
    throw Error("This launcher targets Windows/XAMPP. See mobile/README.md.");
  await fs.mkdir(state, { recursive: true });
  // Refuse occupied ports rather than attaching to an unrelated database or application.
  for (const port of [3327, 3328])
    await new Promise((resolve, reject) => {
      const server = require("node:net").createServer();
      server.once("error", () =>
        reject(
          Error(
            `Port ${port} is busy. Stop the other local mobile session first.`,
          ),
        ),
      );
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  const mysqlBin = "C:/xampp/mysql/bin";
  try {
    await fs.access(path.join(datadir, "mysql"));
  } catch {
    run(path.join(mysqlBin, "mysql_install_db.exe"), [
      `--datadir=${datadir}`,
      "--port=3327",
    ]);
  }
  const output = await fs.open(path.join(state, "mysql.log"), "a");
  sqlProcess = spawn(
    path.join(mysqlBin, "mysqld.exe"),
    [
      "--no-defaults",
      `--basedir=${path.dirname(mysqlBin)}`,
      `--datadir=${datadir}`,
      "--port=3327",
      "--bind-address=127.0.0.1",
      `--log-error=${path.join(state, "mysql-error.log")}`,
    ],
    { windowsHide: true, stdio: ["ignore", output.fd, output.fd] },
  );
  sqlProcess.on("error", (e) => console.error(e.message));
  for (let i = 0; i < 100; i++) {
    try {
      db = await mysql.createConnection({
        host: "127.0.0.1",
        port: 3327,
        user: "root",
        multipleStatements: true,
        charset: "utf8mb4",
      });
      break;
    } catch {
      await sleep(200);
    }
  }
  if (!db)
    throw Error(
      "Local MySQL failed; inspect tmp/mobile-local/mysql-error.log.",
    );
  const [[instance]] = await db.query("SELECT @@datadir location,@@port port");
  if (
    path.resolve(instance.location).toLowerCase() !== datadir.toLowerCase() ||
    Number(instance.port) !== 3327
  )
    throw Error("Refusing a non-mobile database instance.");
  await db.query(
    "CREATE DATABASE IF NOT EXISTS propiedades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
  );
  await db.query(await fs.readFile(path.join(root,'database/REGISTRO_Y_MEMBRESIA.sql'),'utf8'));
  await db.query(
    await fs.readFile(
      path.join(root, "database/ACTUALIZAR_PROPIEDADES.sql"),
      "utf8",
    ),
  );
  await db.query(await fs.readFile(path.join(root,'database/CODIGOS_TERRITORIALES_CHILE.sql'),'utf8'));
  await db.query(
    await fs.readFile(
      path.join(root, "database/VIDEOS_PROPIEDADES_LOCAL.sql"),
      "utf8",
    ),
  );
  await db.query(
    await fs.readFile(
      path.join(root, "database/SPACES_IMAGENES_PROPIEDADES.sql"),
      "utf8",
    ),
  );
  await db.query(
    await fs.readFile(
      path.join(root, "database/SPACES_VIDEOS_PROPIEDADES.sql"),
      "utf8",
    ),
  );
  await db.query(await fs.readFile(path.join(root, 'database/PERFILES_Y_VIDEOS_SOCIALES.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/PLANES_MEMBRESIA.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/RESPUESTAS_VIDEOS.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/MENSAJES_PROPPIX.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/NOTIFICACIONES_Y_PORTADAS.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/NOTIFICACIONES_COMENTARIOS.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/ACTIVIDAD_PROPPIX.sql'), 'utf8'));
  await db.query(await fs.readFile(path.join(root, 'database/BUSQUEDAS_Y_ALERTAS.sql'), 'utf8'));
  const spaces = {
    SPACES_IMAGES_ENABLED: "false",
    SPACES_VIDEOS_ENABLED: "false",
  };
  if (
    process.argv.includes("--spaces-images") ||
    process.argv.includes("--spaces-videos")
  ) {
    const dotenv = require(path.join(root, "backend/node_modules/dotenv"));
    const selected = dotenv.parse(
      await fs.readFile(path.join(root, "backend/.env"), "utf8"),
    );
    for (const k of [
      "SPACES_BUCKET",
      "SPACES_REGION",
      "SPACES_ENDPOINT",
      "SPACES_ACCESS_KEY_ID",
      "SPACES_SECRET_ACCESS_KEY",
    ])
      spaces[k] = selected[k];
    spaces.SPACES_IMAGES_ENABLED = process.argv.includes("--spaces-images")
      ? "true"
      : "false";
    spaces.SPACES_IMAGES_PREFIX = "propiedades/pruebas/imagenes";
    spaces.SPACES_VIDEOS_ENABLED = process.argv.includes("--spaces-videos")
      ? "true"
      : "false";
    spaces.SPACES_VIDEOS_PREFIX = "propiedades/pruebas/videos";
  }
  let credentials;
  try {
    credentials = JSON.parse(
      await fs.readFile(path.join(state, "credentials.json"), "utf8"),
    );
  } catch {
    credentials = {
      email: "mobile-admin@qa.invalid",
      password: crypto.randomBytes(18).toString("base64url"),
    };
    await fs.writeFile(
      path.join(state, "credentials.json"),
      JSON.stringify(credentials, null, 2),
      { flag: "wx" },
    );
  }
  const [[admin]] = await db.query("SELECT id FROM users WHERE email=?", [
    credentials.email,
  ]);
  if (!admin)
    await db.query(
      "INSERT INTO users(id,email,password,firstName,lastName,role,isActive) VALUES (?,?,?,?,?,'admin',1)",
      [
        crypto.randomUUID(),
        credentials.email,
        await bcrypt.hash(credentials.password, 12),
        "Demo",
        "Móvil",
      ],
    );
  const dbPassword = crypto.randomBytes(24).toString("hex");
  await db.query(
    "CREATE USER IF NOT EXISTS 'propiedades_mobile'@'127.0.0.1' IDENTIFIED BY ?",
    [dbPassword],
  );
  await db.query(
    "ALTER USER 'propiedades_mobile'@'127.0.0.1' IDENTIFIED BY ?",
    [dbPassword],
  );
  await db.query(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON propiedades.* TO 'propiedades_mobile'@'127.0.0.1'",
  );
  const env = {
    ...process.env,
    NODE_ENV: "development",
    PROJECT_ID: "propiedades",
    DB_DATABASE: "propiedades",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3327",
    DB_USERNAME: "propiedades_mobile",
    DB_PASSWORD: dbPassword,
    DB_SHARED_HOST: "",
    DB_SHARED_USERNAME: "",
    DB_SSL: "false",
    DB_SSL_CA: "",
    JWT_SECRET: crypto.randomBytes(48).toString("hex"),
    INTEGRATIONS_ENABLED: "false",
    SCHEDULED_JOBS_ENABLED: "false",
    ADMIN_RECOVERY_ENABLED: "false",
    PROPERTY_VIDEOS_ENABLED: "true",
    USER_ONBOARDING_ENABLED: "true",
    SOCIAL_VIDEOS_ENABLED: "true",
    GOOGLE_AUTH_ENABLED: "false",
    PORT: "3328",
    LOCAL_MOBILE_SANDBOX: "true",
    CORS_ORIGINS: "http://localhost:8081,http://127.0.0.1:8081",
    ...spaces,
  };
  const backendLog = await fs.open(path.join(state, "backend.log"), "a");
  app = spawn(process.execPath, ["dist/main.js"], {
    cwd: path.join(root, "backend"),
    env,
    windowsHide: true,
    stdio: ["ignore", backendLog.fd, backendLog.fd],
  });
  app.on("exit", (code) => {
    if (!closing)
      console.error(
        `Local backend stopped (${code}). See tmp/mobile-local/backend.log.`,
      );
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(backendUrl + "/mobile/environment");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(200);
  }
  if (!ready)
    throw Error("Local backend failed; inspect tmp/mobile-local/backend.log.");
  const session = await request("/auth/login", credentials);
  await request("/admin/examples", { mode: "published" }, session.access_token);
  {
    console.log(
      "Checking the 20 local illustrative MP4 clips. Existing videos and edits are preserved.",
    );
    const ffmpeg = require(
      path.join(root, "mobile/node_modules/ffmpeg-static"),
    );
    const rows = await request(
      "/properties?limit=24",
      undefined,
      undefined,
      "GET",
    );
    for (const [i, p] of rows.items.filter((p) => p.is_demo).entries()) {
      const [[existing]] = await db.query(
        "SELECT COUNT(*) n FROM property_videos WHERE property_id=?",
        [p.id],
      );
      if (Number(existing.n)) continue;
      const image = path.join(state, `example-${i}.webp`),
        video = path.join(state, `example-${i}.mp4`);
      const imageUrl = new URL(p.media[0].url, "http://127.0.0.1:3328");
      if (imageUrl.origin !== "http://127.0.0.1:3328")
        throw Error("Non-local demo image refused.");
      await fs.writeFile(
        image,
        Buffer.from(await (await fetch(imageUrl)).arrayBuffer()),
      );
      run(ffmpeg, [
        "-y",
        "-loop",
        "1",
        "-i",
        image,
        "-t",
        "5",
        "-vf",
        "scale=540:960:force_original_aspect_ratio=increase,crop=540:960,zoompan=z=1.03:d=75:s=540x960:fps=15,format=yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-r",
        "15",
        "-movflags",
        "+faststart",
        "-an",
        video,
      ]);
      const form = new FormData();
      form.append("title", `Recorrido ilustrativo · ${p.title}`);
      form.append(
        "file",
        new Blob([await fs.readFile(video)], { type: "video/mp4" }),
        `ejemplo-${i + 1}.mp4`,
      );
      const v = await request(
        `/manage/properties/${p.id}/videos`,
        form,
        session.access_token,
      );
      await request(
        `/manage/videos/${v.id}`,
        { status: "published" },
        session.access_token,
        "PATCH",
      );
      console.log(`Video ${i + 1}/20 linked to its local property.`);
    }
  }
  console.log(
    `\nREADY: ${backendUrl}\nEmulator: http://10.0.2.2:3328/api\nLocal test credentials: tmp/mobile-local/credentials.json\nRun npm run mobile:android in another terminal. Ctrl+C stops this sandbox.\nProduction connections: 0`,
  );
  await new Promise((resolve) => app.once("exit", resolve));
}
main()
  .then(stop)
  .catch(async (e) => {
    console.error(e.message);
    await stop();
    process.exitCode = 1;
  });
