import { configuredLocationProvider } from "./config.ts";
import { LocationProviderError } from "./provider.ts";
import { locationRequest } from "./request.ts";
const assert = (ok: unknown) => {
  if (!ok) throw new Error("Assertion failed");
};
Deno.test(
  "disabled provider never contacts Ola or invents results, even with a configured key",
  async () => {
    let calls = 0;
    const config = configuredLocationProvider("disabled", "fictional", async () => {
      calls++;
      return new Response("{}");
    });
    assert(
      !config.capabilities.search &&
        !config.capabilities.reverseGeocoding &&
        config.capabilities.reason === "disabled",
    );
    for (const request of [
      { action: "search", query: "Anna Nagar" },
      { action: "geocode", query: "Avadi" },
      { action: "resolve", id: "fixture" },
      { action: "reverse", latitude: 13, longitude: 80 },
    ]) {
      let rejected = false;
      try {
        await locationRequest(request, config.provider).operation();
      } catch (error) {
        rejected =
          error instanceof LocationProviderError && error.code === "LOCATION_PROVIDER_DISABLED";
      }
      assert(rejected);
    }
    assert(calls === 0);
  },
);
Deno.test("missing credentials and unsupported/test provider selectors fail closed", async () => {
  for (const [name, key] of [
    [undefined, undefined],
    ["ola", " "],
    ["mock", "fictional"],
    ["unknown", "fictional"],
  ]) {
    const config = configuredLocationProvider(name, key);
    assert(!config.capabilities.search && config.capabilities.reason === "not_configured");
    let rejected = false;
    try {
      await config.provider.reverse(13, 80);
    } catch (e) {
      rejected = e instanceof LocationProviderError && e.code === "LOCATION_NOT_CONFIGURED";
    }
    assert(rejected);
  }
});
Deno.test(
  "Ola can be reactivated behind the same interface; rejected authentication remains a safe error",
  async () => {
    let calls = 0;
    const config = configuredLocationProvider("ola", "fictional", async () => {
      calls++;
      return new Response("Unauthorized", { status: 401 });
    });
    assert(config.capabilities.search && config.capabilities.reverseGeocoding);
    let safe = false;
    try {
      await config.provider.search("Ambattur");
    } catch (e) {
      safe =
        e instanceof LocationProviderError &&
        e.code === "LOCATION_PROVIDER_AUTH" &&
        e.httpStatus === 401;
    }
    assert(safe && calls === 1);
  },
);
