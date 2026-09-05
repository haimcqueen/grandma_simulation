import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5174/?house=1');
 await page.waitForFunction(()=>window.houseLab?.simulation.house&&window.houseLab.viewer.animatedResident,{},{timeout:120000});
 await page.locator('[data-view="map"]').click();
 const clickPoint=async(point,shift=false)=>{
  const screen=await page.evaluate(point=>{const v=window.houseLab.viewer;v.update(window.houseLab.simulation);const p=new v.camera.position.constructor(point.x,.05,point.z).project(v.activeCamera);const r=v.renderer.domElement.getBoundingClientRect();return{x:r.x+(p.x+1)/2*r.width,y:r.y+(1-p.y)/2*r.height};},point);
  if(shift)await page.keyboard.down('Shift');await page.mouse.click(screen.x,screen.y);if(shift)await page.keyboard.up('Shift');
 };
 await clickPoint({x:1.275,z:2.225});
 await page.waitForFunction(()=>window.houseLab.movement.status==='running');
 await page.evaluate(()=>{const {simulation:s,movement:m}=window.houseLab;for(let i=0;i<1000&&m.status==='running';i++){s.advance(1/60);m.advance();}});
 assert.equal(await page.evaluate(()=>window.houseLab.movement.status),'completed');
 await page.locator('#path-json').fill('[]');await clickPoint({x:.525,z:.425},true);await clickPoint({x:1.725,z:-2.275},true);
 assert.equal(JSON.parse(await page.locator('#path-json').inputValue()).length,2);
 await page.locator('#path-wait').click();assert.equal(JSON.parse(await page.locator('#path-json').inputValue())[2].type,'wait');
 await page.locator('#path-run').click();await page.waitForFunction(()=>window.houseLab.movement.status==='running');
 await page.locator('#path-stop').click();const stopped=await page.evaluate(()=>window.houseLab.simulation.position);await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>window.houseLab.simulation.position),stopped);
 await page.locator('#reset').click();await page.locator('#go-upper').click();
 await page.evaluate(()=>{const s=window.houseLab.simulation;for(let i=0;i<10000&&s.elevation<1;i++)s.advance(1/60);});
 await page.keyboard.down('w');await page.waitForTimeout(200);await page.keyboard.up('w');await page.waitForTimeout(200);
 const height=await page.evaluate(()=>window.houseLab.simulation.elevation);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.houseLab.simulation.elevation),height);
 await page.keyboard.down('s');await page.waitForTimeout(500);await page.keyboard.up('s');assert.ok(await page.evaluate(()=>window.houseLab.simulation.elevation)<height);
 await page.locator('#path-stop').click();await page.locator('[data-view="side"]').click();await page.screenshot({path:'.artifacts/upstairs/movement-studio.png'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('PASS click-to-walk, editable waypoints, wait, stop, WASD stair takeover/reverse, mobile');
}finally{await browser.close();}
