import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/?house=1');await page.waitForFunction(()=>document.querySelector('#app').dataset.ready==='true',{},{timeout:120000});
 assert.equal(await page.locator('aside').count(),0);assert.equal(await page.evaluate(()=>window.houseLab.simulation.manual),true);
 await page.locator('#walk-floor').click();
 await page.evaluate(()=>{const {simulation:s,movement:m}=window.houseLab;for(let i=0;i<12000&&m.status==='running';i++){s.advance(1/60);m.advance();}});
 await page.waitForFunction(()=>window.houseLab.viewer.environment.id===window.houseLab.simulation.environment.id);
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.floorId),'upper');
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.destinations.children.length),0);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.hazards.root.children.length),0);
 await page.locator('[data-view="top"]').click();await page.waitForTimeout(900);await page.screenshot({path:'.artifacts/upstairs/walkthrough-upper.png'});
 await page.locator('#walk-floor').click();
 await page.evaluate(()=>{const {simulation:s,movement:m}=window.houseLab;for(let i=0;i<12000&&m.status==='running';i++){s.advance(1/60);m.advance();}});
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.floorId),'ground');
 await page.keyboard.press('r');await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.manual),true);assert.ok(await page.evaluate(()=>window.houseLab.simulation.distance)>.01);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS simple connected-house walkthrough, both floors, annotation isolation, cameras, WASD, mobile');
}finally{await browser.close();}
