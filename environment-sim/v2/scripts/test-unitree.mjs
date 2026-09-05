import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('.artifacts', { recursive: true });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/simulation.html');
  await page.waitForFunction(() => window.houseLab?.viewer.mode === 'world-simulation' && window.houseLab.viewer.animatedResident?.robot, undefined, { timeout: 90000 });
  for (const [preset, asset] of [['grandma','g1'], ['upright','g1'], ['adult','h1'], ['baby','go2'], ['toddler','g1'], ['dog','go2']]) {
    await page.locator('#reset').click();
    await page.locator('#posture').selectOption(preset);
    await page.waitForFunction(preset => window.houseLab.simulation.posture === preset && !document.querySelector('#simulation-controls').inert, preset);
    assert.equal(await page.evaluate(() => window.houseLab.viewer.animatedResident.metadata.asset), asset);
    assert.equal(await page.locator('#play-fall').isDisabled(), asset === 'go2');
    for (const view of ['first', 'follow']) {
      await page.locator('#reset').click();
      await page.locator(`[data-view="${view}"]`).click();
      const start = await page.evaluate(() => window.houseLab.simulation.position.z);
      await page.keyboard.down('ArrowUp');
      await page.waitForFunction(start => window.houseLab.simulation.position.z > start + 0.08, start);
      await page.keyboard.up('ArrowUp');
      await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
      assert.equal(await page.evaluate(() => window.houseLab.viewer.view), view);
      const stop = await page.evaluate(() => window.houseLab.simulation.position);
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => window.houseLab.simulation.position), stop);
      await page.keyboard.down('ArrowDown');
      await page.waitForFunction(z => window.houseLab.simulation.position.z < z - 0.04, stop.z);
      await page.keyboard.up('ArrowDown');
      await page.waitForFunction(() => window.houseLab.simulation.currentSpeed === 0);
      await page.keyboard.down('ArrowLeft');
      await page.waitForFunction(() => window.houseLab.simulation.heading > 0.25);
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.houseLab.simulation.heading < 0.1);
      await page.keyboard.up('ArrowRight');
    }
    await page.screenshot({ path: `.artifacts/unitree-${preset}.png` });
  }
  await page.locator('#reset').click();
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.houseLab.simulation.posture === 'grandma' && !document.querySelector('#simulation-controls').inert);
  await page.locator('#pause').click();
  const waist = () => page.evaluate(() => window.houseLab.viewer.resident.root.getObjectByName('waist_pitch_joint').quaternion.toArray());
  const before = await waist();
  await page.keyboard.press('[');
  await page.waitForFunction(() => window.houseLab.simulation.hunch < 1);
  await page.waitForTimeout(150);
  assert.notDeepEqual(await waist(), before);
  await page.keyboard.press('k');
  await page.waitForFunction(() => window.houseLab.viewer.animatedResident.robot.skin === 'slate');
  await page.locator('#playback-speed').selectOption('0.25');
  assert.equal(await page.evaluate(() => window.houseLab.simulation.playbackSpeed), 0.25);
  assert.equal(await page.evaluate(() => window.houseLab.viewer.mode), 'world-simulation');
  const reuse = await page.evaluate(async () => {
    const api = await import('/src/unitree.ts');
    const resident = await api.loadRobotResident('grandma', { ...api.defaultRobotAssets.g1 });
    resident.root.position.set(2, 3, 4);
    resident.setMotion('grandma', 0.25, 0.5, 'slate');
    resident.setFall(null);
    resident.update(1, 0.2, true, false);
    resident.root.updateMatrixWorld(true);
    let minY = Infinity;
    resident.root.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.computeBoundingBox();
      minY = Math.min(minY, node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld).min.y);
    });
    const result = { position: resident.root.position.toArray(), skin: resident.robot.skin, minY };
    resident.dispose();
    return result;
  });
  assert.deepEqual(reuse.position, [2, 3, 4]);
  assert.equal(reuse.skin, 'slate');
  assert.ok(Math.abs(reuse.minY - 3) < 0.02, 'Standalone adapter preserves host placement and floor support');
  assert.deepEqual(errors, []);
  console.log('Unitree passes: all six body/movement presets, arrow forward/reverse/left/right in first and third person, braking, model loading, fall compatibility, posture and skin shortcuts, slow playback.');
} finally {
  await browser.close();
}
