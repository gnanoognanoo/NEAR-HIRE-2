import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizedContactPosition, canFillJob, retryableRepost } from "./marketplace-activity.ts";

test("partly staffed expired jobs retain the fill action; invalid states never do", () => {
  assert.ok(canFillJob("active"));
  assert.ok(canFillJob("expired"));
  for (const status of [
    "draft",
    "filled",
    "in_progress",
    "completed",
    "suspended",
    "reported",
    "cancelled",
  ])
    assert.equal(canFillJob(status), false);
});
test("authorized contact coordinates support an empty street address without inventing a point", () => {
  assert.deepEqual(authorizedContactPosition({ latitude: 13, longitude: 80, exact_address: "" }), {
    latitude: 13,
    longitude: 80,
    source: "manual",
  });
  for (const value of [
    null,
    {},
    { latitude: null, longitude: 80 },
    { latitude: 91, longitude: 80 },
    { latitude: "", longitude: 80 },
  ])
    assert.equal(authorizedContactPosition(value), null);
});
test("ambiguous repost retry survives recreation and reuses the stored request; success clears it", async () => {
  const storage = new Map<string, string>(),
    requests: string[] = [];
  const deps = {
    read: async (k: string) => storage.get(k) || null,
    write: async (k: string, v: string) => {
      storage.set(k, v);
    },
    remove: async (k: string) => {
      storage.delete(k);
    },
    requestId: () => "stable-request",
    repost: async (_id: string, request: string) => {
      requests.push(request);
      if (requests.length === 1) throw Error("Network response lost");
      return "new-job";
    },
  };
  await assert.rejects(() => retryableRepost(deps)("owner", "expired"));
  assert.equal(await retryableRepost(deps)("owner", "expired"), "new-job");
  assert.deepEqual(requests, ["stable-request", "stable-request"]);
  assert.equal(storage.size, 0);
});
test("simultaneous repost taps share one request and storage failure prevents a network mutation", async () => {
  let requests = 0,
    release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const deps = {
    read: async () => null,
    write: async () => {},
    remove: async () => {},
    requestId: () => "one",
    repost: async () => {
      requests++;
      await gate;
      return "job";
    },
  };
  const run = retryableRepost(deps),
    a = run("owner", "expired"),
    b = run("owner", "expired");
  assert.equal(a, b);
  release();
  await a;
  assert.equal(requests, 1);
  await assert.rejects(() =>
    retryableRepost({
      ...deps,
      write: async () => {
        throw Error("Storage unavailable");
      },
    })("owner", "other"),
  );
  assert.equal(requests, 1);
});
