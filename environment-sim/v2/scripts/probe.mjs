import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await mkdir(".artifacts", { recursive: true });
await page.goto("http://localhost:5174/probe.html");
await page.waitForFunction(
  () => window.probe?.metrics.ready || window.probe?.metrics.error,
  {},
  { timeout: 60000 },
);
console.log(await page.evaluate(() => window.probe.metrics));
if (await page.evaluate(() => window.probe.metrics.error))
  throw Error("Sample failed");
await page.waitForTimeout(2000);
for (const view of ["front", "left", "right"]) {
  await page.evaluate((view) => window.probe.setView(view), view);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `.artifacts/${view}.png` });
  await page.locator("#collider").check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `.artifacts/${view}-wire.png` });
  await page.locator("#collider").uncheck();
  console.log(view, await page.evaluate(() => window.probe.compareSurfaces()));
}
const initial = await page.evaluate(() => ({
  ...window.probe.metrics,
  memory: window.probe.renderer.info.memory,
}));
await page.locator("#reload").click();
await page.waitForFunction(
  () => window.probe.metrics.loadCount === 2,
  {},
  { timeout: 60000 },
);
await page.waitForTimeout(2000);
const reloaded = await page.evaluate(() => ({
  ...window.probe.metrics,
  memory: window.probe.renderer.info.memory,
}));
await writeFile(
  ".artifacts/metrics.json",
  JSON.stringify({ initial, reloaded, errors }, null, 2),
);
console.log("errors", errors);
assert.deepEqual(errors, []);
await page.evaluate(() => window.probe.setView("right"));
await page.waitForTimeout(500);
await page.screenshot({ path: ".artifacts/marker-visible.png" });
await page.locator("#depth").check();
await page.waitForTimeout(500);
await page.screenshot({ path: ".artifacts/marker-depth.png" });
await page.locator("#depth").uncheck();
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.screenshot({ path: ".artifacts/mobile.png", fullPage: true });
await page.goto("http://localhost:5174/probe.html/?missing=1");
await page.waitForFunction(
  () => window.probe?.metrics.error,
  {},
  { timeout: 30000 },
);
console.log(
  "missing asset message",
  await page.locator("#loading").innerText(),
);
await browser.close();
