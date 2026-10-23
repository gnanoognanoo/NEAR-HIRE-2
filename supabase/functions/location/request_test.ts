import { locationRequest, locationFailure } from "./request.ts";
import { LocationProviderError, MockLocationProvider } from "./provider.ts";
const assert = (ok: unknown) => {
  if (!ok) throw new Error("Assertion failed");
};
const provider = new MockLocationProvider([
  { id: "fixture", label: "Anna Nagar", latitude: 13, longitude: 80 },
]);
Deno.test(
  "location actions validate and dispatch search, geocode, details and reverse",
  async () => {
    for (const action of ["search", "geocode"]) {
      const r = locationRequest({ action, query: "  Anna   Nagar " }, provider);
      assert(((await r.operation()) as unknown[]).length === 1);
      assert(r.key === JSON.stringify([action, "Anna Nagar"]));
    }
    assert(
      (
        (await locationRequest({ action: "resolve", id: "fixture" }, provider).operation()) as {
          latitude: number;
        }
      ).latitude === 13,
    );
    assert(
      (
        (await locationRequest(
          { action: "reverse", latitude: 0, longitude: 0 },
          provider,
        ).operation()) as { latitude: number }
      ).latitude === 0,
    );
  },
);
Deno.test("invalid payloads, arbitrary operations and malformed coordinates fail closed", () => {
  for (const p of [
    null,
    [],
    true,
    {},
    { action: "search", query: "ab" },
    { action: "geocode", query: "x".repeat(501) },
    { action: "resolve", id: " " },
    { action: "fetch", url: "https://untrusted.example" },
    { action: "reverse", latitude: true, longitude: 0 },
    { action: "reverse", latitude: "13", longitude: 80 },
    { action: "reverse", latitude: 91, longitude: 0 },
    { action: "reverse", latitude: 0, longitude: NaN },
  ]) {
    let rejected = false;
    try {
      locationRequest(p, provider);
    } catch (e) {
      rejected = (e as Error).message === "INVALID_LOCATION_QUERY";
    }
    assert(rejected);
  }
});
Deno.test(
  "cache identity preserves case-sensitive place IDs and distinguishes operations/points",
  () => {
    assert(
      locationRequest({ action: "resolve", id: "ABC" }, provider).key !==
        locationRequest({ action: "resolve", id: "abc" }, provider).key,
    );
    assert(
      locationRequest({ action: "search", query: "Avadi" }, provider).key !==
        locationRequest({ action: "geocode", query: "Avadi" }, provider).key,
    );
    assert(
      locationRequest({ action: "reverse", latitude: 13, longitude: 80 }, provider).key !==
        locationRequest({ action: "reverse", latitude: 13.01, longitude: 80 }, provider).key,
    );
  },
);
Deno.test("error mapping retains safe codes/status and never returns raw provider messages", () => {
  assert(locationFailure(new LocationProviderError("LOCATION_RATE_LIMIT", 429)).status === 429);
  assert(locationFailure(new LocationProviderError("LOCATION_NOT_FOUND")).status === 404);
  const f = locationFailure(new Error("private provider URL or payload"));
  assert(f.code === "LOCATION_UNAVAILABLE" && f.status === 503);
});
