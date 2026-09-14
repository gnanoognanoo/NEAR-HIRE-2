import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { creditBalanceKey } from "./credit-query.ts";
test("chip and wallet observers refresh from the same server balance after publication", async () => {
  const client = new QueryClient();
  let serverSummary = { balance: 12, monthly: 2, other: 10 };
  const options = { queryKey: creditBalanceKey, queryFn: async () => serverSummary };
  const chip = new QueryObserver(client, { ...options, select: (summary) => summary.balance }),
    wallet = new QueryObserver(client, options);
  const a = chip.subscribe(() => {}),
    b = wallet.subscribe(() => {});
  try {
    await chip.refetch();
    assert.deepEqual(wallet.getCurrentResult().data, { balance: 12, monthly: 2, other: 10 });
    serverSummary = { balance: 11, monthly: 1, other: 10 };
    await client.invalidateQueries();
    assert.equal(chip.getCurrentResult().data, 11);
    assert.deepEqual(wallet.getCurrentResult().data, { balance: 11, monthly: 1, other: 10 });
  } finally {
    a();
    b();
    client.clear();
  }
});
import { creditReasonKey, expiryDays } from "./credit-model.ts";
test("credit V2 transaction labels distinguish grants, spending and expiry", () => {
  for (const [reason, key] of Object.entries({
    signup: "creditSignup",
    welcome_upgrade: "creditWelcomeUpgrade",
    monthly_free: "creditMonthly",
    monthly_expired: "creditExpired",
    purchase: "creditPurchase",
    publish: "creditPublish",
    repost: "creditRepost",
  }))
    assert.equal(creditReasonKey(reason), key);
  assert.equal(creditReasonKey("admin_adjustment"), "creditOther");
});
test("credit expiry presentation uses server time and rounds partial days without negative values", () => {
  const s = {
    balance: 12,
    monthly: 2,
    other: 10,
    welcome: 10,
    purchased: 0,
    publish_cost: 1,
    repost_cost: 1,
    server_now: "2026-09-30T23:59:00Z",
    next_expiry: "2026-10-01T00:00:00Z",
  };
  assert.equal(expiryDays(s), 1);
  assert.equal(expiryDays({ ...s, next_expiry: null }), null);
  assert.equal(expiryDays({ ...s, next_expiry: "2026-09-01T00:00:00Z" }), 0);
});
