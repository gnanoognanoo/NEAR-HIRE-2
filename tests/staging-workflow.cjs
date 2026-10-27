const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { STAGING_REF, validateStagingPublicEnvironment } = require("../scripts/staging-policy.cjs");
const key = (payload) =>
  "eyJ." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".fixture";
const values = {
  EXPO_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: key({ role: "anon", ref: STAGING_REF }),
  EXPO_PUBLIC_DEMO_MODE: "false",
  EXPO_PUBLIC_UI_PREVIEW: "false",
  EXPO_PUBLIC_PAYMENT_TEST_AUTH: "false",
};
test("staging launcher accepts only its isolated project and excludes server credentials", () => {
  const publicEnv = validateStagingPublicEnvironment({
    ...values,
    TWOFACTOR_API_KEY: "not-public",
    SUPABASE_SERVICE_ROLE_KEY: "not-public",
  });
  assert.equal(publicEnv.EXPO_PUBLIC_SUPABASE_URL, values.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(publicEnv.TWOFACTOR_API_KEY, undefined);
  assert.equal(publicEnv.SUPABASE_SERVICE_ROLE_KEY, undefined);
  for (const change of [
    { EXPO_PUBLIC_SUPABASE_URL: "https://mxsltkyebhboaglbspse.supabase.co" },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: key({ role: "service_role", ref: STAGING_REF }) },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: key({ role: "anon", ref: "mxsltkyebhboaglbspse" }) },
    { EXPO_PUBLIC_DEMO_MODE: "true" },
    { EXPO_PUBLIC_PAYMENT_TEST_AUTH: "true" },
  ])
    assert.throws(() => validateStagingPublicEnvironment({ ...values, ...change }));
});
