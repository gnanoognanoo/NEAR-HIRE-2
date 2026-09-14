import test from "node:test";
import assert from "node:assert/strict";
import {
  withAuthTimeout,
  normalizePhone,
  cooldownSeconds,
  createAuthGate,
  profileComplete,
  restoredSession,
  authErrorKey,
} from "./auth-logic.ts";
test("Indian national and formatted international numbers normalize consistently", () => {
  assert.equal(normalizePhone("98765 43210"), "+919876543210");
  assert.equal(normalizePhone("+91 (98765) 43210"), "+919876543210");
  assert.equal(normalizePhone("2025550123", "US"), "+12025550123");
  assert.equal(normalizePhone("+1 202 555 0123"), "+12025550123");
});
test("rejects empty, malformed, embedded, short, landline and extension inputs", () => {
  for (const value of [
    "",
    "+91",
    "12345",
    "call +919876543210",
    "+919876543210 ext 1",
    "++919876543210",
    "+91 44 2345 6789",
  ])
    assert.throws(() => normalizePhone(value), /INVALID_PHONE/);
});
test("cooldown uses absolute timestamps and expires at its exact boundary", () => {
  assert.equal(cooldownSeconds(61000, 1000), 60);
  assert.equal(cooldownSeconds(61000, 60999), 1);
  assert.equal(cooldownSeconds(61000, 61000), 0);
  assert.equal(cooldownSeconds(61000, 99000), 0);
});
test("gate prevents duplicate requests, survives failures and permits later retry", async () => {
  const gate = createAuthGate();
  let release!: () => void;
  let calls = 0;
  const first = gate.run(
    "send",
    async () => {
      calls++;
      await new Promise<void>((r) => (release = r));
    },
    1000,
  );
  await assert.rejects(
    gate.run(
      "send",
      async () => {
        calls++;
      },
      1001,
    ),
    /AUTH_BUSY/,
  );
  await assert.rejects(
    gate.run("verify", async () => {}, 1001),
    /AUTH_BUSY/,
  );
  release();
  await first;
  assert.equal(calls, 1);
  await assert.rejects(
    gate.run("send", async () => {}, 2000),
    /RATE_LIMITED/,
  );
  await assert.rejects(
    gate.run(
      "send",
      async () => {
        throw new Error("network");
      },
      61000,
    ),
    /network/,
  );
  assert.equal(gate.remaining(62000), 59);
  await gate.run("send", async () => {}, 121000);
});
test("profile routing distinguishes new, partial and returning users", () => {
  assert.equal(profileComplete(null), false);
  assert.equal(profileComplete({ name: "User" }), false);
  assert.equal(profileComplete({ name: " ", locality: "Chennai" }), false);
  assert.equal(profileComplete({ name: "User", locality: "Chennai" }), true);
});
test("session restoration preserves identity, handles logged-out and surfaces errors", () => {
  const session = { user: { id: "one" } };
  assert.equal(restoredSession({ data: { session }, error: null }), session);
  assert.equal(restoredSession({ data: { session: null }, error: null }), null);
  assert.throws(
    () => restoredSession({ data: { session: null }, error: new Error("offline") }),
    /offline/,
  );
});
test("maps provider, invalid/expired, rate-limit and network errors without exposing raw errors", () => {
  for (const [input, key] of [
    [{ code: "otp_expired" }, "otpExpired"],
    [{ message: "INVALID_OTP" }, "otpIncorrect"],
    [{ status: 429 }, "authRateLimit"],
    [{ code: "over_sms_send_rate_limit" }, "authRateLimit"],
    [{ code: "phone_provider_disabled" }, "authProviderUnavailable"],
    [{ name: "AuthRetryableFetchError" }, "authNetwork"],
    [{ name: "TimeoutError" }, "authNetwork"],
    [{ message: "untrusted provider details" }, "genericError"],
  ] as const)
    assert.equal(authErrorKey(input), key);
});

test("session timeout releases loading while successful restoration passes through", async () => {
  assert.equal(await withAuthTimeout(Promise.resolve("restored"), 50), "restored");
  await assert.rejects(withAuthTimeout(new Promise(() => {}), 5), /timeout/);
});
import { createPhoneAuth, completeLogout } from "./auth-operations.ts";

test("send and verify use the real production transport contract", async () => {
  let sent = 0,
    verified = 0;
  const service = createPhoneAuth(() => ({
    async signInWithOtp(input) {
      assert.deepEqual(input, { phone: "+919876543210", options: { shouldCreateUser: true } });
      sent++;
      return { error: null };
    },
    async verifyOtp(input) {
      assert.equal(input.phone, "+919876543210");
      assert.equal(input.type, "sms");
      verified++;
      return { data: { session: { user: { id: "fixture" } } }, error: null };
    },
  }));
  await assert.rejects(service.send("bad"), /INVALID_PHONE/);
  assert.equal(sent, 0);
  await service.send("9876543210");
  await assert.rejects(service.send("9876543210"), /RATE_LIMITED/);
  await assert.rejects(service.verify("9876543210", "bad"), /INVALID_OTP/);
  await service.verify("9876543210", String(100000 + Math.floor(Math.random() * 900000)));
  assert.equal(sent, 1);
  assert.equal(verified, 1);
});

test("provider errors, incorrect/expired/used codes and missing sessions cannot authenticate", async () => {
  for (const code of [
    "invalid_credentials",
    "otp_expired",
    "over_request_rate_limit",
    "sms_send_failed",
  ]) {
    const error = { code };
    const service = createPhoneAuth(() => ({
      async signInWithOtp() {
        return { error };
      },
      async verifyOtp() {
        return { data: { session: null }, error };
      },
    }));
    await assert.rejects(service.send("9876543210"), (e) => e === error);
    await assert.rejects(service.verify("9876543210", "654321"), (e) => e === error);
    assert.notEqual(authErrorKey(error), "genericError");
  }
  const service = createPhoneAuth(() => ({
    async signInWithOtp() {
      return { error: null };
    },
    async verifyOtp() {
      return { data: { session: null }, error: null };
    },
  }));
  await assert.rejects(service.verify("9876543210", "654321"), /AUTH_REQUIRED/);
});

test("logout unregisters before sign-out and clears only after successful sign-out", async () => {
  const calls: string[] = [];
  const steps = {
    unregister: async () => {
      calls.push("unregister");
    },
    signOut: async () => {
      calls.push("signOut");
      return { error: null };
    },
    clear: async () => {
      calls.push("clear");
    },
  };
  await completeLogout(steps);
  assert.deepEqual(calls, ["unregister", "signOut", "clear"]);
  calls.length = 0;
  await assert.rejects(
    completeLogout({
      ...steps,
      unregister: async () => {
        throw new Error("offline");
      },
    }),
    /offline/,
  );
  assert.deepEqual(calls, []);
  await assert.rejects(
    completeLogout({ ...steps, signOut: async () => ({ error: new Error("offline") }) }),
    /offline/,
  );
  assert.deepEqual(calls, ["unregister"]);
});
