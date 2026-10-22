const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { PROJECT_ID, packages, validateTarget, parseCliJson } = require('./update-policy.cjs');
const root = path.resolve(__dirname, '..'), mobile = path.join(root, 'apps/mobile');
const args = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
const channel = option('--channel');
const checkOnly = args.includes('--check-only');
function run(command, params, options = {}) {
  const r = spawnSync(command, params, { cwd: root, env: process.env, encoding: 'utf8',
    windowsHide: true, maxBuffer: 32 * 1024 * 1024, ...options });
  if (r.status !== 0 || r.error) throw new Error('Command failed: ' + (options.label || path.basename(command)) + '. No update was confirmed.');
  return r.stdout;
}
function npm(params, options) {
  if (!process.env.npm_execpath) throw new Error('Run this tool through npm run update:preview or update:production.');
  return run(process.execPath, [process.env.npm_execpath, ...params], options);
}
function eas(params, json = true) {
  const raw = npm(['exec', '--yes', '--package=eas-cli@25.3.0', '--', 'eas', ...params], { cwd: mobile, label: 'eas ' + params[0] });
  return json ? parseCliJson(raw) : raw;
}
try {
  if (!Object.hasOwn(packages, channel)) throw new Error('Select preview or production.');
  if (channel === 'preview' && process.env.GITHUB_ACTIONS === 'true') {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root,encoding:'utf8'}).trim();
    const latest = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {cwd:root,encoding:'utf8'}).split(/\s/)[0];
    if (head !== latest) { console.log('Skipping superseded Preview commit; no update published.'); process.exit(0); }
  }
  if (channel === 'production' && !checkOnly && (process.env.CI || !args.includes('--confirm-production')))
    throw new Error('Production publishing requires a manual local command with --confirm-production. CI production publishing is disabled.');
  const buildId = option('--build-id'), firebase = option('--google-services'), message = option('--message');
  if (!/^[a-f0-9-]{36}$/.test(buildId || '')) throw new Error('Supply the finished reference --build-id.');
  if (!firebase || !fs.existsSync(firebase)) throw new Error('Supply external --google-services Firebase Android configuration.');
  const firebasePath = fs.realpathSync(firebase);
  const relative = path.relative(root, firebasePath);
  if (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) throw new Error('Firebase configuration must stay outside the Git repository.');
  const config = JSON.parse(fs.readFileSync(firebasePath, 'utf8'));
  if (!config.client?.some(c => c.client_info?.android_client_info?.package_name === packages[channel]))
    throw new Error('Firebase Android configuration has the wrong package.');
  Object.assign(process.env, { APP_VARIANT: channel, GOOGLE_SERVICES_JSON: firebasePath,
    EXPO_PUBLIC_DEMO_MODE: 'false', EXPO_PUBLIC_UI_PREVIEW: 'false', EXPO_PUBLIC_PAYMENT_TEST_AUTH: 'false' });
  const build = eas(['build:view', buildId, '--json']);
  const environment = eas(['env:exec', channel, '--non-interactive',
    `node ../../scripts/assert-update-env.cjs ${channel}`], false);
  if (!environment.includes('Release environment: PASS')) throw new Error('Shared EAS environment validation failed.');
  // Use the UPDATE environment, not just eas.json build.env. Both must describe the same runtime.
  const fingerprint = eas(['fingerprint:generate', '--environment', channel, '--platform', 'android', '--json', '--non-interactive']);
  const runtime = validateTarget(channel, build, fingerprint, eas(['channel:view', channel, '--json', '--non-interactive']));
  console.log(JSON.stringify({ channel, projectId: PROJECT_ID, package: packages[channel], referenceBuild: buildId, runtime, compatible: true }));
  if (!checkOnly) {
    if (!message || message.startsWith('--')) throw new Error('Supply --message describing the tested change.');
    if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim())
      throw new Error('Commit reviewed source first. Refusing to publish a dirty working tree.');
    const verifiedPreviewCI = channel === 'preview' && process.env.GITHUB_ACTIONS === 'true' &&
      process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main' &&
      process.env.NEARHIRE_VERIFIED_COMMIT === execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root,encoding:'utf8'}).trim();
    if (!verifiedPreviewCI) {
      console.log('Running release checks before publishing…');
      npm(['run', 'validate:updates'], { stdio: 'inherit', label: 'release validation' });
    }
    // No skip-bundler: EAS exports with the same verified environment. Do not reuse stale dist output.
    const published = eas(['update', '--channel', channel, '--platform', 'android', '--environment', channel,
      '--message', message, '--json', '--non-interactive']);
    const updates = Array.isArray(published) ? published : published.updates;
    const group = updates?.[0]?.group;
    if (!group) throw new Error('Publish response has no update group. Inspect EAS before retrying.');
    const details = eas(['update:view', group, '--json']);
    const android = (Array.isArray(details) ? details : [details]).find(u => u.platform === 'android');
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    if (!android || android.runtimeVersion !== runtime || android.gitCommitHash !== commit ||
      (android.branch?.name || android.branch) !== channel) throw new Error('Post-publish metadata verification failed; inspect EAS.');
    console.log(JSON.stringify({ published: true, channel, runtime, group, updateId: android.id, commit,
      url: `https://expo.dev/accounts/gnanoos-team/projects/nearhire/updates/${group}` }));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
