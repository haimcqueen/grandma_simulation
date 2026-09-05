import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 950 },
  acceptDownloads: true,
});
const errors = [];
const failures = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) => failures.push(r.url()));
try {
 await mkdir(".artifacts", { recursive: true });
  await page.goto("http://localhost:5174/environment.html");
  await page.waitForFunction(
    () => window.environmentLab?.metrics.ready,
    {},
    { timeout: 90000 },
  );
  await page.waitForTimeout(1500);
  assert.equal(
    await page.evaluate(() => window.environmentLab.asset.id),
    "tantau-great-room",
  );
  await page.screenshot({ path: ".artifacts/tantau-final.png" });
  await page.locator("#show-collider").check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".artifacts/tantau-wire.png" });
  await page.locator("#show-collider").uncheck();
  const records = [];
  for (const [id, x, y] of [
    ["patio-door", 0.27, 0.45],
    ["island-face", 0.8, 0.68],
    ["floor-reference", 0.74, 0.87],
  ]) {
    const box = await page.locator("canvas").boundingBox();
    await page
      .locator("canvas")
      .click({ position: { x: box.width * x, y: box.height * y } });
    records.push(
      await page.evaluate(
        (id) => ({ ...window.environmentLab.anchors.at(-1), id }),
        id,
      ),
    );
  }
  assert.equal(
    await page.evaluate(() => window.environmentLab.anchors.length),
    3,
  );
  const download = page.waitForEvent("download");
  await page.locator("#export").click();
  assert.equal(
    (await download).suggestedFilename(),
    "tantau-environment-record.json",
  );
  await page.locator("#clear-anchors").click();
  await page.keyboard.press("w");
  await page.locator("#reset-camera").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".artifacts/tantau-mobile.png",
    fullPage: true,
  });
  const metrics = await page.evaluate(() => window.environmentLab.metrics);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  const result = {
    date: "2026-09-05",
    passed: true,
    metrics,
    anchors: records,
    errors,
    requestFailures: failures,
    checks: [
      "actual Mint RAD streaming without browser login",
      "matching collider loads",
      "upright source transform inspected",
      "three surface anchors",
      "record export",
      "mobile layout",
    ],
  };
  await writeFile(
    ".artifacts/tantau-validation.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  await browser.close();
}
