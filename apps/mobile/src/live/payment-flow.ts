export type TestOrder = {
  status?: string;
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
};
export type Receipt = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type Pending = {
  packageId: string;
  requestId: string;
  orderId?: string;
  receipt?: Receipt;
  state?: string;
};
export function testPaymentsAllowed(
  config?: { payments_enabled_test?: boolean; live_enabled?: boolean } | null,
) {
  return config?.payments_enabled_test === true && config.live_enabled === false;
}
export function assertTestOrder(order: TestOrder) {
  if (
    !/^rzp_test_[a-zA-Z0-9]+$/.test(order.key_id) ||
    !/^order_[a-zA-Z0-9]+$/.test(order.order_id) ||
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    order.currency !== "INR"
  )
    throw new Error("PAYMENT_TEST_ORDER_REQUIRED");
}
export function receiptForOrder(value: Receipt, orderId: string): Receipt {
  if (
    value.razorpay_order_id !== orderId ||
    !/^pay_[a-zA-Z0-9]+$/.test(value.razorpay_payment_id) ||
    !/^[a-fA-F0-9]{64}$/.test(value.razorpay_signature)
  )
    throw new Error("INVALID_PAYMENT_RECEIPT");
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: value.razorpay_payment_id,
    razorpay_signature: value.razorpay_signature,
  };
}
/** Device evidence is resumable, never authoritative. Only owner-scoped server settlement wins. */
export function createPaymentFlow(deps: {
  storage: {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
    removeItem(k: string): Promise<void>;
  };
  userId: () => Promise<string>;
  uuid: () => string;
  legacyRequest: (user: string, pack: string) => Promise<string | null>;
  clearLegacy: (user: string, pack: string) => Promise<void>;
  create: (pack: string, request: string) => Promise<TestOrder>;
  checkout: (order: TestOrder) => Promise<Receipt>;
  verify: (receipt: Receipt) => Promise<{ status: string }>;
  status: (user: string, order: string) => Promise<string>;
}) {
  let busy = false;
  const key = (user: string) => "nearhire.pending-payments." + user;
  const requireOwner = async (user: string) => {
    if ((await deps.userId()) !== user) throw new Error("AUTH_REQUIRED");
  };
  async function read(user: string): Promise<Pending[]> {
    const raw = await deps.storage.getItem(key(user));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.user !== user || !Array.isArray(data.orders) || data.orders.length > 20)
      throw new Error("INVALID_PAYMENT_STATE");
    return data.orders;
  }
  const save = async (user: string, orders: Pending[]) => {
    await requireOwner(user);
    if (orders.length) await deps.storage.setItem(key(user), JSON.stringify({ user, orders }));
    else await deps.storage.removeItem(key(user));
  };
  async function finish(user: string, records: Pending[], item: Pending) {
    await requireOwner(user);
    await save(
      user,
      records.filter((p) => p !== item),
    );
    await deps.clearLegacy(user, item.packageId);
  }
  return {
    async buy(pack: string, onState: (state: string) => void): Promise<string> {
      if (busy) return "paymentPending";
      busy = true;
      let records: Pending[] = [],
        item: Pending | undefined,
        user = "";
      try {
        user = await deps.userId();
        if (!user) throw new Error("AUTH_REQUIRED");
        records = await read(user);
        item = records.find((p) => p.packageId === pack);
        if (!item) {
          item = {
            packageId: pack,
            requestId: (await deps.legacyRequest(user, pack)) || deps.uuid(),
          };
          records.push(item);
          await save(user, records);
        }
        if (item.receipt) {
          onState("paymentVerifying");
          const verified = await deps.verify(receiptForOrder(item.receipt, item.orderId!));
          await requireOwner(user);
          if (verified.status === "paid") {
            await finish(user, records, item);
            return "paymentSuccess";
          }
          return "paymentPending";
        }
        onState("creatingOrder");
        const order = await deps.create(pack, item.requestId);
        await requireOwner(user);
        if (order.status === "paid") {
          await finish(user, records, item);
          return "paymentSuccess";
        }
        assertTestOrder(order);
        item.orderId = order.order_id;
        item.state = "paymentPending";
        await save(user, records);
        onState("openingCheckout");
        let receipt: Receipt;
        try {
          receipt = receiptForOrder(await deps.checkout(order), order.order_id);
        } catch (error) {
          item.state =
            (error as { code?: number }).code === 2 ? "paymentCancelled" : "paymentFailed";
          await save(user, records);
          return item.state;
        }
        await requireOwner(user);
        item.receipt = receipt;
        item.state = "paymentPending";
        await save(user, records);
        onState("paymentVerifying");
        const verified = await deps.verify(receipt);
        await requireOwner(user);
        if (verified.status === "paid") {
          await finish(user, records, item);
          return "paymentSuccess";
        }
        return "paymentPending";
      } catch {
        return item?.orderId ? "paymentPending" : "paymentFailed";
      } finally {
        busy = false;
      }
    },
    async recover(): Promise<string | null> {
      if (busy) return null;
      busy = true;
      let hasPending = false;
      try {
        const user = await deps.userId();
        if (!user) return null;
        let records = await read(user),
          result: string | null = null;
        hasPending = records.length > 0;
        for (const item of [...records]) {
          await requireOwner(user);
          let paid = false;
          if (item.receipt && item.orderId) {
            try {
              paid =
                (await deps.verify(receiptForOrder(item.receipt, item.orderId))).status === "paid";
            } catch {
              /* Poll server below, keep evidence. */
            }
          }
          if (!paid && item.orderId) paid = (await deps.status(user, item.orderId)) === "paid";
          await requireOwner(user);
          if (paid) {
            await finish(user, records, item);
            records = records.filter((p) => p !== item);
            result = "paymentSuccess";
          } else if (result !== "paymentSuccess")
            result = item.receipt ? "paymentPending" : item.state || "paymentPending";
        }
        return result;
      } catch {
        return hasPending ? "paymentPending" : null;
      } finally {
        busy = false;
      }
    },
  };
}
