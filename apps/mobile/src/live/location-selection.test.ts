import test from "node:test";
import assert from "node:assert/strict";
import type { Position } from "./location-logic.ts";
import {
  confirmedLocation,
  manualCoordinatesApplied,
  optionalReverseLocation,
  mergeReverseLocation,
  resolveLocationSuggestion,
} from "./location-selection.ts";
import { addressProviderUnavailable, locationCapabilities } from "./location-provider-state.ts";
test("autocomplete resolves its ID and preserves structured address fields", async () => {
  const result = await resolveLocationSuggestion(
    { id: "fixture", label: "Fixture suggestion" },
    async (id) => {
      assert.equal(id, "fixture");
      return {
        id,
        label: "Fixture address",
        latitude: 13,
        longitude: 80,
        locality: "Anna Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "IN",
      };
    },
  );
  assert.equal(result.latitude, 13);
  assert.equal(result.locality, "Anna Nagar");
  assert.equal(result.country, "IN");
  assert.equal(result.source, "manual");
});
test("geocoded suggestions use their actual coordinates without a second detail lookup", async () => {
  const result = await resolveLocationSuggestion(
    { id: "geocode", label: "Fixture", latitude: 13.1, longitude: 80.2 },
    async () => {
      throw Error("Must not fetch details");
    },
  );
  assert.equal(result.longitude, 80.2);
});
test("bad result coordinates are rejected before a pin can be placed", async () => {
  await assert.rejects(
    resolveLocationSuggestion(
      { id: "bad", label: "Fixture", latitude: 91, longitude: 80 },
      async () => {
        throw Error("unexpected");
      },
    ),
    /INVALID_LOCATION/,
  );
  await assert.rejects(
    resolveLocationSuggestion({ id: "bad", label: "Fixture" }, async (id) => ({
      id,
      label: "Fixture",
    })),
    /INVALID_LOCATION/,
  );
});
test("reverse lookup updates address fields without moving the private GPS/manual point", () => {
  const result = mergeReverseLocation(
    { latitude: 13.11, longitude: 80.22, source: "live", accuracy: 14, label: "Current location" },
    {
      latitude: 13.12,
      longitude: 80.23,
      label: "Fixture address",
      locality: "Anna Nagar",
      city: "Chennai",
      country: "IN",
    },
  );
  assert.equal(result.latitude, 13.11);
  assert.equal(result.longitude, 80.22);
  assert.equal(result.label, "Fixture address");
  assert.equal(result.source, "live");
  assert.equal(result.accuracy, 14);
});
test("disabled optional reverse lookup does not call the provider and retains the real point", async () => {
  const selected = { latitude: 13.11, longitude: 80.22, source: "manual" as const };
  const result = await optionalReverseLocation(selected, false, async () => {
    throw Error("Must not contact provider");
  });
  assert.deepEqual(result, { point: selected, error: null });
});
test("provider failure and timeout retain usable coordinates for manual confirmation", async () => {
  const selected = { latitude: 13.11, longitude: 80.22, source: "live" as const, accuracy: 14 };
  for (const provider of [
    async () => {
      throw Error("LOCATION_PROVIDER_AUTH");
    },
    () => new Promise<never>(() => {}),
  ]) {
    const result = await optionalReverseLocation(selected, true, provider, 5);
    assert.deepEqual(result.point, selected);
    assert.ok(result.error);
    assert.equal(confirmedLocation(result.point, "Anna Nagar", "").formatted_address, "");
  }
});
test("confirmation does not await an in-flight address lookup", async () => {
  const selected = { latitude: 13.11, longitude: 80.22 };
  let release!: (value: Partial<Position>) => void;
  const enrichment = optionalReverseLocation(
    selected,
    true,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const result = confirmedLocation(selected, "  Anna Nagar  ", "");
  assert.equal(result.latitude, selected.latitude);
  assert.equal(result.locality, "Anna Nagar");
  release({});
  await enrichment;
});
test("confirmation never turns a default map viewport, missing point or malformed coordinates into a saved location", () => {
  assert.throws(() => confirmedLocation(null, "Anna Nagar", ""), /INVALID_LOCATION/);
  assert.throws(
    () => confirmedLocation({ latitude: NaN, longitude: 80 }, "Anna Nagar", ""),
    /INVALID_LOCATION/,
  );
  assert.throws(
    () => confirmedLocation({ latitude: 13, longitude: 80 }, " ", ""),
    /LOCATION_LOCALITY_REQUIRED/,
  );
});
test("manual coordinate edits must be valid and applied to the actual point before confirmation", () => {
  const selected = { latitude: 13.1, longitude: 80.2 };
  assert.equal(manualCoordinatesApplied(selected, "13.100", "80.2"), true);
  for (const [lat, lng] of [
    ["", "80.2"],
    ["91", "80.2"],
    ["13.2", "80.2"],
    ["13.1", "bad"],
  ]) {
    assert.equal(manualCoordinatesApplied(selected, lat, lng), false);
    assert.throws(
      () => confirmedLocation(selected, "Anna Nagar", "", { latitude: lat, longitude: lng }),
      /INVALID_LOCATION/,
    );
  }
  assert.equal(manualCoordinatesApplied(null, "13.1", "80.2"), false);
});
test("capability parsing fails closed while authentication/provider outages disable optional lookup only", () => {
  assert.deepEqual(locationCapabilities(null), { search: false, reverseGeocoding: false });
  assert.deepEqual(locationCapabilities({ search: "true", reverseGeocoding: true }), {
    search: false,
    reverseGeocoding: true,
  });
  assert.deepEqual(locationCapabilities({ search: true, reverseGeocoding: true }), {
    search: true,
    reverseGeocoding: true,
  });
  for (const code of [
    "LOCATION_PROVIDER_AUTH",
    "LOCATION_PROVIDER_DISABLED",
    "LOCATION_NOT_CONFIGURED",
    "LOCATION_UNAVAILABLE",
    "LOCATION_TIMEOUT",
  ])
    assert.equal(addressProviderUnavailable(Error(code)), true);
  assert.equal(addressProviderUnavailable(Error("AUTH_REQUIRED")), false);
  assert.equal(addressProviderUnavailable(Error("LOCATION_PERMISSION_DENIED")), false);
});
