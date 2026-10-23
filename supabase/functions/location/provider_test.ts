import { LocationProviderError, OlaMapsProvider, MockLocationProvider } from "./provider.ts";
const assert = (ok: unknown) => {
  if (!ok) throw new Error("Assertion failed");
};
const fixture = {
  place_id: "fixture",
  formatted_address: "Anna Nagar, Chennai, Tamil Nadu, India",
  geometry: { location: { lat: 13.09, lng: 80.21 } },
  address_components: [
    { types: ["sublocality_level_1"], long_name: "Anna Nagar" },
    { types: ["locality"], long_name: "Chennai" },
    { types: ["administrative_area_level_2"], long_name: "Chennai District" },
    { types: ["administrative_area_level_1"], long_name: "Tamil Nadu" },
    { types: ["country"], short_name: "India", long_name: "India" },
  ],
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function rejects(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw Error("Expected rejection");
  } catch (e) {
    assert(e instanceof LocationProviderError && e.code === code);
    assert(!(e as Error).message.includes("fictional"));
  }
}
Deno.test(
  "official API paths, api_key query auth and redirect refusal are used for all four operations",
  async () => {
    const paths: string[] = [];
    const request: typeof fetch = async (input, init) => {
      const u = new URL(String(input));
      assert(u.origin === "https://api.olamaps.io");
      assert(u.searchParams.get("api_key") === "fictional");
      assert(init?.redirect === "error");
      assert(new Headers(init?.headers).has("X-Request-Id"));
      paths.push(u.pathname);
      if (u.pathname.endsWith("/autocomplete")) {
        assert(u.searchParams.get("input") === "Anna Nagar");
        return response({
          status: "ok",
          predictions: [{ place_id: "fixture", description: fixture.formatted_address }],
        });
      }
      if (u.pathname.endsWith("/details")) {
        assert(u.searchParams.get("place_id") === "fixture");
        return response({ status: "ok", result: fixture });
      }
      if (u.pathname.endsWith("/geocode")) {
        assert(u.searchParams.get("address") === "Anna Nagar");
        return response({ status: "ok", geocodingResults: [fixture] });
      }
      assert(u.searchParams.get("latlng") === "13.1,80.2");
      return response({ status: "ok", results: [fixture] });
    };
    const p = new OlaMapsProvider("fictional", request);
    assert((await p.search("Anna Nagar")).length === 1);
    const place = await p.resolve("fixture");
    assert(
      place.locality === "Anna Nagar" &&
        place.city === "Chennai" &&
        place.state === "Tamil Nadu" &&
        place.district === "Chennai District" &&
        place.country === "IN",
    );
    assert((await p.geocode("Anna Nagar"))[0].latitude === 13.09);
    const reverse = await p.reverse(13.1, 80.2);
    assert(
      reverse.latitude === 13.1 && reverse.longitude === 80.2 && reverse.locality === "Anna Nagar",
    );
    assert(paths.length === 4);
  },
);
Deno.test(
  "zero results are empty search/geocode results and a recoverable reverse miss",
  async () => {
    const p = new OlaMapsProvider("fictional", async () =>
      response({ status: "zero_results", predictions: [], geocodingResults: [], results: [] }),
    );
    assert((await p.search("Avadi")).length === 0);
    assert((await p.geocode("Avadi")).length === 0);
    await rejects(() => p.reverse(13, 80), "LOCATION_NOT_FOUND");
    await rejects(() => p.resolve("missing"), "LOCATION_NOT_FOUND");
  },
);
for (const [status, code] of [
  [401, "LOCATION_PROVIDER_AUTH"],
  [403, "LOCATION_PROVIDER_AUTH"],
  [429, "LOCATION_RATE_LIMIT"],
  [500, "LOCATION_UNAVAILABLE"],
] as const) {
  Deno.test(`provider HTTP ${status} is classified without leaking credentials`, async () => {
    const p = new OlaMapsProvider("fictional", async () =>
      response({ error: "fictional" }, status),
    );
    await rejects(() => p.search("Ambattur"), code);
  });
}
Deno.test(
  "transport errors and malformed JSON never expose credential-bearing request URLs",
  async () => {
    for (const request of [
      async () => {
        throw new Error("request https://api.olamaps.io/?api_key=fictional failed");
      },
      async () => new Response("not JSON"),
    ])
      await rejects(
        () => new OlaMapsProvider("fictional", request).search("Anna Nagar"),
        "LOCATION_UNAVAILABLE",
      );
    await rejects(
      () =>
        new OlaMapsProvider("fictional", async () => {
          throw new DOMException("timeout", "TimeoutError");
        }).search("Anna Nagar"),
      "LOCATION_TIMEOUT",
    );
  },
);
Deno.test(
  "HTTP 200 provider error statuses are not treated as empty successful searches",
  async () => {
    await rejects(
      () =>
        new OlaMapsProvider("fictional", async () => response({ status: "REQUEST_DENIED" })).search(
          "Avadi",
        ),
      "LOCATION_PROVIDER_AUTH",
    );
    await rejects(
      () =>
        new OlaMapsProvider("fictional", async () =>
          response({ status: "OVER_QUERY_LIMIT" }),
        ).geocode("Avadi"),
      "LOCATION_RATE_LIMIT",
    );
  },
);
Deno.test("malformed and duplicate predictions are filtered; results are bounded", async () => {
  const predictions = [
    { place_id: null, description: "bad" },
    { place_id: "one", description: "one" },
    { place_id: "one", description: "duplicate" },
    ...Array.from({ length: 15 }, (_, i) => ({ place_id: "id" + i, description: "Place " + i })),
  ];
  const p = new OlaMapsProvider("fictional", async () => response({ status: "ok", predictions }));
  const places = await p.search("Fixture");
  assert(places.length === 8 && new Set(places.map((p) => p.id)).size === 8);
});
Deno.test(
  "null, missing or out-of-range geometry is never normalized to zero coordinates",
  async () => {
    for (const location of [
      { lat: null, lng: null },
      { lat: 91, lng: 80 },
      { lat: 13, lng: Infinity },
      { lat: "13", lng: "80" },
      {},
    ])
      await rejects(
        () =>
          new OlaMapsProvider("fictional", async () =>
            response({ result: { ...fixture, geometry: { location } } }),
          ).resolve("fixture"),
        "LOCATION_INVALID_RESPONSE",
      );
  },
);
Deno.test(
  "missing key fails before network access; fixture provider remains explicitly test-only",
  async () => {
    let threw = false;
    try {
      new OlaMapsProvider(" ");
    } catch (e) {
      threw = e instanceof LocationProviderError && e.code === "LOCATION_NOT_CONFIGURED";
    }
    assert(threw);
    const mock = new MockLocationProvider([{ id: "mock", label: "DEVELOPMENT FIXTURE" }]);
    assert((await mock.geocode("fixture")).length === 1);
    assert((await mock.reverse(1, 2)).label.includes("FIXTURE"));
  },
);
