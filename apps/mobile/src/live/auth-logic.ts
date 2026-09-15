import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
export const RESEND_MS = 60_000;
export function normalizePhone(input: string, country: CountryCode = "IN"): string {
  const value = input.trim();
  if (!/^[+\d\s().-]+$/.test(value) || value.length > 40) throw new Error("INVALID_PHONE");
  const phone = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false });
  if (
    !phone?.isValid() ||
    phone.ext ||
    !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(phone.getType() || "")
  )
    throw new Error("INVALID_PHONE");
  return phone.number;
}
export const cooldownSeconds = (deadline: number, now = Date.now()) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));
export function profileComplete(
  profile: { name?: string | null; locality?: string | null } | null | undefined,
) {
  return Boolean(profile?.name?.trim() && profile?.locality?.trim());
}
export function restoredSession<T>(result: {
  data: { session: T | null };
  error: unknown;
}): T | null {
  if (result.error) throw result.error;
  return result.data.session;
}
export function authErrorKey(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number; name?: string } | null;
  const code = e?.code || e?.message || "";
  if (code === "OAUTH_CANCELLED") return "googleCancelled";
  if (code === "OAUTH_CALLBACK_INVALID" || code === "OAUTH_FAILED") return "googleFailed";
  if (
    [
      "identity_already_exists",
      "phone_exists",
      "user_already_exists",
      "IDENTITY_MISMATCH",
    ].includes(code)
  )
    return "identityConflict";
  if (code === "manual_linking_disabled") return "linkingUnavailable";
  if (code === "INVALID_PHONE" || code === "phone_number_invalid") return "phoneError";
  if (code === "INVALID_OTP" || code === "otp_disabled" || code === "invalid_credentials")
    return "otpIncorrect";
  // Supabase intentionally uses otp_expired for both invalid and expired SMS codes.
  if (code === "otp_expired") return "otpExpired";
  if (e?.status === 429 || /over_.*rate_limit|RATE_LIMITED/.test(code)) return "authRateLimit";
  if (
    [
      "phone_provider_disabled",
      "sms_send_failed",
      "provider_disabled",
      "SERVICE_NOT_CONFIGURED",
      "hook_error",
      "hook_timeout",
      "hook_timeout_after_retry",
      "unexpected_failure",
    ].includes(code)
  )
    return "authProviderUnavailable";
  if (
    e?.name === "AuthRetryableFetchError" ||
    e?.name === "AbortError" ||
    e?.name === "TimeoutError" ||
    /network|fetch|timeout|connection/i.test(e?.message || "")
  )
    return "authNetwork";
  return "genericError";
}
export function createAuthGate() {
  let active = false;
  let deadline = 0;
  return {
    remaining: (now = Date.now()) => cooldownSeconds(deadline, now),
    async run<T>(kind: "send" | "verify", action: () => Promise<T>, now = Date.now()): Promise<T> {
      if (active) throw new Error("AUTH_BUSY");
      if (kind === "send" && cooldownSeconds(deadline, now)) throw new Error("RATE_LIMITED");
      active = true;
      // Reserve before the request: ambiguous network failures must not cause an SMS flood.
      if (kind === "send") deadline = now + RESEND_MS;
      try {
        return await action();
      } catch (e) {
        if (authErrorKey(e) === "authRateLimit")
          deadline = Math.max(deadline, Date.now() + RESEND_MS);
        throw e;
      } finally {
        active = false;
      }
    },
  };
}
export async function withAuthTimeout<T>(operation: Promise<T>, milliseconds = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Authentication connection timeout")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
