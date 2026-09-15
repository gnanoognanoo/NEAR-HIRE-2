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

type PhoneUser = { id: string; phone?: string; phone_confirmed_at?: string };
type PhoneUpdateTransport = {
  getUser(): Promise<{ data: { user: PhoneUser | null }; error: unknown }>;
  updateUser(input: { phone: string }): Promise<{ error: unknown }>;
  verifyOtp(input: {
    phone: string;
    token: string;
    type: "phone_change";
  }): Promise<{ error: unknown }>;
};
// Attaches a verified number to the authenticated UUID; never invokes signInWithOtp.
export function createPhoneVerification(auth: () => PhoneUpdateTransport, userId: string) {
  const gate = createAuthGate();
  async function current() {
    const { data, error } = await auth().getUser();
    if (error) throw error;
    if (data.user?.id !== userId) throw new Error("IDENTITY_MISMATCH");
    return data.user;
  }
  return {
    remaining: () => gate.remaining(),
    async send(phone: string) {
      const number = normalizePhone(phone);
      return gate.run("send", async () => {
        const user = await current();
        // This screen adds an unverified number, not a two-step change of an existing verified phone.
        if (user.phone_confirmed_at && user.phone) throw new Error("IDENTITY_MISMATCH");
        const { error } = await auth().updateUser({ phone: number });
        if (error) throw error;
        return number;
      });
    },
    async verify(phone: string, token: string) {
      if (!/^\d{6}$/.test(token)) throw new Error("INVALID_OTP");
      const number = normalizePhone(phone);
      return gate.run("verify", async () => {
        await current();
        const { error } = await auth().verifyOtp({ phone: number, token, type: "phone_change" });
        if (error) throw error;
        const user = await current();
        if (!user.phone_confirmed_at || normalizePhone(user.phone || "") !== number)
          throw new Error("INVALID_OTP");
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
