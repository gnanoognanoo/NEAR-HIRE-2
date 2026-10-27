const STAGING_REF = "jovdckzwiprxjxtmogqk";
function validateStagingPublicEnvironment(values) {
  if (values.EXPO_PUBLIC_SUPABASE_URL !== `https://${STAGING_REF}.supabase.co`)
    throw Error("Use only the isolated NearHire staging project");
  const key = values.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.startsWith("sb_secret_")) throw Error("A staging public key is required");
  if (!key.startsWith("sb_publishable_")) {
    let payload;
    try {
      payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
    } catch {
      throw Error("Invalid public key");
    }
    if (payload.role !== "anon" || payload.ref !== STAGING_REF)
      throw Error("Staging key identity mismatch");
  }
  for (const name of [
    "EXPO_PUBLIC_DEMO_MODE",
    "EXPO_PUBLIC_UI_PREVIEW",
    "EXPO_PUBLIC_PAYMENT_TEST_AUTH",
  ])
    if (values[name] !== "false")
      throw Error("Fixture and alternate test login flags must stay off");
  return Object.fromEntries(
    [
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      "EXPO_PUBLIC_DEMO_MODE",
      "EXPO_PUBLIC_UI_PREVIEW",
      "EXPO_PUBLIC_PAYMENT_TEST_AUTH",
    ].map((name) => [name, values[name]]),
  );
}
module.exports = { STAGING_REF, validateStagingPublicEnvironment };
