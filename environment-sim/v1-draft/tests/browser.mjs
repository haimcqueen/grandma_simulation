import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:5173");
await page.locator("canvas").waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: ".artifacts/desktop.png", fullPage: true });
await page.getByRole("button", { name: "Block route", exact: true }).click();
await page.locator('[data-destination="kitchen"]').click();
await page.waitForFunction(
  () => document.querySelector("#status").textContent === "Route blocked",
);
assert.match(await page.locator("#events").innerText(), /No clear route/);
await page.getByRole("button", { name: "Add cart", exact: true }).click();
await page.waitForFunction(
  () => document.querySelector("#status").textContent === "Walking to kitchen",
);
await page.locator("#speed").fill("1.6");
await page.waitForFunction(
  () => document.querySelector("#status").textContent === "Arrived · kitchen",
  {},
  { timeout: 20000 },
);
await page.getByRole("button", { name: "Reset resident" }).click();
await page.getByRole("button", { name: "Floor plan", exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".artifacts/top-down.png", fullPage: true });
await page.getByRole("button", { name: "Pause", exact: false }).click();
const before = await page.locator("#elapsed").innerText();
await page.waitForTimeout(1100);
assert.equal(await page.locator("#elapsed").innerText(), before);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: ".artifacts/mobile.png", fullPage: true });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
assert.deepEqual(errors, []);
console.log(
  "Browser checks passed: WebGL render, blocked route, cart detour arrival, reset, camera, pause, mobile overflow, no page errors.",
);
await browser.close();
