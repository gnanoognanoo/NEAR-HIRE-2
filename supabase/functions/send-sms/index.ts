import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { createSmsHandler } from "./handler.ts";
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error("SMS_NOT_CONFIGURED");
  return value;
}
const client = () =>
  createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(1000) }),
      },
    },
  );
Deno.serve(createSmsHandler({
  report: (code, status) =>
    console.warn("SMS delivery failed", { code, status }),
  config: () => ({
    hookSecret: required("SEND_SMS_HOOK_SECRET"),
    apiKey: required("TWOFACTOR_API_KEY"),
    template: required("TWOFACTOR_TEMPLATE_NAME"),
    apiMode: Deno.env.get("TWOFACTOR_API_MODE") || "template-json",
    recipientSalt: required("SMS_RECIPIENT_HASH_SECRET"),
    deliveryEnabled: Deno.env.get("SMS_DELIVERY_ENABLED") !== "false",
    requireAllowlist: Deno.env.get("NEARHIRE_ENVIRONMENT") === "staging",
    allowedRecipients: (Deno.env.get("SMS_ALLOWED_RECIPIENTS") || "")
      .split(",").map((p) => p.trim()).filter(Boolean),
  }),
  reserve: async (event, recipient) => {
    const { data, error } = await client().rpc("reserve_sms_delivery", {
      p_event: event,
      p_recipient: recipient,
    });
    if (error) throw new Error("SMS_RESERVATION_FAILED");
    return data;
  },
  complete: async (event) => {
    const { error } = await client().rpc("complete_sms_delivery", {
      p_event: event,
    });
    if (error) throw new Error("SMS_CONFIRMATION_FAILED");
  },
}));
