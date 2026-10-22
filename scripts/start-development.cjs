const { spawn } = require('node:child_process');
const path = require('node:path');
const mobile = path.resolve(__dirname, '../apps/mobile');
const args = process.argv.slice(2);
// Fast Refresh is provided by Metro, never by the standalone Preview APK.
const host = args.includes('--localhost') || args.includes('--tunnel') ? [] : ['--lan'];
const env = { ...process.env, APP_VARIANT: 'development', EXPO_PUBLIC_DEMO_MODE: 'false',
  EXPO_PUBLIC_UI_PREVIEW: 'false', EXPO_PUBLIC_PAYMENT_TEST_AUTH: 'false' };
const child = spawn(process.execPath, [path.join(mobile, 'node_modules/expo/bin/cli'),
  'start', '--dev-client', ...host, ...args], { cwd: mobile, env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { console.error('Could not start Metro. Install mobile dependencies first.'); process.exitCode = 1; });
