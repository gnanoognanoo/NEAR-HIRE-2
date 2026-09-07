export async function openCheckout(_order: {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}) {
  throw new Error("ANDROID_REQUIRED");
}
