import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 950 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await mkdir(".artifacts", { recursive: true });
  await page.goto("http://localhost:5174/environment.html?sample=1");
  await page.waitForFunction(
    () => window.environmentLab?.metrics.ready,
    {},
    { timeout: 60000 },
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: ".artifacts/environment-sample.png" });
  await page.locator("#show-collider").check();
  await page.locator("#show-grid").check();
  assert.equal(
    await page.evaluate(() => window.environmentLab.world.wire.visible),
    true,
  );
  await page.locator("#show-collider").uncheck();
  await page.locator("#show-grid").uncheck();
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.6 } });
  assert.ok(
    (await page.evaluate(() => window.environmentLab.anchors.length)) > 0,
  );
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  assert.equal(
    (await download).suggestedFilename(),
    "tantau-environment-record.json",
  );
  await page.locator("#clear-anchors").click();
  assert.equal(
    await page.evaluate(() => window.environmentLab.anchors.length),
    0,
  );
  await page.locator("#overview").click();
  await page.locator("#inside").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".artifacts/environment-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Environment loading, layer controls, anchors, export, views and mobile layout passed.",
  );
  await writeFile(
    ".artifacts/environment-browser.json",
    JSON.stringify(
      {
        passed: true,
        errors,
        checks: [
          "sample assets",
          "collider toggle",
          "grid toggle",
          "surface anchors",
          "record export",
          "camera presets",
          "mobile overflow",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
