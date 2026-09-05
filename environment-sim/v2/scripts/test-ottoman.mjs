import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(25000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/');
 await page.waitForFunction(()=>window.houseLab?.viewer.animatedResident?.robot,undefined,{timeout:90000});
 assert.equal(await page.locator('aside').count(),0);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.roomObjects.children.length),1);
 assert.equal(await page.evaluate(()=>window.houseLab.viewer.floorRepairs.children.length),1);
 assert.equal(await page.evaluate(()=>!!window.houseLab.viewer.world.cutaway.getObjectByName('Replaced furniture')),true);
 for (const view of ['follow','first']) {
  await page.keyboard.press('KeyR');
  await page.evaluate(()=>{window.houseLab.simulation.heading=Math.PI;});
  await page.waitForTimeout(100);
  await page.locator(`[data-view="${view}"]`).click();
  await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const solid=new THREE.Box3(new THREE.Vector3(.29,.04,-3.22),new THREE.Vector3(.99,.54,-2.46));
   window.ottomanCheck={maxOverlap:0,frames:0,active:true};
   const check=()=>{
    const state=window.ottomanCheck;if(!state.active)return;
    const v=window.houseLab.viewer;
    v.animatedResident.robot.root.traverse(mesh=>{
     if(!mesh.isMesh)return;
     const box=new THREE.Box3().setFromObject(mesh);
     if(box.intersectsBox(solid)) {const size=box.intersect(solid).getSize(new THREE.Vector3());state.maxOverlap=Math.max(state.maxOverlap,size.x*size.y*size.z);}
    });state.frames++;requestAnimationFrame(check);
   };requestAnimationFrame(check);
  });
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.houseLab.simulation.fall?.autoRecover);
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.houseLab.simulation.status==='fallen');
  await page.screenshot({path:`.artifacts/ottoman-${view}-fallen.png`});
  await page.waitForFunction(()=>window.houseLab.simulation.fall===null);
  const result=await page.evaluate(()=>{window.ottomanCheck.active=false;return {check:window.ottomanCheck,state:window.houseLab.simulation.snapshot(),view:window.houseLab.viewer.view};});
  assert.ok(result.check.frames>60);
  assert.equal(result.check.maxOverlap,0,'No posed body link enters the solid ottoman');
  assert.equal(result.state.manual,true);
  assert.equal(result.view,view);
  assert.equal(result.state.events.filter(e=>e.type==='fallStarted').length,1);
  const before=result.state.position;
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(350);await page.keyboard.up('ArrowDown');
  assert.notDeepEqual(await page.evaluate(()=>window.houseLab.simulation.position),before);
 }
 // Disabling the authored animation must not disable the solid object.
 const solidCheck=await page.evaluate(async()=>{
  const {isWalkable}=await import('/src/environment.ts');const s=window.houseLab.simulation;
  s.reset();s.setManual();s.heading=Math.PI;s.autoHazardFalls=false;s.drive(1,0,30);
  return {clear:isWalkable(s.environment,s.position,s.obstacles,s.profile.radius),z:s.position.z,speed:s.currentSpeed,fall:s.fall};
 });
 assert.equal(solidCheck.clear,true);assert.equal(solidCheck.fall,null);assert.equal(solidCheck.speed,0);
 assert.ok(solidCheck.z>-2.17);
 for(const view of ['overview','map','follow']) {
  await page.locator(`[data-view="${view}"]`).click();
  assert.equal(await page.evaluate(()=>window.houseLab.viewer.roomObjects.parent===
   (window.houseLab.viewer.view==='map'?window.houseLab.viewer.topScene:window.houseLab.viewer.overlayScene)),true);
 }
 // Sample the repaired floor in a repeatable close view; the old gaps were dark green.
 const colors=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {viewer:v,simulation:s}=window.houseLab;
  v.setView('interior');v.camera.position.set(.7,1.25,0);v.controls.target.set(.64,.25,-2.84);v.controls.update();v.update(s);
  const gl=v.renderer.getContext(),size=v.renderer.getDrawingBufferSize(new THREE.Vector2());
  return [[.9,.023,-2.02],[1.1,.023,-2.15],[.15,.023,-3.2]].map(point=>{
   const projected=new THREE.Vector3(...point).project(v.camera),pixel=new Uint8Array(4);
   gl.readPixels(Math.round((projected.x+1)/2*size.x),Math.round((projected.y+1)/2*size.y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   return [...pixel];
  });
 });
 for(const color of colors) assert.ok(color.slice(0,3).every(c=>c>80),`Floor gap: ${color}`);
 await page.screenshot({path:'.artifacts/ottoman-repaired-floor.png'});
 assert.deepEqual(errors,[]);
 console.log('Ottoman passed: one replacement, repaired floor, solid walking collision, manual contact/fall/recovery in first and third person, body-link clearance and all views.');
} finally {await browser.close();}
