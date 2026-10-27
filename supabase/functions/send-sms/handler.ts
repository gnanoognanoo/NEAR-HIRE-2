import { Webhook } from "npm:standardwebhooks@1.0.0";
type Config = {
  hookSecret: string;
  apiKey: string;
  template: string;
  recipientSalt: string;
  deliveryEnabled?: boolean;
  requireAllowlist?: boolean;
  allowedRecipients?: string[];
  apiMode?: string;
};
type Dependencies = {
  config: () => Config;
  reserve: (event: string, recipient: string) => Promise<string>;
  complete: (event: string) => Promise<void>;
  fetcher?: typeof fetch;
  report?: (
    code:
      | "SMS_PROVIDER_HTTP"
      | "SMS_PROVIDER_REJECTED"
      | "SMS_PROVIDER_BALANCE"
      | "SMS_PROVIDER_TEMPLATE"
      | "SMS_PROVIDER_ACCOUNT"
      | "SMS_PROVIDER_AUTH"
      | "SMS_PROVIDER_TIMEOUT"
      | "SMS_PROVIDER_INVALID_RESPONSE"
      | "SMS_PROVIDER_UNAVAILABLE",
    status?: number,
  ) => void;
};
const failure = (status: number) =>
  Response.json({
    error: {
      http_code: status,
      message: status === 429
        ? "SMS rate limit reached. Please wait before retrying."
        : "SMS delivery unavailable. Please try again later.",
    },
  }, { status });
export function createSmsHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return failure(405);
    let config: Config;
    try {
      config = deps.config();
      if (
        [
          config.hookSecret,
          config.apiKey,
          config.template,
          config.recipientSalt,
        ].some((v) => !v) ||
        config.recipientSalt.length < 32
      ) return failure(503);
      if (
        config.apiMode &&
        !["template-json", "manual-otp"].includes(config.apiMode)
      ) return failure(503);
    } catch {
      return failure(503);
    }
    // Never log requests, provider bodies, phone numbers, OTPs or thrown provider errors.
    let payload: {
      user?: { phone?: string; phone_change?: string };
      sms?: { otp?: string; phone?: string };
    };
    let event: string;
    try {
      if (Number(req.headers.get("content-length")) > 16384) {
        return failure(413);
      }
      const raw = await req.text();
      if (raw.length > 16384) return failure(413);
      payload = new Webhook(config.hookSecret.replace(/^v1,whsec_/, "")).verify(
        raw,
        Object.fromEntries(req.headers),
      ) as typeof payload;
      event = req.headers.get("webhook-id") || "";
      if (!event || event.length > 200) return failure(401);
    } catch {
      return failure(401);
    }
    // Supabase supplies the destination and generates/verifies the OTP. India-only delivery for V1.
    // Current Auth supplies sms.phone for phone_change as well as sign-in.
    // Legacy sign-in payloads may omit it; never fall back to an old phone during a change.
    const rawPhone = payload?.sms?.phone ??
      (payload?.user?.phone_change ? undefined : payload?.user?.phone);
    const phone = typeof rawPhone === "string"
      ? "+" + rawPhone.replace(/^\+/, "")
      : "";
    const otp = payload?.sms?.otp;
    if (
      !/^\+91[6-9]\d{9}$/.test(phone) || typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) return failure(400);
    // Staging can be fully configured without sending real SMS. Only controlled
    // destinations may be enabled there; production's existing behavior is unchanged.
    if (config.deliveryEnabled === false) return failure(503);
    if (
      (config.requireAllowlist || config.allowedRecipients?.length) &&
      !config.allowedRecipients?.includes(phone)
    ) return failure(403);
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(config.recipientSalt),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const digest = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(phone),
      );
      const recipient = Array.from(
        new Uint8Array(digest),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const reserved = await deps.reserve(event, recipient);
      if (reserved === "sent") return Response.json({});
      if (reserved === "limited") return failure(429);
      if (reserved !== "reserved") return failure(503);
      // Explicit account route selection only; never retry/fallback after an ambiguous send.
      // The manual-code API requires key/recipient/code in its HTTPS path. Keep the
      // URL local to this request and never log URLs, provider bodies or exceptions.
      const manual = config.apiMode === "manual-otp";
      const response = await (deps.fetcher || fetch)(
        manual
          ? "https://2factor.in/API/V1/" +
            [config.apiKey, "SMS", phone.slice(1), otp, config.template].map(
              encodeURIComponent,
            ).join("/")
          : "https://2factor.in/API/V1/OTP/SEND",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(2000),
          cache: "no-store",
          referrerPolicy: "no-referrer",
          ...(manual ? {} : {
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": config.apiKey,
            },
            body: JSON.stringify({
              to: phone,
              template_name: config.template,
              var1: otp,
            }),
          }),
        },
      );
      if (!response.ok) {
        deps.report?.("SMS_PROVIDER_HTTP", response.status);
        return failure(response.status === 429 ? 429 : 503);
      }
      const result = await response.json();
      const accepted = manual
        ? result?.Status === "Success" && typeof result.Details === "string" &&
          result.Details.length > 0
        : result?.status === "sent";
      if (!accepted) {
        const detail = String(result?.Details || result?.message || "")
          .toLowerCase();
        deps.report?.(
          /balance|credit/.test(detail)
            ? "SMS_PROVIDER_BALANCE"
            : /template/.test(detail)
            ? "SMS_PROVIDER_TEMPLATE"
            : /disabled|inactive|suspend/.test(detail)
            ? "SMS_PROVIDER_ACCOUNT"
            : /api.?key|unauthorized|credential/.test(detail)
            ? "SMS_PROVIDER_AUTH"
            : "SMS_PROVIDER_REJECTED",
        );
        return failure(503);
      }
      await deps.complete(event);
      return Response.json({});
    } catch (error) {
      const name = (error as { name?: string })?.name;
      deps.report?.(
        name === "TimeoutError" || name === "AbortError"
          ? "SMS_PROVIDER_TIMEOUT"
          : name === "SyntaxError"
          ? "SMS_PROVIDER_INVALID_RESPONSE"
          : "SMS_PROVIDER_UNAVAILABLE",
      );
      return failure(503);
    }
  };
}
