export async function openCheckout(_order: {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}> {
  throw new Error("ANDROID_REQUIRED");
}
