import test from "node:test";
import assert from "node:assert/strict";
import { createLocator, fixPosition, locationStatus } from "./location-acquisition.ts";
const fix = (age = 0, accuracy: number | null = 25) => ({
  coords: { latitude: 12.5, longitude: 80.2, accuracy },
  timestamp: Date.now() - age,
});
function setup(overrides: Record<string, unknown> = {}) {
  let fresh = 0,
    cached = 0,
    cancelled = 0,
    asked = 0;
  const deps = {
    permission: async () => ({ status: "granted", canAskAgain: true }),
    requestPermission: async () => {
      asked++;
      return { status: "granted", canAskAgain: true };
    },
    services: async () => true,
    fresh: () => {
      fresh++;
      return {
        promise: Promise.resolve(fix()),
        cancel: () => {
          cancelled++;
        },
      };
    },
    cached: async () => {
      cached++;
      return fix(1000);
    },
    timeout: 5,
    ...overrides,
  };
  return { locate: createLocator(deps), counts: () => ({ fresh, cached, cancelled, asked }) };
}
test("fresh fix preserves coordinates, age and accuracy; no cache substitution", async () => {
  const s = setup(),
    p = await s.locate();
  assert.equal(p.source, "live");
  assert.equal(p.approximate, false);
  assert.equal(p.accuracy, 25);
  assert.equal(p.latitude, 12.5);
  assert.equal(s.counts().cached, 0);
  assert.equal(s.counts().cancelled, 1);
});
test("coarse foreground grant works and remains explicitly approximate", async () => {
  const s = setup({
    permission: async () => ({ status: "granted", canAskAgain: true, approximate: true }),
  });
  assert.equal((await s.locate()).approximate, true);
});
test("undetermined permission requests foreground once", async () => {
  const s = setup({ permission: async () => ({ status: "undetermined", canAskAgain: true }) });
  await s.locate();
  assert.equal(s.counts().asked, 1);
});
test("denial and permanent denial never read GPS or cached locations", async () => {
  for (const canAskAgain of [true, false]) {
    const s = setup({
      permission: async () => ({ status: "denied", canAskAgain }),
      requestPermission: async () => ({ status: "denied", canAskAgain }),
    });
    await assert.rejects(
      s.locate(),
      new RegExp(canAskAgain ? "LOCATION_PERMISSION_DENIED" : "LOCATION_PERMISSION_PERMANENT"),
    );
    assert.equal(s.counts().fresh, 0);
    assert.equal(s.counts().cached, 0);
  }
});
test("disabled location services never substitute a cached/fixed position", async () => {
  const s = setup({ services: async () => false });
  await assert.rejects(s.locate(), /GPS_DISABLED/);
  assert.equal(s.counts().fresh, 0);
  assert.equal(s.counts().cached, 0);
});
test("timeout cancels acquisition and uses only a bounded recent cache", async () => {
  let cancelled = false;
  const s = setup({
    fresh: () => ({
      promise: new Promise(() => {}),
      cancel: () => {
        cancelled = true;
      },
    }),
  });
  const p = await s.locate();
  assert.equal(cancelled, true);
  assert.equal(p.source, "cached");
  assert.match(
    locationStatus(p, (k) => k),
    /cachedLocation/,
  );
});
test("stale, inaccurate, unknown-accuracy, future and invalid caches are rejected", () => {
  for (const p of [
    fix(120001),
    fix(0, 1001),
    fix(0, null),
    fix(-11000),
    { ...fix(), coords: { latitude: 91, longitude: 0, accuracy: 25 } },
  ])
    assert.throws(() => fixPosition(p, true));
});
test("timeout without a usable cache remains retryable", async () => {
  const s = setup({
    fresh: () => ({ promise: new Promise(() => {}), cancel: () => {} }),
    cached: async () => fix(180000),
  });
  await assert.rejects(s.locate(), /LOCATION_TIMEOUT/);
});
test("simultaneous entry points share one acquisition; next retry is fresh", async () => {
  const s = setup();
  const a = s.locate(),
    b = s.locate();
  assert.equal(a, b);
  await Promise.all([a, b]);
  assert.equal(s.counts().fresh, 1);
  await s.locate();
  assert.equal(s.counts().fresh, 2);
});
test("revoked permission during acquisition cannot fall back", async () => {
  let reads = 0;
  const s = setup({
    permission: async () => ({ status: ++reads === 1 ? "granted" : "denied", canAskAgain: false }),
    fresh: () => ({ promise: Promise.reject(new Error("LOCATION_UNAVAILABLE")), cancel: () => {} }),
  });
  await assert.rejects(s.locate(), /LOCATION_PERMISSION_PERMANENT/);
  assert.equal(s.counts().cached, 0);
});
test("fresh but poor/unknown accuracy is labelled approximate; old fix labelled cached", () => {
  assert.equal(fixPosition(fix(0, 250), false).approximate, true);
  assert.equal(fixPosition(fix(0, null), false).approximate, true);
  assert.equal(fixPosition(fix(20000), false).source, "cached");
  assert.match(
    locationStatus(fixPosition(fix(1000, 250), true), (k) => k),
    /cachedApproximateLocation.*250/,
  );
});
test("provider denies during browser request: no fallback even when permissions API unavailable", async () => {
  const s = setup({
    fresh: () => ({
      promise: Promise.reject(new Error("LOCATION_PERMISSION_DENIED")),
      cancel: () => {},
    }),
  });
  await assert.rejects(s.locate(), /LOCATION_PERMISSION_DENIED/);
  assert.equal(s.counts().cached, 0);
});
