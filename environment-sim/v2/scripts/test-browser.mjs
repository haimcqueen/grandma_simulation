import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir(".artifacts", { recursive: true });
try {
  await page.goto("http://localhost:5174/simulation.html?fixture=1");
  await page.waitForFunction(() => window.houseLab);
  await page.waitForTimeout(500);
  await page.screenshot({ path: ".artifacts/v2-overview.png" });
  await page.locator('[data-destination="kitchen"]').click();
  await page.locator('[data-scenario="cart"]').click();
  await page.waitForFunction(
    () => window.houseLab.simulation.status === "arrived",
    {},
    { timeout: 20000 },
  );
  assert.ok(
    await page.evaluate(() =>
      window.houseLab.simulation.events.some(
        (e) => e.type === "routeReplanned",
      ),
    ),
  );
  const distance = await page.evaluate(
    () => window.houseLab.simulation.distance,
  );
  assert.ok(distance > 4.9);
  await page.locator("#reset").click();
  await page.locator('[data-scenario="blocked"]').click();
  await page.locator('[data-destination="kitchen"]').click();
  await page.waitForFunction(
    () => window.houseLab.simulation.status === "blocked",
  );
  await page.screenshot({ path: ".artifacts/v2-blocked.png" });
  await page.locator('[data-scenario="clear"]').click();
  await page.waitForFunction(
    () => window.houseLab.simulation.status === "walking",
  );
  await page.locator("#pause").click();
  const paused = await page.evaluate(() =>
    window.houseLab.simulation.snapshot(),
  );
  await page.waitForTimeout(300);
  assert.deepEqual(
    await page.evaluate(() => window.houseLab.simulation.snapshot()),
    paused,
  );
  await page.locator("#reset").click();
  await page.locator('[data-view="interior"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".artifacts/v2-interior.png" });
  await page.locator("#environment").selectOption("sample");
  await page.waitForFunction(
    () => window.houseLab.viewer.mode === "world",
    {},
    { timeout: 60000 },
  );
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".artifacts/v2-world.png" });
  // Check that the depth-only pass leaves the backdrop untouched when no marker is rendered.
  await page.evaluate(() => {
    const v = window.houseLab.viewer;
    v.marker.root.visible = false;
    v.worldDepth = false;
    v.controls.enableDamping = false;
  });
  await page.waitForTimeout(800);
  const noDepth = await page.locator("canvas").screenshot();
  await page.evaluate(() => {
    window.houseLab.viewer.worldDepth = true;
  });
  await page.waitForTimeout(300);
  const depth = await page.locator("canvas").screenshot();
  assert.deepEqual(
    depth,
    noDepth,
    "Depth pass must not punch holes in splat color",
  );
  await page.evaluate(() => {
    const v = window.houseLab.viewer;
    v.marker.root.visible = true;
    v.camera.position.set(0, 0, -1);
    v.controls.target.set(0, -0.1, 3);
    v.controls.update();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: ".artifacts/v2-occlusion.png" });
  await page.evaluate(() => {
    const v = window.houseLab.viewer;
    v.marker.root.position.set(0, -1.08, 4.5);
    v.marker.root.visible = false;
  });
  await page.waitForTimeout(500);
  const behindBaseline = await page.locator("canvas").screenshot();
  await page.evaluate(() => {
    window.houseLab.viewer.marker.root.visible = true;
  });
  await page.waitForTimeout(300);
  assert.deepEqual(
    await page.locator("canvas").screenshot(),
    behindBaseline,
    "Room wall occludes resident placed behind it",
  );
  await page.evaluate(() => {
    window.houseLab.viewer.worldDepth = false;
  });
  await page.waitForTimeout(300);
  assert.notDeepEqual(
    await page.locator("canvas").screenshot(),
    behindBaseline,
    "The same resident is visible when occlusion is disabled",
  );
  await page.locator("#environment").selectOption("fixture");
  await page.waitForFunction(() => window.houseLab.viewer.mode === "fixture");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: ".artifacts/v2-mobile.png", fullPage: true });
  // Explicit missing-asset response exercises recovery without a successful SPA fallback.
  await page.route("**/samples/kitchen.spz", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.locator("#environment").selectOption("sample");
  await page.waitForFunction(
    () =>
      document.querySelector("#notice").textContent.includes("could not load"),
    {},
    { timeout: 30000 },
  );
  assert.equal(
    await page.evaluate(() => window.houseLab.viewer.mode),
    "fixture",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    ".artifacts/v2-browser.json",
    JSON.stringify(
      {
        passed: true,
        cartDistance: distance,
        errors,
        checks: [
          "arrival",
          "active replan",
          "barrier",
          "pause",
          "reset",
          "world loading",
          "depth preserves backdrop",
          "resident occluded behind wall",
          "mobile overflow",
          "missing asset recovery",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Browser simulation, rendering, mobile layout and recovery checks passed.",
  );
} finally {
  await browser.close();
}
