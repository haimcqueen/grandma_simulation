import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://localhost:5174/probe.html");
await page.waitForFunction(
  () => window.probe?.metrics.ready,
  {},
  { timeout: 60000 },
);
await page.locator("#depth").uncheck();
const results = [];
for (const splat of ["flip", "raw"])
  for (const collider of ["raw", "flip"]) {
    await page.locator("#splat-axis").selectOption(splat);
    await page.locator("#collider-axis").selectOption(collider);
    const rays = [];
    for (const view of ["front", "left", "right"]) {
      await page.evaluate((view) => window.probe.setView(view), view);
      await page.waitForTimeout(400);
      rays.push(...(await page.evaluate(() => window.probe.compareSurfaces())));
    }
    const differences = rays
      .map((r) => r.distanceDifference)
      .filter((v) => v !== null)
      .sort((a, b) => a - b);
    results.push({
      splat,
      collider,
      median: differences[Math.floor(differences.length / 2)],
      matched: differences.length,
      rays,
    });
    await page.evaluate(() => window.probe.setView("front"));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `.artifacts/axes-${splat}-${collider}.png` });
  }
await writeFile(".artifacts/alignment.json", JSON.stringify(results, null, 2));
console.log(results.map(({ rays, ...rest }) => rest));
await browser.close();
