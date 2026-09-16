import test from "node:test";
import assert from "node:assert/strict";
import {
  configuredMapProvider,
  resolveMapProvider,
  OPEN_MAP,
  coordinates,
  activeNearby,
  mapStyleUrl,
  boundedLocation,
  locationErrorKey,
} from "./location-logic.ts";
test("coordinates validate bounds and reject missing, blank, infinite and nonnumeric input", () => {
  assert.deepEqual(coordinates("-90", "180"), { latitude: -90, longitude: 180 });
  for (const [lat, lng] of [
    [91, 0],
    [0, -181],
    ["", 0],
    ["   ", 0],
    [0, "\t"],
    [null, 0],
    [true, 0],
    [NaN, 0],
    [Infinity, 0],
    ["hello", 0],
  ])
    assert.throws(() => coordinates(lat, lng));
});
test("map and list share exact expiry exclusion and duplicate suppression", () => {
  const row = (id: string, status = "active", expiry = 2000) => ({
    job: { id, status, expires_at: new Date(expiry).toISOString() },
  });
  const rows = [
    row("one"),
    row("one"),
    row("expired", "active", 1000),
    row("cancelled", "cancelled"),
    row("suspended", "suspended"),
    row("reported", "reported"),
  ];
  assert.deepEqual(
    activeNearby(rows, 1000).map((r) => r.job.id),
    ["one"],
  );
  assert.equal(activeNearby(rows, 2000).length, 0);
});
test("production map configuration requires HTTPS and rejects demo tiles", () => {
  for (const value of [
    undefined,
    "http://tiles.example/style.json",
    "https://demotiles.maplibre.org/style.json",
    "invalid",
  ])
    assert.equal(mapStyleUrl(value), null);
  assert.equal(mapStyleUrl("https://tiles.example/style.json"), "https://tiles.example/style.json");
});
test("GPS acquisition timeout and permanent denial have recoverable messages", async () => {
  await assert.rejects(boundedLocation(new Promise(() => {}), 5), /LOCATION_TIMEOUT/);
  assert.equal(await boundedLocation(Promise.resolve("gps"), 50), "gps");
  assert.equal(locationErrorKey(new Error("LOCATION_PERMISSION_PERMANENT")), "locationPermanent");
  assert.equal(locationErrorKey(new Error("GPS_DISABLED")), "gpsDisabled");
});

test("default is keyless OpenFreeMap with data attribution", () => {
  assert.deepEqual(configuredMapProvider(), OPEN_MAP);
  assert.equal(new URL(OPEN_MAP.styleURL).search, "");
  for (const name of ["OpenFreeMap", "OpenMapTiles", "OpenStreetMap"])
    assert.ok(OPEN_MAP.attribution.includes(name));
});
test("custom hosting requires HTTPS and attribution; paid and OSM public hosts rejected", () => {
  for (const url of [
    undefined,
    "http://maps.example/style",
    "https://tile.openstreetmap.org/style",
    "https://api.maptiler.com/style",
  ])
    assert.equal(resolveMapProvider(url, "Data attribution"), OPEN_MAP);
  assert.equal(resolveMapProvider("https://maps.example/style"), OPEN_MAP);
  assert.equal(
    resolveMapProvider("https://maps.example/style", "OSM").styleURL,
    "https://maps.example/style",
  );
});
