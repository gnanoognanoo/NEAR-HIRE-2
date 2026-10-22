const assert = require('node:assert/strict');
const PROJECT_ID = '9788df17-3b02-4cd3-b594-8daff14abcad';
const packages = { preview: 'app.nearhire.mobile.preview', production: 'app.nearhire.mobile' };
function validateTarget(channel, build, fingerprint, channelData) {
  assert.ok(Object.hasOwn(packages, channel), 'Only preview and production are supported.');
  assert.equal(build.app?.id, PROJECT_ID, 'Wrong EAS project.');
  assert.equal(build.status, 'FINISHED', 'A finished reference binary is required.');
  assert.equal(build.platform, 'ANDROID', 'An Android reference binary is required.');
  assert.equal(build.buildProfile, channel, 'Wrong build profile.');
  assert.equal(build.appIdentifier, packages[channel], 'Wrong Android package.');
  assert.equal(build.updateChannel?.name, channel, 'Wrong binary channel.');
  assert.ok(build.runtime?.version, 'Reference binary has no runtime.');
  assert.equal(fingerprint.hash, build.runtime.version, 'NATIVE_RUNTIME_CHANGED: build a new binary; never override runtime.');
  const page = channelData.currentPage || channelData;
  assert.equal(page.name, channel, 'Wrong EAS channel.');
  assert.equal(page.isPaused, false, 'Channel is paused.');
  const branches = page.updateBranches || [];
  assert.equal(branches.length, 1, 'Resolve channel rollout/mapping before publishing.');
  assert.equal(branches[0].name, channel, 'Channel must map only to its own branch.');
  const mapping = JSON.parse(page.branchMapping);
  assert.equal(mapping.data.length, 1, 'Resolve active channel rollout first.');
  assert.equal(mapping.data[0].branchId, branches[0].id, 'Wrong channel branch mapping.');
  assert.equal(mapping.data[0].branchMappingLogic, 'true', 'Resolve active channel rollout first.');
  return build.runtime.version;
}
function validateEnvironment(channel, env) {
  if (env.EAS_PROJECT_ID) assert.equal(env.EAS_PROJECT_ID, PROJECT_ID, 'Do not redirect updates to another Expo project.');
  assert.equal(env.APP_VARIANT, channel, 'EAS APP_VARIANT must match the channel.');
  for (const key of ['EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_UI_PREVIEW', 'EXPO_PUBLIC_PAYMENT_TEST_AUTH'])
    assert.equal(env[key], 'false', `${key} must be false in release environments.`);
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://mxsltkyebhboaglbspse.supabase.co', 'Wrong public Supabase project.');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(key, 'Public Supabase key missing.');
  if (!key.startsWith('sb_publishable_')) {
    let role; try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role; } catch { /* fail below */ }
    assert.equal(role, 'anon', 'Only a public publishable/anon Supabase key is allowed.');
  }
  for (const name of Object.keys(env)) {
    if (/^EXPO_PUBLIC_.*(?:SERVICE_ROLE|PRIVATE_KEY|WEBHOOK_SECRET|TWOFACTOR|OLA_MAPS|MAPTILER|RAZORPAY_SECRET)/i.test(name) && env[name])
      throw new Error('Private or retired provider configuration found in public environment.');
  }
}
function parseCliJson(raw) {
  // EAS can print environment/progress notices before --json output on Windows.
  const text = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
  try { return JSON.parse(text); } catch { /* look for a complete trailing JSON document */ }
  for (const match of text.matchAll(/^[\[{]/gm)) {
    try { return JSON.parse(text.slice(match.index)); } catch { /* progress line, not JSON */ }
  }
  throw new Error('EAS did not return valid JSON. No update was confirmed.');
}
module.exports = { PROJECT_ID, packages, validateTarget, validateEnvironment, parseCliJson };
