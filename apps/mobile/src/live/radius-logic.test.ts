import { test } from "node:test";
import assert from "node:assert/strict";
import { radiusKmToMetres, validateRadiusMetres } from "./radius-logic.ts";
test("custom integer kilometres convert exactly to bounded metres", () => {
  for (const km of [1, 2, 3, 10, 17, 25, 50]) {
    assert.equal(radiusKmToMetres(km), km * 1000);
    assert.equal(radiusKmToMetres(String(km)), km * 1000);
    assert.equal(validateRadiusMetres(km * 1000), km * 1000);
  }
});
test("radius rejects blank, malformed, fractional and out-of-range input", () => {
  for (const value of [
    0,
    -1,
    51,
    NaN,
    Infinity,
    "",
    " ",
    "17km",
    "1e1",
    "1.5",
    1.5,
    null,
    undefined,
    true,
    {},
    "17 ",
  ])
    assert.throws(() => radiusKmToMetres(value));
  for (const value of [0, -1000, 51000, 1500, NaN, Infinity, "17000", null])
    assert.throws(() => validateRadiusMetres(value));
});
