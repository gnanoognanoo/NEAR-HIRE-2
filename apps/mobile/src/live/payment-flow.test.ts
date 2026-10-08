import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaymentFlow,
  assertTestOrder,
  receiptForOrder,
  testPaymentsAllowed,
} from "./payment-flow.ts";
const order = { key_id: "rzp_test_public", order_id: "order_123", amount: 900, currency: "INR" };
const receipt = {
  razorpay_order_id: order.order_id,
  razorpay_payment_id: "pay_123",
  razorpay_signature: "a".repeat(64),
};
function setup(overrides: Record<string, unknown> = {}) {
  const memory = new Map<string, string>();
  let created = 0,
    checkouts = 0,
    verified = 0,
    status = "created",
    owner = "user1";
  const storage = {
    getItem: async (k: string) => memory.get(k) || null,
    setItem: async (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: async (k: string) => {
      memory.delete(k);
    },
  };
  const deps = {
    storage,
    userId: async () => owner,
    uuid: () => "idempotent-request",
    legacyRequest: async () => null,
    clearLegacy: async () => {},
    create: async () => {
      created++;
      return order;
    },
    checkout: async () => {
      checkouts++;
      return receipt;
    },
    verify: async () => {
      verified++;
      return { status: "paid" };
    },
    status: async () => status,
    ...overrides,
  };
  return {
    flow: createPaymentFlow(deps),
    restart: () => createPaymentFlow(deps),
    memory,
    counts: () => ({ created, checkouts, verified }),
    setStatus: (s: string) => {
      status = s;
    },
    setOwner: (s: string) => {
      owner = s;
    },
  };
}
test("TEST enabled/live OFF guard is independent of wallet balance and dev login flag", () => {
  assert.equal(testPaymentsAllowed({ payments_enabled_test: true, live_enabled: false }), true);
  for (const c of [
    undefined,
    { payments_enabled_test: false, live_enabled: false },
    { payments_enabled_test: true, live_enabled: true },
    { payments_enabled_test: true },
  ])
    assert.equal(testPaymentsAllowed(c), false);
});
test("native integration rejects LIVE keys and malformed orders", () => {
  assert.doesNotThrow(() => assertTestOrder(order));
  for (const o of [
    { ...order, key_id: "rzp_live_private" },
    { ...order, amount: 0 },
    { ...order, amount: 9.5 },
    { ...order, currency: "USD" },
    { ...order, order_id: "wrong" },
  ])
    assert.throws(() => assertTestOrder(o));
});
test("receipt is bound to its order and contains only approved fields", () => {
  assert.deepEqual(
    receiptForOrder({ ...receipt, extra: "ignored" } as typeof receipt, order.order_id),
    receipt,
  );
  assert.throws(() =>
    receiptForOrder({ ...receipt, razorpay_order_id: "order_other" }, order.order_id),
  );
  assert.throws(() =>
    receiptForOrder({ ...receipt, razorpay_signature: "invalid" }, order.order_id),
  );
});
test("success requires server confirmation and clears recovery record", async () => {
  const s = setup();
  assert.equal(await s.flow.buy("single", () => {}), "paymentSuccess");
  assert.equal(s.memory.size, 0);
  assert.deepEqual(s.counts(), { created: 1, checkouts: 1, verified: 1 });
});
test("checkout success alone never settles wallet: pending receipt survives restart", async () => {
  let captured = false;
  const s = setup({ verify: async () => ({ status: captured ? "paid" : "pending" }) });
  assert.equal(await s.flow.buy("single", () => {}), "paymentPending");
  assert.equal(s.memory.size, 1);
  assert.equal(await s.restart().recover(), "paymentPending");
  captured = true;
  assert.equal(await s.restart().recover(), "paymentSuccess");
  assert.equal(s.memory.size, 0);
  assert.equal(s.counts().checkouts, 1);
});
test("verification network failure retains evidence and retry never opens second checkout", async () => {
  let online = false;
  const s = setup({
    verify: async () => {
      if (!online) throw Error("offline");
      return { status: "paid" };
    },
  });
  assert.equal(await s.flow.buy("single", () => {}), "paymentPending");
  assert.match([...s.memory.values()][0], /razorpay_payment_id/);
  online = true;
  assert.equal(await s.flow.buy("single", () => {}), "paymentSuccess");
  assert.equal(s.counts().checkouts, 1);
});
test("cancelled checkout is recoverable via captured webhook, not credited locally", async () => {
  const s = setup({
    checkout: async () => {
      throw { code: 2 };
    },
  });
  assert.equal(await s.flow.buy("single", () => {}), "paymentCancelled");
  assert.equal(await s.restart().recover(), "paymentCancelled");
  s.setStatus("paid");
  assert.equal(await s.restart().recover(), "paymentSuccess");
});
test("failed checkout preserves idempotent request for explicit retry", async () => {
  const requests: string[] = [];
  const s = setup({
    checkout: async () => {
      throw Error("declined");
    },
    create: async (_p: string, r: string) => {
      requests.push(r);
      return order;
    },
  });
  assert.equal(await s.flow.buy("five", () => {}), "paymentFailed");
  assert.equal(await s.flow.buy("five", () => {}), "paymentFailed");
  assert.equal(requests[0], requests[1]);
});
test("existing legacy idempotency key is reused across the update", async () => {
  let used = "";
  const s = setup({
    legacyRequest: async () => "legacy-request",
    create: async (_p: string, r: string) => {
      used = r;
      return order;
    },
  });
  await s.flow.buy("single", () => {});
  assert.equal(used, "legacy-request");
});
test("concurrent taps are serialized and cause one checkout", async () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const s = setup({
    checkout: async () => {
      await wait;
      return receipt;
    },
  });
  const first = s.flow.buy("single", () => {});
  assert.equal(await s.flow.buy("single", () => {}), "paymentPending");
  release();
  assert.equal(await first, "paymentSuccess");
  assert.equal(s.counts().created, 1);
});
test("unauthenticated user and account switch cannot open checkout for another owner", async () => {
  const s = setup();
  s.setOwner("");
  assert.equal(await s.flow.buy("single", () => {}), "paymentFailed");
  assert.equal(s.counts().created, 0);
  let owner = "first",
    checkout = 0;
  const changed = setup({
    userId: async () => owner,
    create: async () => {
      owner = "second";
      return order;
    },
    checkout: async () => {
      checkout++;
      return receipt;
    },
  });
  await changed.flow.buy("single", () => {});
  assert.equal(checkout, 0);
});
test("repeated recovery and callbacks cannot double-credit from client logic", async () => {
  const s = setup({ verify: async () => ({ status: "pending" }) });
  await s.flow.buy("single", () => {});
  s.setStatus("paid");
  assert.equal(await s.flow.recover(), "paymentSuccess");
  assert.equal(await s.flow.recover(), null);
  assert.equal(s.counts().checkouts, 1);
});
test("provider order already paid skips native checkout and confirms success", async () => {
  const s = setup({ create: async () => ({ ...order, status: "paid" }) });
  assert.equal(await s.flow.buy("single", () => {}), "paymentSuccess");
  assert.equal(s.counts().checkouts, 0);
});
