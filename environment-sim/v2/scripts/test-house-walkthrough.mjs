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
 const hallPoint=await page.evaluate(()=>{
  const {simulation:s,viewer:v}=window.houseLab,l=s.house.connections[0].stairwell;
  const point={x:l.origin.x+Math.sin(l.yaw)*3.4,z:l.origin.z+Math.cos(l.yaw)*3.4};
  const p=new v.camera.position.constructor(point.x,3.4,point.z).project(v.activeCamera),r=v.renderer.domElement.getBoundingClientRect();
  return {point,x:r.x+(p.x+1)/2*r.width,y:r.y+(1-p.y)/2*r.height};
 });
 await page.mouse.click(hallPoint.x,hallPoint.y);
 await page.waitForFunction(()=>window.houseLab.movement.status==='running');
 await page.evaluate(()=>{const {simulation:s,movement:m}=window.houseLab;for(let i=0;i<5000&&m.status==='running';i++){s.advance(1/60);m.advance();}});
 assert.equal(await page.evaluate(()=>window.houseLab.movement.status),'completed');
 const freeHall=await page.evaluate(()=>{
  const s=window.houseLab.simulation,before={...s.position};s.setManual();s.heading=s.house.connections[0].stairwell.yaw+Math.PI/2;
  for(let i=0;i<20;i++){s.drive(1,0,1/60);s.advance(1/60);}s.stopManualMotion();
  return {distance:Math.hypot(s.position.x-before.x,s.position.z-before.z),journey:s.floorJourney};
 });
 assert.ok(freeHall.distance>.02,'Hall permits free lateral walking');assert.equal(freeHall.journey,null);
 await page.locator('#walk-floor').click();
 await page.evaluate(()=>{const {simulation:s,movement:m}=window.houseLab;for(let i=0;i<12000&&m.status==='running';i++){s.advance(1/60);m.advance();}});
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.floorId),'ground');
 await page.keyboard.press('r');await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
 assert.equal(await page.evaluate(()=>window.houseLab.simulation.manual),true);assert.ok(await page.evaluate(()=>window.houseLab.simulation.distance)>.01);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS simple connected-house walkthrough, both floors, annotation isolation, cameras, WASD, mobile');
}finally{await browser.close();}
