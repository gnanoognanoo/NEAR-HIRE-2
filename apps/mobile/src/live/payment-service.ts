import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { backend, edge, storage } from "./client";
import { openCheckout } from "./checkout";
import { createPaymentFlow } from "./payment-flow";
export const paymentFlow = createPaymentFlow({
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
