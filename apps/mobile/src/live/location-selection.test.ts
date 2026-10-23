import test from "node:test";
import assert from "node:assert/strict";
import { mergeReverseLocation, resolveLocationSuggestion } from "./location-selection.ts";
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
