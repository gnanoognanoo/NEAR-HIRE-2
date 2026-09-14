export type CreditSummary = {
  balance: number;
  monthly: number;
  other: number;
  welcome: number;
  purchased: number;
  next_expiry: string | null;
  server_now: string;
  publish_cost: number;
  repost_cost: number;
};
export function creditReasonKey(reason: string): string {
  return (
    (
      {
        signup: "creditSignup",
        welcome_upgrade: "creditWelcomeUpgrade",
        monthly_free: "creditMonthly",
        monthly_expired: "creditExpired",
        purchase: "creditPurchase",
        publish: "creditPublish",
        repost: "creditRepost",
      } as Record<string, string>
    )[reason] || "creditOther"
  );
}
export function expiryDays(summary: CreditSummary): number | null {
  if (!summary.next_expiry) return null;
  return Math.max(
    0,
    Math.ceil((Date.parse(summary.next_expiry) - Date.parse(summary.server_now)) / 86400000),
  );
}
