const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const en = require("../apps/mobile/src/live/locales/en.json");
const ta = require("../apps/mobile/src/live/locales/ta.json");
test(
  "web review: credits, privacy, map interaction and responsive bilingual screens",
  { timeout: 180000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      channel: process.env.PREVIEW_BROWSER || "msedge",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
      const errors = [],
        forbidden = [];
      page.on("pageerror", () => errors.push("browser error"));
      await page.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (!["localhost", "127.0.0.1", "api.maptiler.com"].includes(u.hostname)) {
          forbidden.push(u.hostname);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(process.env.PREVIEW_URL || "http://localhost:8093");
      await page.getByRole("button", {name:"NearHire",exact:true}).click({delay:1000});
      await page.getByRole("button", { name: "DEV · Screens", exact: true }).click();
      await page.getByText("DEV · UI REVIEW", { exact: false }).waitFor({ timeout: 60000 });
      for (const [lang, dict] of [
        ["English", en],
        ["தமிழ்", ta],
      ]) {
        await page.getByRole("button", { name: lang, exact: true }).first().click();
        const menus = page.getByRole("button", { name: /^\d{2}\s/ });
        assert.equal(await menus.count(), 25);
        for (let i = 0; i < 25; i++) {
          await menus.nth(i).click();
          assert.ok((await page.getByRole("button").count()) > 25);
        }

        await menus.nth(5).click();
        const chip = (balance) =>
          page.getByRole("button", { name: balance + " " + dict.creditChipLabel, exact: true });
        await chip(5).click();
        await page.getByText(dict.profileCredits, { exact: true }).waitFor();
        await page.getByText("5 " + dict.availableCredits, { exact: true }).waitFor();
        await menus.nth(9).click();
        assert.equal(
          await page.getByText("5 " + dict.availableCredits, { exact: true }).count(),
          0,
        );
        await page.getByRole("button", { name: dict.publish, exact: true }).click();
        await page.getByText(dict.publishQuestion, { exact: true }).waitFor();
        await page.getByText(dict.balanceAfter + ": 4", { exact: true }).waitFor();
        await page.getByRole("button", { name: dict.publishJob, exact: true }).click();
        await menus.nth(5).click();
        await chip(4).click();
        await page.getByText("4 " + dict.availableCredits, { exact: true }).waitFor();
        await page.getByRole("button", { name: dict.developerInfo, exact: true }).click();
        await page.getByRole("button", { name: dict.creditsPreviewZero, exact: true }).click();
        await page.getByText(dict.noCredits, { exact: true }).waitFor();
        await menus.nth(5).click();
        await chip(0).click();
        await page.getByText(dict.profileCredits, { exact: true }).waitFor();
        await menus.nth(9).click();
        await page.getByRole("button", { name: dict.goJobCredits, exact: true }).click();
        await page.getByText(dict.profileCredits, { exact: true }).waitFor();
        await page.getByRole("button", { name: dict.creditsPreviewFive, exact: true }).click();
        await page.getByRole("button", { name: dict.developerInfo, exact: true }).click();
        await menus.nth(12).click();
        await page.getByRole("button", { name: dict.filters, exact: true }).click();
        await page.getByLabel(dict.customDistance, { exact: true }).fill("17");
        await page.getByRole("button", { name: dict.distanceIncrease, exact: true }).click();
        assert.equal(
          await page.getByLabel(dict.customDistance, { exact: true }).inputValue(),
          "18",
        );
        await page.getByRole("button", { name: dict.distanceDecrease, exact: true }).click();
        await page.getByRole("button", { name: dict.continue, exact: true }).click();
        await menus.nth(5).click();
        await menus.nth(11).click();
        await page.getByRole("button", { name: dict.filters, exact: true }).click();
        assert.equal(
          await page.getByLabel(dict.customDistance, { exact: true }).inputValue(),
          "17",
        );
        await page.getByLabel(dict.customDistance, { exact: true }).fill("51");
        await page.getByText(dict.distanceInvalid, { exact: true }).waitFor();
        await page.getByLabel(dict.customDistance, { exact: true }).fill("3");
        await page.getByRole("button", { name: dict.continue, exact: true }).click();
        for (const width of [360, 390, 412]) {
          await page.setViewportSize({ width, height: 844 });
          for (const index of [5, 9, 12, 22, 24]) {
            await page.getByRole("button", { name: dict.previewMenu, exact: true }).click();
            await menus.nth(index).click();
            assert.equal(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              true,
              `${lang} width ${width} screen ${index}`,
            );
            assert.equal(await page.getByLabel(dict.latitude, { exact: true }).count(), 0);
            assert.equal(await page.getByLabel(dict.longitude, { exact: true }).count(), 0);
          }
        }
        await page.setViewportSize({ width: 1280, height: 950 });
      }
      await page.getByRole("button", { name: "English", exact: true }).first().click();
      await page.getByRole("button", { name: /^13\s/ }).click();
      await page.locator('[data-map-ready="true"]').waitFor({ timeout: 60000 });
      await page
        .getByRole("button", { name: en.normalJob + ": " + en.electrician, exact: true })
        .click();
      await page.getByRole("button", { name: en.viewJob, exact: true }).click();
      await page.getByRole("button", { name: en.apply, exact: true }).waitFor();
      await page.getByRole("button", { name: en.back, exact: true }).click();
      await page.getByRole("button", { name: en.refreshLocation, exact: true }).click();
      await page.locator('[data-map-ready="true"]').waitFor({ timeout: 60000 });
      await page.locator(".maplibregl-canvas").click({ position: { x: 180, y: 260 } });
      await page.getByLabel(en.locality, { exact: true }).fill("Anna Nagar");
      assert.equal(
        await page.getByRole("button", { name: en.confirmLocation, exact: true }).isEnabled(),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(forbidden, []);
    } finally {
      await browser.close();
    }
  },
);
test("map failure is explicit and recoverable", async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: "msedge",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("https://api.maptiler.com/**", (r) =>
      r.fulfill({ status: 503, body: "unavailable" }),
    );
    await page.goto(process.env.PREVIEW_URL || "http://localhost:8093");
    await page.getByRole("button", {name:"NearHire",exact:true}).click({delay:1000});
      await page.getByRole("button", { name: "DEV · Screens", exact: true }).click();
    await page.getByRole("button", { name: /^13\s/ }).click();
    await page.getByText(en.mapFailed, { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: en.retry, exact: true }).count(), 1);
  } finally {
    await browser.close();
  }
});
test(
  "floating map controls preserve bilingual filters, markers and navigation",
  { timeout: 120000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      channel: "msedge",
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions:["geolocation"], geolocation:{latitude:13.085,longitude:80.21} });
      await page.goto(process.env.PREVIEW_URL || "http://localhost:8093");
      await page.getByRole("button", {name:"NearHire",exact:true}).click({delay:1000});
      await page.getByRole("button",{name:"DEV · Screens",exact:true}).click();
      for (const [lang, d] of [
        ["English", en],
        ["தமிழ்", ta],
      ]) {
        await page.getByRole("button", { name: lang, exact: true }).first().click();
        await page.getByRole("button", { name: d.previewMenu, exact: true }).click();
        await page.getByRole("button", { name: /^13\s/ }).click();
        await page.locator('[data-map-ready="true"]').waitFor({ timeout: 60000 });
        for (const width of [360, 390, 412]) {
          await page.setViewportSize({ width, height: 844 });
          const surface = await page.getByTestId("map-discovery-surface").boundingBox(),
            canvas = await page.locator(".maplibregl-canvas").boundingBox();
          assert.ok(Math.abs(surface.height - canvas.height) < 3);
          assert.ok(surface.height > 390); // Legacy gallery has an extra DEV return bar.
          assert.equal(await page.getByLabel(d.customDistance, { exact: true }).count(), 0);
          const normal = page.getByRole("button", {
            name: d.normalJob + ": " + d.electrician,
            exact: true,
          });
          assert.equal(await normal.locator("path").getAttribute("fill"), "#21834A");
          assert.equal(
            await page.locator('[data-urgency="urgent"] path').getAttribute("fill"),
            "#D94040",
          );
          await normal.click();
          assert.equal(await normal.getAttribute("aria-pressed"), "true");
          assert.equal(await normal.locator("svg").getAttribute("width"), "38");
          await page.getByRole("button", { name: d.viewJob, exact: true }).waitFor();
          await page.getByRole("button", { name: d.close, exact: true }).click();
          await page.getByRole("button", { name: d.useCurrentLocation, exact: true }).click();
        }
        await page.getByRole("button", { name: d.residential, exact: true }).click();
        await page
          .getByText(d.jobWithin.replace("{count}", "1").replace("{radius}", "3"), { exact: true })
          .waitFor();
        await page.getByRole("button", { name: d.list, exact: true }).click();
        await page.getByText(d.electrician, { exact: true }).waitFor();
        assert.equal(await page.getByText(d.bakeryHelper, { exact: true }).count(), 0);
        await page.getByRole("button", { name: d.map, exact: true }).click();
        await page.getByRole("button", { name: d.all, exact: true }).click();
        await page.getByRole("button", { name: d.filters, exact: true }).click();
        await page.getByLabel(d.customDistance, { exact: true }).fill("1");
        await page.getByRole("button", { name: d.continue, exact: true }).click();
        await page
          .getByText(d.jobsWithin.replace("{count}", "0").replace("{radius}", "1"), { exact: true })
          .waitFor();
        assert.equal(await page.locator("[data-urgency]").count(), 0);
        await page.getByRole("button", { name: d.filters, exact: true }).click();
        await page.getByLabel(d.customDistance, { exact: true }).fill("3");
        await page.getByRole("button", { name: d.continue, exact: true }).click();
      }
    } finally {
      await browser.close();
    }
  },
);
