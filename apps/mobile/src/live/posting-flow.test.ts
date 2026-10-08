import { test } from "node:test";
import assert from "node:assert/strict";
import { jobSchema, validJobDate } from "../../../../packages/core/validation.ts";
import {
  postingFlow,
  postingErrorKey,
  postingDraftKey,
  restorePostingDraft,
} from "./posting-flow.ts";
const job = {
  title: "Home repair",
  kind: "residential",
  category: "electrician",
  description: "Repair a fan at home",
  pay: "500",
  pay_unit: "day",
  workers_required: "1",
  schedule: "Tomorrow morning",
  locality: "Chennai",
  latitude: 13,
  longitude: 80,
  exact_address: "",
};
test("GPS/manual valid coordinates do not depend on reverse-geocoding or street address", () => {
  assert.ok(jobSchema.safeParse(job).success);
  assert.ok(jobSchema.safeParse({ ...job, latitude: 0, longitude: 0 }).success);
  assert.equal(jobSchema.safeParse({ ...job, latitude: undefined }).success, false);
});
test("normal/urgent posting payload and date/time survive validation", () => {
  const result = jobSchema.parse({
    ...job,
    is_urgent: true,
    start_date: "2026-10-09",
    start_time: "09:30",
  });
  assert.equal(result.is_urgent, true);
  assert.equal(result.pay, 500);
  assert.equal(result.start_time, "09:30");
  assert.equal(jobSchema.parse(job).is_urgent, false);
});
test("required fields and out-of-range payment/worker values are rejected", () => {
  for (const bad of [
    { title: "" },
    { description: "short" },
    { category: "" },
    { schedule: "" },
    { locality: "" },
    { pay: "" },
    { pay: 0 },
    { pay: -1 },
    { pay: 1000001 },
    { pay: "NaN" },
    { workers_required: 1.5 },
    { workers_required: 101 },
  ])
    assert.equal(jobSchema.safeParse({ ...job, ...bad }).success, false, JSON.stringify(bad));
});
test("calendar dates and 24-hour times are strict", () => {
  for (const v of ["not-a-date", "2026-02-30", "2026-13-01", "2026-1-1"])
    assert.equal(validJobDate(v), false);
  assert.ok(validJobDate("2028-02-29"));
  for (const v of ["25:00", "12:60", "9:30"])
    assert.equal(jobSchema.safeParse({ ...job, start_time: v }).success, false);
});
test("optional fields match database size and array limits", () => {
  for (const bad of [
    { city: "x".repeat(121) },
    { benefits: "x".repeat(1001) },
    { instructions: "x".repeat(1001) },
    { country: "IND" },
    { required_languages: Array(21).fill("ta") },
  ])
    assert.equal(jobSchema.safeParse({ ...job, ...bad }).success, false);
});
test("double-click joins a single persistence/create/publish request", async () => {
  let created = 0,
    published = 0,
    persisted = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const flow = postingFlow({
    create: async () => {
      created++;
      await gate;
      return "job";
    },
    publish: async () => {
      published++;
      return { status: "active" };
    },
  });
  const a = flow.submit(job, "request", true, async () => {
    persisted++;
  });
  const b = flow.submit(job, "request", true, async () => {
    persisted++;
  });
  assert.equal(a, b);
  release();
  await a;
  assert.deepEqual([created, published, persisted], [1, 1, 1]);
});
test("network interruption retries the same request and saves current edited fields", async () => {
  const seen: any[] = [];
  let tries = 0;
  const flow = postingFlow({
    create: async (p, id) => {
      seen.push({ p, id });
      return "same-job";
    },
    publish: async () => {
      if (++tries === 1) throw Error("Network interrupted");
      return { status: "active" };
    },
  });
  await assert.rejects(flow.submit(job, "stable", true, async () => {}));
  await flow.submit({ ...job, title: "Edited repair" }, "stable", true, async () => {});
  assert.equal(seen[0].id, seen[1].id);
  assert.equal(seen[1].p.title, "Edited repair");
});
test("failed secure persistence prevents backend writes", async () => {
  let writes = 0;
  const flow = postingFlow({
    create: async () => {
      writes++;
      return "job";
    },
    publish: async () => ({ status: "active" }),
  });
  await assert.rejects(
    flow.submit(job, "id", true, async () => {
      throw Error("Storage failed");
    }),
  );
  assert.equal(writes, 0);
});
test("insufficient credits and permission errors are actionable; draft saving never publishes", async () => {
  assert.equal(postingErrorKey({ message: "CREDITS_REQUIRED" }), "creditsError");
  assert.equal(postingErrorKey({ message: "RLS", code: "42501" }), "postingPermission");
  assert.equal(postingErrorKey(Error("Failed to fetch")), "postingNetworkError");
  let publishes = 0;
  const flow = postingFlow({
    create: async () => "draft",
    publish: async () => {
      publishes++;
      throw Error("CREDITS_REQUIRED");
    },
  });
  await flow.submit(job, "id", false, async () => {});
  assert.equal(publishes, 0);
  await assert.rejects(flow.submit(job, "id", true, async () => {}));
});
test("draft restoration preserves fields, location and retry ID without crossing users", () => {
  const saved = {
    version: 1,
    owner: "owner",
    requestId: "12345678-1234-1234-1234-123456789012",
    fields: job,
    position: { latitude: 13, longitude: 80 },
    typeChosen: true,
  };
  assert.deepEqual(restorePostingDraft(JSON.stringify(saved), "owner"), saved);
  assert.equal(restorePostingDraft(JSON.stringify(saved), "other"), null);
  assert.equal(restorePostingDraft("broken", "owner"), null);
  assert.notEqual(postingDraftKey("a"), postingDraftKey("b"));
});

import { completedPostingDraft } from "./posting-flow.ts";
test("published/cancelled saved drafts are retired before reusing the Post Work form", () => {
  assert.equal(completedPostingDraft(null), false);
  assert.equal(completedPostingDraft({ status: "draft" }), false);
  for (const status of ["active", "expired", "cancelled", "completed"])
    assert.equal(completedPostingDraft({ status }), true);
});
