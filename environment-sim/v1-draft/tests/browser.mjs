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
await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:5173");
await page.locator("canvas").waitFor();
await page.waitForFunction(() => document.querySelector('#figurine-status').textContent.startsWith('Your figurine'), {}, { timeout: 30000 });
assert.equal(await page.locator('#speed').inputValue(), '0.77');
await page.locator('#subject').selectOption('baby');
await page.waitForFunction(() => document.querySelector('#speed').value === '0.28');
await page.locator('#subject').selectOption('adult');
await page.waitForFunction(() => document.querySelector('#speed').value === '1.3');
await page.locator('#subject').selectOption('grandma');
await page.waitForFunction(() => document.querySelector('#speed').value === '0.77');
await page.locator('#figurine').uncheck();
await page.locator('#figurine').check();
await page.locator('#subject').focus();
await page.locator('#subject').selectOption('grandma-figurine');
await page.waitForFunction(() => document.querySelector('#motion-note').textContent.startsWith('Controlling your grandma'));
assert.equal(await page.locator('#figurine').isDisabled(), true);
await page.keyboard.down('ArrowUp');
await page.waitForFunction(() => parseFloat(document.querySelector('#distance').textContent) > 0.3);
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: '.artifacts/controllable-grandma.png', fullPage: true });
await page.getByRole('button', { name: 'Reset resident' }).click();
assert.equal(await page.locator('#subject').inputValue(), 'grandma-figurine');
await page.keyboard.press('1');
await page.waitForFunction(() => document.querySelector('#subject').value === 'grandma');
assert.equal(await page.locator('#figurine').isDisabled(), false);
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
  { timeout: 30000 },
);
await page.getByRole("button", { name: "Reset resident" }).click();
await page.locator('#patio-fall').check();
await page.locator('[data-destination="patio"]').click();
await page.waitForFunction(() => document.querySelector('#status').textContent === 'Robot down · Reset to stand up', {}, { timeout: 30000 });
assert.match(await page.locator('#events').innerText(), /Patio fall demo/);
await page.screenshot({ path: '.artifacts/patio-fall.png', fullPage: true });
await page.locator('[data-destination="kitchen"]').click();
assert.equal(await page.locator('#status').innerText(), 'Robot down · Reset to stand up');
await page.getByRole('button', { name: 'Reset resident' }).click();
await page.locator('#patio-fall').uncheck();
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
  "Browser checks passed: controllable grandma, character switching, patio fall and reset, WebGL render, blocked route, cart detour arrival, camera, pause, mobile overflow, no page errors.",
);
await browser.close();
