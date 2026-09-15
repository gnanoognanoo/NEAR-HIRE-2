import { Webhook } from "npm:standardwebhooks@1.0.0";
import { createSmsHandler } from "./handler.ts";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error("Assertion failed");
  }
}
// Generated fixtures only; no real SMS/network or production credentials.
const secret = btoa("unit-test-signature-material-32bytes");
const config = {
  hookSecret: "v1,whsec_" + secret,
  apiKey: "test-only",
  template: "TEST_TEMPLATE",
  recipientSalt: "unit-test-recipient-hmac-material-32",
};
function request(
  body: unknown = { user: { phone: "+919876543210" }, sms: { otp: "654321" } },
  id = "event-1",
  age = 0,
) {
  const raw = JSON.stringify(body), at = new Date(Date.now() - age);
  return new Request("https://hook.example", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
      "webhook-signature": new Webhook(secret).sign(id, at, raw),
    },
    body: raw,
  });
}
Deno.test("valid signed hook forwards supplied OTP only in body and acknowledges success", async () => {
  let sent = 0, completed = 0;
  const handle = createSmsHandler({
    config: () => config,
    reserve: async (_id, hash) => {
      equal(hash.length, 64);
      return "reserved";
    },
    complete: async () => {
      completed++;
    },
    fetcher: async (url, init) => {
      sent++;
      equal(url, "https://2factor.in/API/V1/OTP/SEND");
      equal(init?.method, "POST");
      equal(init?.redirect, "error");
      equal(JSON.parse(String(init?.body)), {
        to: "+919876543210",
        template_name: "TEST_TEMPLATE",
        var1: "654321",
      });
      return Response.json({ status: "sent", session_id: "mock" });
    },
  });
  equal((await handle(request())).status, 200);
  equal(sent, 1);
  equal(completed, 1);
});
Deno.test("unsigned/tampered/stale requests cannot reserve or send SMS", async () => {
  const handle = createSmsHandler({
    config: () => config,
    reserve: () => {
      throw Error("must not reserve");
    },
    complete: async () => {},
    fetcher: () => {
      throw Error("must not send");
    },
  });
  equal(
    (await handle(
      new Request("https://hook.example", { method: "POST", body: "{}" }),
    )).status,
    401,
  );
  const valid = request();
  equal(
    (await handle(
      new Request(valid.url, {
        method: "POST",
        headers: valid.headers,
        body: "{}",
      }),
    )).status,
    401,
  );
  equal((await handle(request(undefined, "old", 600000))).status, 401);
});
Deno.test("invalid destinations, payloads and OTP lengths are rejected", async () => {
  const handle = createSmsHandler({
    config: () => config,
    reserve: async () => "reserved",
    complete: async () => {},
    fetcher: () => {
      throw Error("must not send");
    },
  });
  for (
    const body of [null, {}, {
      user: { phone: "+12025550123" },
      sms: { otp: "654321" },
    }, { user: { phone: "+919876543210" }, sms: { otp: "bad" } }]
  ) equal((await handle(request(body))).status, 400);
});
Deno.test("duplicate completed hooks succeed without re-sending; pending and rate-limited requests fail closed", async () => {
  for (
    const [reserved, status] of [["sent", 200], ["pending", 503], [
      "limited",
      429,
    ], ["denied", 503]] as const
  ) {
    const handle = createSmsHandler({
      config: () => config,
      reserve: async () => reserved,
      complete: async () => {},
      fetcher: () => {
        throw Error("must not send");
      },
    });
    equal((await handle(request())).status, status);
  }
});
Deno.test("provider HTTP/application/network failures never acknowledge delivery or leak provider text", async () => {
  for (
    const fetcher of [
      async () => new Response("private provider detail", { status: 401 }),
      async () => Response.json({ status: "error" }),
      async () => {
        throw Error("private timeout detail");
      },
    ]
  ) {
    let completed = false;
    const handle = createSmsHandler({
      config: () => config,
      reserve: async () => "reserved",
      complete: async () => {
        completed = true;
      },
      fetcher,
    });
    const result = await handle(request());
    equal(result.status, 503);
    equal(completed, false);
    equal((await result.text()).includes("private"), false);
  }
});
Deno.test("missing configuration prevents provider access", async () => {
  const handle = createSmsHandler({
    config: () => ({ ...config, apiKey: "" }),
    reserve: async () => "reserved",
    complete: async () => {},
  });
  equal((await handle(request())).status, 503);
});
Deno.test("phone_change delivers to signed sms.phone, never the old account phone", async () => {
  let destination = "";
  const handle = createSmsHandler({
    config: () => config,
    reserve: async () => "reserved",
    complete: async () => {},
    fetcher: async (_url, init) => {
      destination = JSON.parse(String(init?.body)).to;
      return Response.json({ status: "sent" });
    },
  });
  equal(
    (await handle(
      request({
        user: { phone: "919999999999", phone_change: "919876543210" },
        sms: { phone: "919876543210", otp: "654321" },
      }),
    )).status,
    200,
  );
  equal(destination, "+919876543210");
  destination = "";
  equal(
    (await handle(
      request({
        user: { phone: "919999999999", phone_change: "919876543210" },
        sms: { otp: "654321" },
      }),
    )).status,
    400,
  );
  equal(destination, "");
});
