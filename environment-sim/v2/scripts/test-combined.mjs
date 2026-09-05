import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const ready=()=>page.waitForFunction(()=>window.houseLab?.viewer.mode==='world-simulation',{}, {timeout:60000});
try {
 await mkdir(".artifacts", { recursive: true });
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/');await ready();
 await page.waitForFunction(() => window.houseLab?.viewer.animatedResident?.robot?.meshCount > 0);
 // Isolate navigation/obstacle checks; test:recovery covers automatic hazard falls.
 await page.locator('#hazard-falls').uncheck();
 assert.equal(await page.locator('#resident-name').innerText(), 'Unitree G1');
 const robotPose = () => page.evaluate(() => {
  const root = window.houseLab.viewer.resident.root;
  return { heading: root.quaternion.toArray(), joints: ['left_hip_pitch_joint', 'right_hip_pitch_joint', 'left_knee_joint'].map(name => root.getObjectByName(name).quaternion.toArray()) };
 });
 const initialPose = await robotPose();
 const initialDistance = await page.evaluate(() => window.houseLab.simulation.distance);
 await page.waitForFunction(distance => window.houseLab.simulation.distance > distance + 0.3, initialDistance);
 assert.notDeepEqual((await robotPose()).joints, initialPose.joints, 'Robot joints follow walking distance');
 assert.equal(await page.evaluate(()=>window.houseLab.routine.active),true);
 await page.locator('#pause').click();
 const paused=await page.evaluate(()=>window.houseLab.simulation.snapshot());
 const pausedPose = await robotPose();
 await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.houseLab.simulation.snapshot()),paused);
 assert.deepEqual(await robotPose(), pausedPose, 'Pause freezes robot joints and heading');
 const footOffset = await page.evaluate(() => {
  const root = window.houseLab.viewer.resident.root;
  root.updateMatrixWorld(true);
  let minimumY = Infinity;
  root.traverse(node => {
   if (!node.isMesh) return;
   node.geometry.computeBoundingBox();
   minimumY = Math.min(minimumY, node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld).min.y);
  });
  return minimumY - root.position.y;
 });
 assert.ok(Math.abs(footOffset) < 0.02, 'Robot feet follow the sampled room floor');
 await page.screenshot({path:'.artifacts/combined-walking.png'});
 await page.locator('#reset').click();
 await page.locator('[data-scenario="cart"]').click();
 await page.locator('[data-destination="kitchen"]').click();
 await page.waitForFunction(()=>window.houseLab.simulation.status==='arrived',{}, {timeout:15000});
 const cartDistance=await page.evaluate(()=>window.houseLab.simulation.distance);assert.ok(cartDistance>3);
 await page.screenshot({path:'.artifacts/combined-arrival.png'});
 await page.locator('#reset').click();await page.locator('[data-scenario="blocked"]').click();
 await page.locator('[data-destination="kitchen"]').click();
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.status),'blocked');
 await page.screenshot({path:'.artifacts/combined-blocked.png'});
 await page.locator('[data-scenario="clear"]').click();
 await page.waitForFunction(()=>window.houseLab.simulation.status==='walking');
 await page.locator('[data-view="follow"]').click();await page.waitForTimeout(800);
 await page.screenshot({path:'.artifacts/combined-follow.png'});
 await page.locator('#reset').click();await page.locator('[data-view="interior"]').click();await page.locator('#pause').click();
 await page.locator('#debug').check();await page.screenshot({path:'.artifacts/combined-geometry.png'});await page.locator('#debug').uncheck();
 const download=page.waitForEvent('download');await page.locator('#export').click();
 assert.equal((await download).suggestedFilename(),'house-lab-scenario.json');
 // Inspect the actual room's depth pass with a static resident beyond the cabinet wall.
 await page.evaluate(()=>{
  const {viewer:v,simulation:s}=window.houseLab;
  v.controls.enableDamping=false;v.camera.position.set(0,1.5,0);v.controls.target.set(0,1,-4);v.controls.update();
  s.position={x:0,z:-9};v.destinations.visible=false;v.resident.root.visible=false;
 });
 // Render the depth/character layer in isolation so background streaming cannot
 // change a pixel comparison unrelated to occlusion.
 const occlusion = await page.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const v = window.houseLab.viewer;
  const target = new THREE.WebGLRenderTarget(256, 256);
  const previousTarget = v.renderer.getRenderTarget();
  const previousColor = v.renderer.getClearColor(new THREE.Color()).clone();
  const previousAlpha = v.renderer.getClearAlpha();
  const previousAutoClear = v.renderer.autoClear;
  const previousResident = v.resident.root.visible;
  const previousDepth = v.world.depth.visible;
  function sample(resident, depth) {
   v.resident.root.visible = resident; v.world.depth.visible = depth;
   v.renderer.setRenderTarget(target); v.renderer.autoClear = true;
   v.renderer.setClearColor(0, 0); v.renderer.render(v.overlayScene, v.camera);
   const pixels = new Uint8Array(256 * 256 * 4);
   v.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
   return pixels;
  }
  try {
   const baseline = sample(false, true), hidden = sample(true, true), exposed = sample(true, false);
   return { hiddenMatches: baseline.every((value, i) => value === hidden[i]),
    exposedDiffers: baseline.some((value, i) => value !== exposed[i]) };
  } finally {
   v.resident.root.visible = previousResident; v.world.depth.visible = previousDepth;
   v.renderer.setRenderTarget(previousTarget);v.renderer.setClearColor(previousColor, previousAlpha);
   v.renderer.autoClear = previousAutoClear; target.dispose();
  }
 });
 assert.equal(occlusion.hiddenMatches, true, 'Actual room wall must occlude resident');
 assert.equal(occlusion.exposedDiffers, true, 'Resident must be visible without room depth');
 await page.evaluate(()=>{window.houseLab.viewer.worldDepth=true;window.houseLab.viewer.destinations.visible=true;});
 await page.locator('#reset').click();await page.locator('[data-view="interior"]').click();
 await page.locator('#environment').selectOption('fixture');assert.equal(await page.evaluate(()=>window.houseLab.viewer.mode),'fixture');
 await page.locator('#environment').selectOption('generated');await ready();
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.overlayScene.children.filter(o=>o.name==='resident-01').length),2); // resident + hidden inspection marker
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'.artifacts/combined-mobile.png',fullPage:true});
 await page.locator('#environment').selectOption('fixture');
 await page.route('**/environment/tantau-navigation.json',route=>route.fulfill({status:404,body:'missing'}));
 await page.locator('#environment').selectOption('generated');
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('navigation data is unavailable'));
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.mode),'fixture');
 assert.deepEqual(errors,[]);
 const result={passed:true,date:'2026-09-05',cartDistance,errors,checks:['default realistic world + automatic walking','destination arrival','cart detour','barrier and recovery','pause/reset','follow camera','geometry overlay','state export','actual-world occlusion','switching environments','mobile layout','missing navigation recovery']};
 await writeFile('.artifacts/combined-validation.json',JSON.stringify(result,null,2));console.log(result);
} finally {await browser.close();}
