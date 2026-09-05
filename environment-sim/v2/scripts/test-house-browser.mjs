import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('.artifacts/upstairs',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});
 await page.goto('http://127.0.0.1:5174/?house=1');
 await page.waitForFunction(()=>window.houseLab?.simulation.house && window.houseLab.viewer.animatedResident,{},{timeout:120000});
 await page.locator('[data-view="side"]').click();
 await page.locator('#floor-view').selectOption('all');
 await page.waitForTimeout(2500);
 await page.screenshot({path:'.artifacts/upstairs/connected-side.png'});
 const cuts=await page.evaluate(()=>[...window.houseLab.viewer.houseWorlds.values()].map(entry=>entry.world.cutawayState.ceilingHeight));
 assert.deepEqual(cuts,[1.8,5.2]);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.worldScene.children.filter(o=>o.isSplatEdit).length),0);
 await page.locator('#go-upper').click();
 // Advance the same simulation with fixed steps, avoiding a slow real-time test.
 const middle=await page.evaluate(()=>{
  const {simulation:s,viewer:v}=window.houseLab;
  for(let i=0;i<10000 && s.elevation<1.7;i++)s.advance(1/60);
  s.paused=true;v.setView('side');v.update(s);
  return {height:s.elevation,phase:s.floorJourney?.phase};
 });
 assert.equal(middle.phase,'stairs');assert.ok(middle.height>=1.7);
 await page.waitForTimeout(500);await page.screenshot({path:'.artifacts/upstairs/stair-ascent.png'});
 const arrival=await page.evaluate(()=>{
  const {simulation:s,viewer:v}=window.houseLab;s.paused=false;
  for(let i=0;i<15000 && !(s.floorId==='upper'&&s.status==='arrived');i++)s.advance(1/60);
  s.paused=true;v.update(s);v.setFloorView('auto');v.setView('top');v.update(s);
  return {floor:s.floorId,status:s.status,elevation:s.elevation,destination:s.destination,events:s.events};
 });
 assert.equal(arrival.floor,'upper');assert.equal(arrival.status,'arrived');assert.equal(arrival.destination,'primary');assert.ok(Math.abs(arrival.elevation-3.4)<.16);
 assert.ok(arrival.events.some(e=>e.type==='stairsStarted'));assert.ok(arrival.events.some(e=>e.type==='floorReached'));
 await page.waitForTimeout(1200);await page.screenshot({path:'.artifacts/upstairs/upper-top.png'});
 await page.locator('[data-view="interior"]').click();await page.waitForTimeout(1200);await page.screenshot({path:'.artifacts/upstairs/upper-inside.png'});
 for(const view of ['first','follow','side','map']) {await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(250);}
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.view),'map');
 await page.locator('#floor-view').selectOption('ground');
 await page.waitForFunction(()=>!window.houseLab.viewer.resident.root.visible);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('.artifacts/upstairs/scenario-export.json');
 await page.locator('#go-ground').click();
 const returned=await page.evaluate(()=>{
  const {simulation:s,viewer:v}=window.houseLab;s.paused=false;
  for(let i=0;i<15000 && !(s.floorId==='ground'&&s.status==='arrived');i++)s.advance(1/60);
  s.paused=true;v.update(s);return {floor:s.floorId,status:s.status,elevation:s.elevation};
 });
 assert.equal(returned.floor,'ground');assert.equal(returned.status,'arrived');assert.ok(Math.abs(returned.elevation)<.16);
 await page.locator('#reset').click();await page.locator('[data-scenario="blocked"]').click();
 const blocked=await page.evaluate(()=>{const s=window.houseLab.simulation;const result=s.requestFloor('upper');return {result,events:s.events};});
 assert.equal(blocked.result,false);assert.equal(blocked.events[0].type,'routeBlocked');
 await page.locator('[data-scenario="clear"]').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'.artifacts/upstairs/mobile.png'});
 await page.locator('#environment').selectOption('fixture');await page.waitForFunction(()=>window.houseLab.viewer.mode==='fixture');
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.house===undefined),true);
 assert.deepEqual(errors,[]);console.log('PASS real two-floor house: ascent, descent, camera views, floor isolation, obstruction, export, mobile, fixture switch');
} finally {await browser.close();}
