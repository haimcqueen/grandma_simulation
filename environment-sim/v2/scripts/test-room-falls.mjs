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
  await page.locator('[data-view="first"]').click();
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.houseLab.simulation.distance > 0.15);
  await page.keyboard.up('w');
  await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
  assert.equal(await page.evaluate(() => window.houseLab.viewer.view), 'first');
  assert.equal(await page.evaluate(() => window.houseLab.viewer.resident.root.visible), false);
  // A mode flag can become ready before RAD pages have drawn. Verify actual room pixels.
  await page.waitForFunction(() => {
    const { viewer, simulation } = window.houseLab;
    viewer.update(simulation);
    const gl = viewer.renderer.getContext();
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let offset = 0; offset < pixels.length; offset += 4096) colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
    return colors.size > 50;
  }, undefined, { timeout: 60000, polling: 500 });
  await page.screenshot({ path: '.artifacts/real-room-first-person.png' });
  await page.keyboard.press('v');
  await page.waitForFunction(() => window.houseLab.viewer.view === 'follow' && window.houseLab.viewer.resident.root.visible);
  const poses = [];
  for (const kind of ['trip', 'patio', 'sideways']) {
    await page.locator('#reset').click();
    await page.locator('#fall-kind').selectOption(kind);
    await page.locator('#play-fall').click();
    await page.waitForFunction(() => window.houseLab.simulation.fall?.elapsed > 0.85);
    await page.locator('#pause').click();
    const state = await page.evaluate(() => window.houseLab.simulation.snapshot());
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.houseLab.simulation.snapshot()), state);
    poses.push(await page.evaluate(() => window.houseLab.viewer.animatedResident.robot.root.quaternion.toArray()));
    await page.screenshot({ path: `.artifacts/real-room-fall-${kind}.png` });
    await page.locator('#pause').click();
    await page.waitForFunction(() => window.houseLab.simulation.status === 'fallen');
    assert.equal(await page.evaluate(() => window.houseLab.viewer.mode), 'world-simulation');
    assert.equal(await page.locator('#routine').isDisabled(), true);
    await page.locator('#play-fall').click();
    await page.waitForFunction(() => window.houseLab.simulation.status === 'falling');
  }
  assert.notDeepEqual(poses[0], poses[1]);
  assert.notDeepEqual(poses[1], poses[2]);
  await page.locator('#reset').click();
  await page.waitForFunction(() => !window.houseLab.simulation.fall);
  await page.locator('[data-view="first"]').click();
  await page.keyboard.press('v');
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.houseLab.viewer.view === 'first');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.deepEqual(errors, []);
  console.log('Real room passes: default world asset, first-person walking, third-person, three articulated falls, pause/replay/reset, camera shortcuts, mobile and no page errors.');
} finally {
  await browser.close();
}
