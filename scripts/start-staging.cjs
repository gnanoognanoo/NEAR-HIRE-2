const fs = require("node:fs"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const { validateStagingPublicEnvironment } = require("./staging-policy.cjs");
const root = path.resolve(__dirname, ".."),
  mobile = path.join(root, "apps/mobile");
try {
  const file = fs.realpathSync(
    process.env.NEARHIRE_STAGING_ENV_FILE ||
      path.resolve(root, "../NEARHIRE-SECRETS/mobile-staging.env"),
  );
  if (!path.relative(root, file).startsWith(".." + path.sep))
    throw Error("Store staging configuration outside Git");
  const values = Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
  const env = {
    ...process.env,
    ...validateStagingPublicEnvironment(values),
    APP_VARIANT: "development",
    EXPO_NO_DOTENV: "1",
  };
  const child = spawn(
    process.execPath,
    [
      path.join(mobile, "node_modules/expo/bin/cli"),
      "start",
      "--dev-client",
      "--lan",
      "--port",
      "8082",
      "--clear",
    ],
    { cwd: mobile, env, stdio: "inherit" },
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  child.on("error", () => {
    console.error("Staging Metro failed to start");
    process.exitCode = 1;
  });
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
