import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  markerColor,
  JOB_MARKER_COLORS,
  MAX_MAP_MARKERS,
  mapCountText,
} from "./map-presentation.ts";
import { activeNearby } from "./location-logic.ts";
test("job urgency alone determines green/red, independent of category and selection", () => {
  for (const kind of ["business", "residential", "other"])
    for (const selected of [true, false]) {
      const job = { kind, selected, isUrgent: false };
      assert.equal(markerColor(job), JOB_MARKER_COLORS.normal);
      assert.equal(markerColor({ ...job, isUrgent: true }), JOB_MARKER_COLORS.urgent);
    }
  assert.equal(markerColor({}), "#21834A");
  assert.deepEqual(Object.values(JOB_MARKER_COLORS), ["#21834A", "#D94040"]);
  assert.equal(MAX_MAP_MARKERS, 100);
});
test("filtered loaded counts exclude expiration and preserve bilingual radius/plurals", () => {
  const now = Date.now(),
    rows = [
      { job: { id: "1", status: "active", expires_at: new Date(now + 1000).toISOString() } },
      { job: { id: "2", status: "active", expires_at: new Date(now - 1000).toISOString() } },
    ];
  for (const lang of ["en", "ta"]) {
    const dict = JSON.parse(
      readFileSync(new URL("./locales/" + lang + ".json", import.meta.url), "utf8"),
    );
    const t = (k: string) => dict[k];
    for (const radius of [1000, 3000, 17000, 50000]) {
      const count = activeNearby(rows, now).length;
      assert.equal(count, 1);
      assert.equal(
        mapCountText(count, radius, t),
        dict.jobWithin.replace("{count}", "1").replace("{radius}", String(radius / 1000)),
      );
      assert.equal(
        mapCountText(0, radius, t),
        dict.jobsWithin.replace("{count}", "0").replace("{radius}", String(radius / 1000)),
      );
    }
    assert.equal(activeNearby(rows, now + 2000).length, 0);
  }
});
