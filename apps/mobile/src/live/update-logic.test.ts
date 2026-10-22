import { test } from "node:test";
import assert from "node:assert/strict";
import { createActivityGate, createUpdateController, shouldAutoCheck, type UpdateResult } from "./update-logic.ts";

test("Automatic OTA checks run in active preview/production release apps and respect throttle", () => {
  const ready = { development: false, web: false, enabled: true, channel: "preview", active: true,
    busy: false, now: 2_000_000, lastCheck: 0 };
  assert.equal(shouldAutoCheck(ready), true);
  assert.equal(shouldAutoCheck({ ...ready, channel: "production" }), true);
  for (const change of [{ development: true }, { web: true }, { enabled: false }, { channel: null },
    { active: false }, { busy: true }, { lastCheck: ready.now - 899_999 }])
    assert.equal(shouldAutoCheck({ ...ready, ...change }), false);
  assert.equal(shouldAutoCheck({ ...ready, lastCheck: ready.now - 900_000 }), true);
});

function setup() {
  const gate = createActivityGate();
  const results: UpdateResult[] = [];
  let checks = 0,
    downloads = 0,
    restarts = 0;
  const deps = {
    enabled: () => true,
    check: async () => {
      checks++;
      return { isAvailable: true };
    },
    fetch: async () => {
      downloads++;
      return { isNew: true };
    },
    reload: async () => {
      restarts++;
    },
    pending: () => false,
    gate,
    result: (r: UpdateResult) => {
      results.push(r);
    },
  };
  return { gate, results, deps, counts: () => ({ checks, downloads, restarts }) };
}
test("OTA downloads compatible update and waits for explicit restart", async () => {
  const s = setup(),
    c = createUpdateController(s.deps);
  await c.check();
  assert.deepEqual(s.results, ["otaChecking", "otaDownloading", "otaReady"]);
  assert.equal(s.counts().restarts, 0);
  await c.restart();
  assert.equal(s.counts().restarts, 1);
});
test("OTA current and unavailable clients do not download or restart", async () => {
  const s = setup();
  await createUpdateController({ ...s.deps, check: async () => ({ isAvailable: false }) }).check();
  const c = createUpdateController({ ...s.deps, enabled: () => false });
  await c.check();
  await c.restart();
  assert.deepEqual(s.results, ["otaChecking", "otaCurrent", "otaUnavailable"]);
  assert.equal(s.counts().downloads + s.counts().restarts, 0);
});
test("OTA concurrent checks are serialized and downloads are reused", async () => {
  const s = setup(),
    c = createUpdateController(s.deps);
  await Promise.all([c.check(), c.check()]);
  await c.check();
  assert.deepEqual(s.counts(), { checks: 1, downloads: 1, restarts: 0 });
});
test("OTA network/check and asset download failures are retryable without raw errors", async () => {
  for (const stage of ["check", "fetch"] as const) {
    const s = setup();
    let fail = true;
    const c = createUpdateController({
      ...s.deps,
      [stage]: async () => {
        if (fail) throw new Error("private request headers");
        return stage === "check" ? { isAvailable: true } : { isNew: true };
      },
    });
    await c.check();
    assert.equal(s.results.at(-1), "otaFailed");
    fail = false;
    await c.check();
    assert.equal(s.results.at(-1), "otaReady");
  }
});
test("OTA refuses reload until every critical transaction finishes", async () => {
  const s = setup(),
    c = createUpdateController(s.deps);
  await c.check();
  const payment = s.gate.begin(),
    publication = s.gate.begin(),
    auth = s.gate.begin();
  await c.restart();
  assert.equal(s.results.at(-1), "otaBusy");
  payment();
  payment();
  publication();
  await c.restart();
  assert.equal(s.counts().restarts, 0);
  auth();
  await c.restart();
  assert.equal(s.counts().restarts, 1);
  assert.throws(() => s.gate.begin(), /APP_RESTARTING/);
});
test("OTA reload failure releases reservation and permits retry", async () => {
  const s = setup();
  let fail = true;
  const c = createUpdateController({
    ...s.deps,
    reload: async () => {
      if (fail) throw new Error("reload failed");
      await s.deps.reload();
    },
  });
  await c.check();
  await c.restart();
  assert.equal(s.results.at(-1), "otaFailed");
  const release = s.gate.begin();
  release();
  fail = false;
  await c.restart();
  assert.equal(s.counts().restarts, 1);
});
test("OTA detects native background download and supports rollback directive safely", async () => {
  const s = setup(),
    cached = createUpdateController({ ...s.deps, pending: () => true });
  await cached.check();
  await cached.restart();
  assert.equal(s.counts().checks, 0);
  const r = setup(),
    rollback = createUpdateController({
      ...r.deps,
      check: async () => ({ isAvailable: false, isRollBackToEmbedded: true }),
      fetch: async () => ({ isNew: false, isRollBackToEmbedded: true }),
    });
  await rollback.check();
  assert.equal(r.results.at(-1), "otaReady");
});
