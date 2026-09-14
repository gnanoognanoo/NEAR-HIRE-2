import { normalizePhone, createAuthGate } from "./auth-logic.ts";

type AuthTransport = {
  signInWithOtp(input: {
    phone: string;
    options: { shouldCreateUser: boolean };
  }): Promise<{ error: unknown }>;
  verifyOtp(input: {
    phone: string;
    token: string;
    type: "sms";
  }): Promise<{ data: { session: unknown }; error: unknown }>;
};

// The production service and tests share this boundary; only Supabase verifies codes.
export function createPhoneAuth(auth: () => AuthTransport) {
  const gate = createAuthGate();
  return {
    remaining: () => gate.remaining(),
    async send(phone: string) {
      const number = normalizePhone(phone);
      return gate.run("send", async () => {
        const { error } = await auth().signInWithOtp({
          phone: number,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        return number;
      });
    },
    async verify(phone: string, token: string) {
      if (!/^\d{6}$/.test(token)) throw new Error("INVALID_OTP");
      return gate.run("verify", async () => {
        const { data, error } = await auth().verifyOtp({
          phone: normalizePhone(phone),
          token,
          type: "sms",
        });
        if (error) throw error;
        if (!data.session) throw new Error("AUTH_REQUIRED");
      });
    },
  };
}

// Keep cleanup retryable: don't report logout success if unregister/sign-out fails.
export async function completeLogout(steps: {
  unregister: () => Promise<unknown>;
  signOut: () => Promise<{ error: unknown }>;
  clear: () => Promise<unknown>;
}) {
  await steps.unregister();
  const { error } = await steps.signOut();
  if (error) throw error;
  await steps.clear();
}
