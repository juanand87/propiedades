const fs = require("node:fs"),
  path = require("node:path"),
  { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const sdk =
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || "", "Android/Sdk");
const adb = path.join(sdk, "platform-tools/adb.exe"),
  emulator = path.join(sdk, "emulator/emulator.exe");
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  // Use Android CLI's device location without changing global Windows variables.
  ANDROID_AVD_HOME: path.join(
    process.env.ANDROID_USER_HOME ||
      path.join(process.env.USERPROFILE, ".android"),
    "avd",
  ),
  EXPO_PUBLIC_API_URL: "http://10.0.2.2:3328/api",
};
async function main() {
  if (!fs.existsSync(adb) || !fs.existsSync(emulator))
    throw Error(
      "Install Android Studio and its SDK first. See mobile/README.md.",
    );
  const health = await fetch("http://127.0.0.1:3328/api/mobile/environment")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (health?.environment !== "local-mobile")
    throw Error("Start npm run mobile:backend first.");
  const devices =
    spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true })
      .stdout || "";
  if (!/^emulator-\d+\s+device$/m.test(devices)) {
    const avds = spawnSync(emulator, ["-list-avds"], {
      env,
      encoding: "utf8",
      windowsHide: true,
    })
      .stdout.split(/\r?\n/)
      .filter(Boolean);
    const phone = avds.find(
      (name) =>
        name === "medium_phone" ||
        name.toLowerCase().startsWith("medium_phone"),
    );
    if (!phone)
      throw Error(
        "Create the medium_phone AVD using npm run mobile:setup-android.",
      );
    const emu = spawn(
      emulator,
      ["-avd", phone, "-no-snapshot-load", "-no-boot-anim"],
      { env, windowsHide: true, stdio: "ignore", detached: true },
    );
    emu.unref();
    console.log("Starting medium_phone. Waiting for Android…");
    let booted = false;
    for (let i = 0; i < 150; i++) {
      const r = spawnSync(
        adb,
        ["-e", "shell", "getprop", "sys.boot_completed"],
        { encoding: "utf8", windowsHide: true },
      );
      if (r.stdout?.trim() === "1") {
        booted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!booted)
      throw Error(
        "Emulator did not boot. Check virtualization and available memory.",
      );
  }
  spawnSync(adb, ["-e", "reverse", "tcp:8081", "tcp:8081"], {
    windowsHide: true,
  });
  const expo = path.join(root, "mobile/node_modules/expo/bin/cli");
  const app = spawn(
    process.execPath,
    [expo, "start", "--android", "--localhost"],
    {
      cwd: path.join(root, "mobile"),
      env,
      windowsHide: true,
      stdio: "inherit",
    },
  );
  process.on("SIGINT", () => app.kill());
  app.on("exit", (code) => {
    process.exitCode = code || 0;
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
