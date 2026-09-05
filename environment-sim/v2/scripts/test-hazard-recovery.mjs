import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('.artifacts', { recursive: true });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/simulation.html');
  await page.waitForFunction(() => window.houseLab?.viewer.mode === 'world-simulation' && window.houseLab.viewer.animatedResident?.robot, undefined, { timeout: 90000 });
  assert.equal(await page.locator('#hazard-falls').isChecked(), true);
  for (const view of ['follow', 'first']) {
    await page.locator('#reset').click();
    await page.locator(`[data-view="${view}"]`).click();
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => window.houseLab.simulation.heading > 0.55);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.houseLab.simulation.status === 'falling');
    await page.keyboard.up('ArrowUp');
    assert.equal(await page.evaluate(() => window.houseLab.simulation.fall.kind), 'trip');
    await page.waitForFunction(() => window.houseLab.simulation.status === 'fallen');
    assert.equal(await page.evaluate(() => window.houseLab.viewer.view), view);
    const lying = await page.evaluate(() => {
      const r = window.houseLab.viewer.animatedResident.robot.root;
      return { pitch: r.rotation.x, y: r.position.y };
    });
    assert.ok(lying.pitch > 1.4);
    await page.screenshot({ path: `.artifacts/hazard-${view}-fallen.png` });
    await page.waitForFunction(() => window.houseLab.simulation.status === 'recovering');
    await page.locator('#pause').click();
    const paused = await page.evaluate(() => window.houseLab.simulation.snapshot());
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(() => window.houseLab.simulation.snapshot()), paused);
    await page.locator('#pause').click();
    await page.waitForFunction(() => {
      const f = window.houseLab.simulation.fall;
      return f && f.elapsed > 5.2;
    });
    await page.screenshot({ path: `.artifacts/hazard-${view}-recovering.png` });
    await page.waitForFunction(() => window.houseLab.simulation.fall === null);
    const standing = await page.evaluate(() => {
      const { simulation: s, viewer: v } = window.houseLab;
      return { manual: s.manual, pitch: v.animatedResident.robot.root.rotation.x,
        y: v.animatedResident.robot.root.position.y, position: { ...s.position }, events: s.events };
    });
    assert.equal(standing.manual, true);
    assert.ok(Math.abs(standing.pitch) < 0.01);
    assert.ok(standing.y > lying.y + 0.1);
    assert.equal(standing.events.filter(e => e.type === 'fallStarted').length, 1);
    await page.screenshot({ path: `.artifacts/hazard-${view}-standing.png` });
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowDown');
    assert.notDeepEqual(await page.evaluate(() => window.houseLab.simulation.position), standing.position);
    assert.equal(await page.evaluate(() => window.houseLab.simulation.fall), null);
  }
  await page.locator('#reset').click();
  await page.locator('[data-view="follow"]').click();
  await page.locator('[data-destination="kitchen"]').click();
  await page.waitForFunction(() => window.houseLab.simulation.status === 'arrived', undefined, { timeout: 60000 });
  const events = await page.evaluate(() => window.houseLab.simulation.events);
  assert.ok(events.some(e => e.type === 'fallStarted'));
  assert.ok(events.some(e => e.type === 'recoveryCompleted'));
  assert.equal(await page.evaluate(() => window.houseLab.simulation.fall), null);
  assert.deepEqual(errors, []);
  console.log('Hazard recovery passes: arrow entry, fall/rest/get-up in first and third person, pause, pose height, manual return and automatic route completion.');
} finally { await browser.close(); }
