import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const query of ['?house=1', '']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5174/${query}`);
    await page.waitForFunction(() => document.querySelector('#app').dataset.ready === 'true', undefined, { timeout: 120000 });
    const before = await page.evaluate(() => {
      const s = window.houseLab.simulation; s.paused = true;
      return { position: { ...s.position }, floor: s.floorId, heading: s.heading, speed: s.profile.speed, autoFalls: s.autoHazardFalls };
    });
    await page.locator('#grandma-toggle').click();
    await page.waitForFunction(() => document.querySelector('#grandma-toggle').getAttribute('aria-pressed') === 'true');
    assert.deepEqual(await page.evaluate(() => {
      const s = window.houseLab.simulation;
      return { position: { ...s.position }, floor: s.floorId, heading: s.heading, speed: s.profile.speed, autoFalls: s.autoHazardFalls };
    }), before);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.resident.root.children.length), 1);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.animatedResident.metadata.animation), 'unitree-retargeted');
    await page.screenshot({ path: `.artifacts/grandma-${query ? 'house' : 'room'}.png` });
    await page.evaluate(() => { window.houseLab.simulation.paused = false; });
    await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
    assert.ok(await page.evaluate(() => window.houseLab.simulation.distance) > 0);
    await page.locator('[data-view="first"]').click();
    assert.equal(await page.evaluate(() => window.houseLab.viewer.view), 'first');
    await page.locator('[data-view="follow"]').click();
    if (query) {
      for (const floor of ['upper', 'ground']) {
        await page.locator('#walk-floor').click();
        await page.evaluate(() => { const {simulation:s,movement:m}=window.houseLab; for(let i=0;i<12000&&m.status==='running';i++){s.advance(1/60);m.advance();} });
        await page.waitForFunction(() => window.houseLab.viewer.environment.id === window.houseLab.simulation.environment.id);
        assert.equal(await page.evaluate(() => window.houseLab.simulation.floorId), floor);
      }
    } else {
      await page.evaluate(() => { const s=window.houseLab.simulation; s.playFall('sideways'); });
      await page.waitForFunction(() => window.houseLab.simulation.fall !== null && document.querySelector('#grandma-toggle').disabled);
      assert.equal(await page.locator('#grandma-toggle').isDisabled(), true);
      await page.keyboard.press('r');
      await page.waitForFunction(() => window.houseLab.simulation.fall === null);
    }
    await page.locator('#grandma-toggle').click();
    await page.waitForFunction(() => document.querySelector('#grandma-toggle').getAttribute('aria-pressed') === 'false');
    assert.ok(await page.evaluate(() => !!window.houseLab.viewer.animatedResident.robot));
    assert.equal(await page.evaluate(() => window.houseLab.simulation.autoHazardFalls), before.autoFalls);
    await page.route('**/characters/grandma-idle.glb', route => route.abort());
    await page.locator('#grandma-toggle').click();
    await page.waitForFunction(() => document.querySelector('#character-status').textContent.includes('Could not switch'));
    assert.ok(await page.evaluate(() => !!window.houseLab.viewer.animatedResident.robot));
    assert.equal(await page.evaluate(() => window.houseLab.simulation.autoHazardFalls), before.autoFalls);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS Grandma toggle: both hosts, preserved state, WASD, robot restore, failed load rollback, mobile');
} finally { await browser.close(); }
