import test from "node:test";
import assert from "node:assert/strict";
import { callbackCode, assertLinkedUser, beginGoogle, type PendingOAuth } from "./oauth-logic.ts";
import { createPhoneVerification } from "./auth-operations.ts";
test("Google signin and authenticated linking use distinct Supabase methods and remember the original UUID", async () => {
  const methods: string[] = [];
  const pending: PendingOAuth[] = [];
  const auth = {
    getUser: async () => ({ data: { user: { id: "phone-user" } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithOAuth: async () => {
      methods.push("signin");
      return { data: { url: "https://provider.example" }, error: null };
    },
    linkIdentity: async () => {
      methods.push("link");
      return { data: { url: "https://provider.example" }, error: null };
    },
  };
  await beginGoogle(auth, false, "nearhire://auth/callback", async (p) => {
    pending.push(p);
  });
  await beginGoogle(auth, true, "nearhire://auth/callback", async (p) => {
    pending.push(p);
  });
  assert.deepEqual(methods, ["signin", "link"]);
  assert.equal(pending[0].userId, null);
  assert.equal(pending[1].userId, "phone-user");
  await assert.rejects(
    beginGoogle(
      { ...auth, getUser: async () => ({ data: { user: null }, error: null }) },
      true,
      "nearhire://auth/callback",
      async () => {},
    ),
    /AUTH_REQUIRED/,
  );
  await assert.rejects(
    beginGoogle(
      { ...auth, getSession: async () => ({ data: { session: {} }, error: null }) },
      false,
      "nearhire://auth/callback",
      async () => {},
    ),
    /IDENTITY_MISMATCH/,
  );
  assert.deepEqual(methods, ["signin", "link"]);
});
test("PKCE callbacks require a pending, unexpired flow and exact callback target", () => {
  const p = { redirect: "nearhire://auth/callback", userId: null, started: 1000 };
  assert.equal(callbackCode("nearhire://auth/callback?code=single-use", p, 2000), "single-use");
  for (const url of [
    "https://evil.example/?code=x",
    "nearhire://other/callback?code=x",
    "nearhire://auth/callback?access_token=x",
    "nearhire://auth/callback?code=x#access_token=x",
  ])
    assert.throws(() => callbackCode(url, p, 2000));
  assert.throws(() => callbackCode("nearhire://auth/callback?code=x", null, 2000));
  assert.throws(() => callbackCode("nearhire://auth/callback?code=x", p, 601001));
  assert.throws(
    () => callbackCode("nearhire://auth/callback?error=access_denied", p, 2000),
    /OAUTH_CANCELLED/,
  );
});
test("web OAuth callback validates origin and path; linked identity must preserve UUID", () => {
  const p = { redirect: "http://localhost:8095/", userId: "original", started: 1000 };
  assert.equal(callbackCode("http://localhost:8095/?code=one", p, 2000), "one");
  assert.throws(() => callbackCode("http://localhost:8096/?code=one", p, 2000));
  assertLinkedUser("original", "original");
  assert.throws(() => assertLinkedUser("original", "different"), /IDENTITY_MISMATCH/);
  assert.throws(() => assertLinkedUser(null, undefined));
});
test("Google-first phone verification updates current UUID and uses phone_change, never signs up", async () => {
  const calls: unknown[] = [];
  const user = { id: "google-user", phone: "", phone_confirmed_at: "" };
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async (input: unknown) => {
      calls.push(input);
      return { error: null };
    },
    verifyOtp: async (input: { phone: string; token: string; type: "phone_change" }) => {
      calls.push(input);
      user.phone = input.phone;
      user.phone_confirmed_at = "verified";
      return { error: null };
    },
  };
  const service = createPhoneVerification(() => auth, user.id);
  const number = await service.send("9876543210");
  assert.equal(number, "+919876543210");
  await assert.rejects(service.send(number), /RATE_LIMITED/);
  await service.verify(number, "654321");
  assert.equal(user.id, "google-user");
  assert.deepEqual(calls, [
    { phone: number },
    { phone: number, token: "654321", type: "phone_change" },
  ]);
});
test("phone linking rejects session changes, invalid codes and owned-number conflicts", async () => {
  let id = "other";
  let calls = 0;
  const auth = {
    getUser: async () => ({ data: { user: { id } }, error: null }),
    updateUser: async () => {
      calls++;
      return { error: { code: "phone_exists" } };
    },
    verifyOtp: async () => {
      calls++;
      return { error: null };
    },
  };
  await assert.rejects(
    createPhoneVerification(() => auth, "original").send("9876543210"),
    /IDENTITY_MISMATCH/,
  );
  assert.equal(calls, 0);
  id = "original";
  await assert.rejects(
    createPhoneVerification(() => auth, id).send("9876543210"),
    (e) => (e as { code: string }).code === "phone_exists",
  );
  await assert.rejects(
    createPhoneVerification(() => auth, id).verify("9876543210", "bad"),
    /INVALID_OTP/,
  );
  assert.equal(calls, 1);
});
