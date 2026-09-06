import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/');
 await page.waitForFunction(()=>window.houseLab?.simulation,undefined,{timeout:90000});
 for(const view of ['follow','first']) {
  await page.evaluate(()=>{const s=window.houseLab.simulation;s.reset();s.setManual();s.position={x:.525,z:-.18};s.heading=Math.PI/2;});
  await page.locator(`[data-view="${view}"]`).click();
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.houseLab.simulation.fall?.chair);
  await page.keyboard.up('ArrowUp');
  assert.ok(await page.evaluate(()=>window.houseLab.simulation.position.x)>=1.22,'Trip starts close to the chair leg');
  await page.waitForFunction(()=>document.querySelector('.fall-danger [data-phase]').textContent==='Reaching for the chair');
  assert.equal(await page.locator('.fall-danger [data-title]').innerText(),'Dining chair · Trip and fall');
  assert.equal(await page.locator('[data-rating="likelihood"] strong').innerText(),'High');
  assert.equal(await page.locator('[data-rating="intensity"] strong').innerText(),'High');
  const panel=await page.locator('.fall-danger').boundingBox();assert.ok(panel.x<50 && panel.y>600,'Card appears in the lower left');
  await page.screenshot({path:`.artifacts/chair-${view}-reach.png`});
  await page.waitForFunction(()=>document.querySelector('.fall-danger [data-phase]').textContent==='Trying to regain balance');
  await page.screenshot({path:`.artifacts/chair-${view}-catch.png`});
  await page.waitForFunction(()=>window.houseLab.simulation.status==='fallen');
  const landed=await page.evaluate(async()=>{const {isWalkable}=await import('/src/environment.ts');const s=window.houseLab.simulation;return {clear:isWalkable(s.environment,s.position,s.obstacles,s.profile.radius),x:s.position.x,kind:s.fall.kind,elapsed:s.fall.elapsed};});
  assert.equal(landed.clear,true);assert.equal(landed.kind,'sideways');assert.ok(landed.x<.65 && landed.elapsed>=3.6);
  await page.screenshot({path:`.artifacts/chair-${view}-fallen.png`});
  await page.waitForFunction(()=>window.houseLab.simulation.fall===null);
  await page.waitForFunction(()=>document.querySelector('.fall-danger').hidden);
  assert.equal(await page.evaluate(()=>window.houseLab.simulation.manual),true);
  assert.equal(await page.evaluate(()=>window.houseLab.viewer.view),view);
  const count=await page.evaluate(()=>window.houseLab.simulation.events.filter(event=>event.type==='fallStarted').length);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.houseLab.simulation.events.filter(event=>event.type==='fallStarted').length),count);
 }
 // Stationary or departing grandma should not trigger a new chair encounter.
 await page.evaluate(()=>{const s=window.houseLab.simulation;s.reset();s.setManual();s.position={x:1.08,z:-.18};s.heading=-Math.PI/2;s.drive(1,0,.3);});
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.fall),null);
 assert.deepEqual(errors,[]);
 console.log('Chair passed: approach contact, reach and failed catch, grounded side landing, chair risk card, recovery and manual control in first/third person.');
}finally{await browser.close();}
