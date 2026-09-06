import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = process.env.BASE_URL || 'http://127.0.0.1:5174/';
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#app').dataset.ready === 'true', undefined, { timeout: 90000 });
  assert.equal(await page.locator('aside, select, input, [data-destination], #hazard-popup').count(), 0);
  assert.deepEqual(await page.locator('[data-view]').allTextContents(), ['First person', 'Third person', 'Wide', 'Map']);
  const state = () => page.evaluate(() => window.houseLab.simulation.snapshot());
  const initial = await state();
  await page.waitForTimeout(900);
  assert.deepEqual((await state()).position, initial.position, 'No autonomous walking');
  assert.equal(initial.posture, 'grandma');
  assert.equal(initial.hazardProfile, 'auto');
  assert.deepEqual(await page.evaluate(() => window.houseLab.simulation.environment.hazardZones.map(z => z.hazardId)), ['ottoman', 'dining_chair']);
  assert.deepEqual(initial.route, []);
  assert.equal(await page.evaluate(() => window.houseLab.viewer.hazards.root.visible), false);
  assert.equal(await page.evaluate(() => window.houseLab.viewer.destinations.children.length), 0);
  await mkdir('.artifacts', { recursive: true });
  for (const view of ['follow', 'first', 'overview', 'map']) {
    await page.keyboard.press('KeyR');
    await page.locator(`[data-view="${view}"]`).click();
    const before = (await state()).position;
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(before => Math.hypot(window.houseLab.simulation.position.x - before.x, window.houseLab.simulation.position.z - before.z) > 0.1, before);
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.view), view, 'Movement preserves selected camera');
    const stopped = (await state()).position;
    await page.waitForTimeout(250);
    assert.deepEqual((await state()).position, stopped);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.resident.root.visible), view !== 'first');
    await page.screenshot({ path: `.artifacts/walkthrough-${view}.png` });
  }
  // Walk across the old rug zone. No artificial props or invisible hazard falls remain.
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.houseLab.simulation.heading > 0.55);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
  assert.equal((await state()).fall, null);
  assert.ok((await state()).distance > 0.4);
  assert.equal((await state()).events.some(e => e.type === 'hazardEncountered'), false);
  const collision = await page.evaluate(async () => {
    const { isWalkable } = await import('/src/environment.ts');
    const sim = window.houseLab.simulation;
    sim.drive(1, 0, 30);
    return { clear: isWalkable(sim.environment, sim.position, sim.obstacles, sim.profile.radius), speed: sim.currentSpeed };
  });
  assert.equal(collision.clear, true);
  assert.equal(collision.speed, 0, 'Body still stops at room geometry');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['first', 'follow', 'overview', 'map']) {
    await page.locator(`[data-view="${view}"]`).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.screenshot({ path: '.artifacts/walkthrough-mobile.png' });
  await page.route('**/environment/tantau-navigation.json', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.reload();
  await page.locator('#retry').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-view]:enabled').count(), 0);
  await page.unroute('**/environment/tantau-navigation.json');
  await page.locator('#retry').click();
  await page.waitForFunction(() => document.querySelector('#app').dataset.ready === 'true', undefined, { timeout: 90000 });
  assert.deepEqual(errors, []);
  console.log('Walkthrough passed: clean room, idle start, keyboard movement/braking, four persistent camera views, ottoman and chair hazards, collision, responsive layout and retry.');
} finally { await browser.close(); }
