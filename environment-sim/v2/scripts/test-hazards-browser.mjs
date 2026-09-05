import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('.artifacts', { recursive: true });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/');
  await page.waitForFunction(() => window.houseLab?.viewer.mode === 'world-simulation' && window.houseLab.viewer.animatedResident?.robot, undefined, { timeout: 90000 });
  await page.locator('#reset').click();
  assert.equal(await page.evaluate(() => window.houseLab.viewer.hazards.root.children.length), 3);
  await page.locator('[data-view="first"]').click();
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.houseLab.simulation.heading > 0.55);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.houseLab.simulation.pendingHazard?.zone.hazardId === 'loose_rug');
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
  await page.locator('#pause').click();
  assert.equal(await page.locator('#hazard-popup').isVisible(), true);
  assert.equal(await page.evaluate(() => window.houseLab.viewer.view), 'first');
  await page.locator('#hazard-dismiss').click();
  assert.equal(await page.locator('#hazard-popup').isVisible(), false);
  await page.locator('#pause').click();
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#hazard-popup').isVisible(), false);
  await page.locator('#reset').click();
  await page.locator('[data-destination="kitchen"]').click();
  await page.waitForFunction(() => window.houseLab.simulation.status === 'arrived', undefined, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#hazard-popup').dataset.severity === 'low');
  await page.locator('#hazard-profile').selectOption('toddler');
  await page.waitForFunction(() => document.querySelector('#hazard-popup').dataset.severity === 'high');
  await page.locator('[data-view="follow"]').click();
  await page.screenshot({ path: '.artifacts/real-room-hazards.png' });
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => window.houseLab.simulation.snapshot());
  for (const view of ['map', 'top', 'side', 'overview', 'follow']) {
    await page.locator(`[data-view="${view}"]`).click();
    await page.waitForFunction(view => {
      const viewer = window.houseLab.viewer;
      return viewer.view === view && viewer.hazards.root.parent === (view === 'map' ? viewer.topScene : viewer.overlayScene)
        && viewer.hazards.root.getObjectByName('hazard-zone-outline').visible === (view === 'map');
    }, view);
    assert.equal(await page.locator('#hazard-popup').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.houseLab.simulation.snapshot()), paused);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.hazards.root.getObjectByName('hazard-zone-outline').visible), view === 'map');
    if (view === 'map') await page.screenshot({ path: '.artifacts/hazards-map.png' });
  }
  await page.locator('#pause').click();
  await page.locator('#hazard-props').uncheck();
  await page.waitForFunction(() => !window.houseLab.viewer.hazards.root.visible);
  assert.equal(await page.locator('#hazard-popup').isVisible(), true, 'Hiding props does not disable detection');
  await page.locator('#hazard-profile').selectOption('off');
  assert.equal(await page.locator('#hazard-popup').isVisible(), false);
  await page.locator('#hazard-profile').selectOption('toddler');
  await page.locator('#play-fall').click();
  await page.waitForFunction(() => window.houseLab.simulation.status === 'fallen');
  assert.equal(await page.locator('#hazard-popup').isVisible(), false);
  await page.locator('#reset').click();
  await page.locator('#environment').selectOption('fixture');
  assert.equal(await page.evaluate(() => window.houseLab.viewer.hazards.root.children.length), 0);
  assert.equal(await page.evaluate(() => window.houseLab.simulation.pendingHazard), null);
  await page.locator('#environment').selectOption('generated');
  await page.waitForFunction(() => window.houseLab.viewer.mode === 'world-simulation', undefined, { timeout: 90000 });
  await page.locator('#reset').click();
  await page.locator('[data-destination="kitchen"]').click();
  await page.waitForFunction(() => window.houseLab.simulation.status === 'arrived', undefined, { timeout: 20000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#hazard-popup').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.deepEqual(errors, []);
  console.log('Hazards pass: real-room props, arrow-key entry, first/third person, route entry/exit, dismiss, profile changes, independent visibility, fall/reset, environment switching and mobile.');
} finally { await browser.close(); }
