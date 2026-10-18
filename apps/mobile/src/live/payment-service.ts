import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { backend, edge, storage } from "./client";
import { openCheckout } from "./checkout";
import { createPaymentFlow } from "./payment-flow";
import { criticalActivity } from "./update-logic";
const flow = createPaymentFlow({
  storage,
  userId: async () => {
    const { data, error } = await backend().auth.getUser();
    if (error) throw error;
    return data.user?.id || "";
  },
  uuid: Crypto.randomUUID,
  legacyRequest: (user, pack) => AsyncStorage.getItem("nearhire.payment." + user + "." + pack),
  clearLegacy: (user, pack) => AsyncStorage.removeItem("nearhire.payment." + user + "." + pack),
  create: (pack, request) => edge("payment-order", { package_id: pack, request_id: request }),
  checkout: openCheckout,
  verify: (receipt) => edge("payment-verify", { ...receipt }),
  status: async (user, order) => {
    const { data, error } = await backend()
      .from("payment_orders")
      .select("status")
      .eq("user_id", user)
      .eq("provider_order_id", order)
      .single();
    if (error) throw error;
    return data.status;
  },
});
// Includes native checkout and server verification, even when the credits screen is hidden.
export const paymentFlow = {
  async buy(...args: Parameters<typeof flow.buy>) {
    const release = criticalActivity.begin();
    try {
      return await flow.buy(...args);
    } finally {
      release();
    }
  },
  async recover() {
    const release = criticalActivity.begin();
    try {
      return await flow.recover();
    } finally {
      release();
    }
  },
};
