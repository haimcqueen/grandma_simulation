import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});
try {
 await mkdir('.artifacts',{recursive:true});await page.goto(process.env.BASE_URL||'http://127.0.0.1:5174/');
 await page.waitForFunction(()=>window.houseLab?.viewer.mode==='world-simulation',{}, {timeout:60000});
 await page.locator('#reset').click();await page.locator('#pause').click();
 const initial=await page.evaluate(()=>window.houseLab.simulation.snapshot());
 for(const mode of ['top','overview','side']){
  await page.locator(`[data-view="${mode}"]`).click();await page.waitForTimeout(1600);
  assert.equal(await page.evaluate(()=>window.houseLab.viewer.world.cutawayState.ceilingHeight),1.8);
  assert.equal(await page.evaluate(()=>window.houseLab.viewer.resident.root.parent===window.houseLab.viewer.overlayScene),true);
  assert.equal(await page.evaluate(()=>window.houseLab.viewer.navigationMap.visible),false);
  await page.screenshot({path:`.artifacts/cutaway-${mode}.png`});
 }
 const cutBeforeZoom=await page.evaluate(()=>window.houseLab.viewer.world.cutawayState);
 assert.equal(cutBeforeZoom.frontEnabled,true,'Side view reveals the wall obstructing the resident');
 const beforeZoom=await page.evaluate(()=>window.houseLab.viewer.camera.position.toArray());
 await page.locator('canvas').hover();await page.mouse.wheel(0,-400);await page.waitForTimeout(700);
 assert.notDeepEqual(await page.evaluate(()=>window.houseLab.viewer.camera.position.toArray()),beforeZoom);
 assert.notDeepEqual(await page.evaluate(()=>window.houseLab.viewer.world.cutawayState),cutBeforeZoom,'Zoom recomputes the sightline cut');
 const poseBeforeOrbit=await page.evaluate(()=>window.houseLab.viewer.camera.position.toArray());
 const rect=await page.locator('canvas').boundingBox();
 await page.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.6);await page.mouse.down();
 await page.mouse.move(rect.x+rect.width*.65+160,rect.y+rect.height*.6,{steps:10});await page.mouse.up();await page.waitForTimeout(700);
 assert.notDeepEqual(await page.evaluate(()=>window.houseLab.viewer.camera.position.toArray()),poseBeforeOrbit);
 await page.screenshot({path:'.artifacts/cutaway-orbit-zoom.png'});
 await page.locator('#cutaway-height').fill('1.2');
 await page.waitForFunction(()=>window.houseLab.viewer.world.cutawayState.ceilingHeight===1.2);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.world.depth.children[0].material.clippingPlanes[0].constant),1.2);
 await page.locator('#cutaway-enabled').uncheck();
 await page.waitForFunction(()=>window.houseLab.viewer.world.cutawayState.ceilingHeight===null);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.world.cutawayState.frontEnabled),false);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.world.depth.children[0].material.clippingPlanes),null);
 await page.locator('#cutaway-enabled').check();await page.locator('[data-view="interior"]').click();
 await page.waitForFunction(()=>window.houseLab.viewer.world.cutawayState.ceilingHeight===null);
 assert.deepEqual(await page.evaluate(()=>window.houseLab.simulation.snapshot()),initial);
 await page.screenshot({path:'.artifacts/cutaway-restored.png'});
 await page.locator('[data-view="top"]').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'.artifacts/cutaway-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const result={passed:true,checks:['real assets in top/overview/side','camera orbit and zoom','ceiling clipping matches occluder','cutaway toggle','full-room restoration','simulation state unchanged','mobile layout'],errors};
 await writeFile('.artifacts/cutaway-validation.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();}
