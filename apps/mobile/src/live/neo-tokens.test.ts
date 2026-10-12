import { test } from "node:test";
import assert from "node:assert/strict";
import { palette, softDepth, statusTone } from "./neo-tokens.ts";
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const l = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (l[0] + 0.05) / (l[1] + 0.05);
}
test("Soft UI readable primary/secondary text and primary buttons meet 4.5:1 contrast", () => {
  for (const bg of [palette.canvas, palette.surface])
    for (const fg of [palette.ink, palette.muted, palette.accent])
      assert.ok(contrast(fg, bg) >= 4.5, fg + " on " + bg);
  assert.ok(contrast(palette.white, palette.accent) >= 4.5);
  assert.ok(contrast(palette.boundary, palette.canvas) >= 3);
});
test("semantic states retain readable labels without relying on color alone", () => {
  for (const [fg, bg] of [
    [palette.positiveText, palette.positiveSurface],
    [palette.dangerText, palette.dangerSurface],
    [palette.warningText, palette.warningSurface],
  ])
    assert.ok(contrast(fg, bg) >= 4.5);
  assert.equal(statusTone("active"), "success");
  assert.equal(statusTone("urgent"), "danger");
  assert.equal(statusTone("pending"), "warning");
  assert.equal(statusTone("draft"), "neutral");
});
test("Android 7/8 and Android 9 inset requests use supported elevation/border fallbacks", () => {
  assert.equal(softDepth("android", 26).elevation, 2);
  assert.equal(softDepth("android", 28, true).elevation, 0);
  assert.ok(softDepth("android", 28).boxShadow);
  assert.ok(softDepth("android", 29, true).boxShadow?.includes("inset"));
});
test("web/iOS depth uses two bounded shadows, keeping map markers independent", () => {
  for (const platform of ["web", "ios"]) {
    const depth = softDepth(platform, 0);
    assert.ok(depth.boxShadow?.includes("-4px"));
    assert.ok(softDepth(platform, 0, true).boxShadow?.includes("inset"));
  }
});
