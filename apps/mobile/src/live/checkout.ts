import RazorpayCheckout from "react-native-razorpay";
export async function openCheckout(order: {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}) {
  return RazorpayCheckout.open({
    key: order.key_id,
    order_id: order.order_id,
    amount: order.amount,
    currency: order.currency,
    name: "NearHire",
    description: "Job credits",
    theme: { color: "#6941A5" },
  });
}
