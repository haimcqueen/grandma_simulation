import {chromium}from'@playwright/test';import{writeFile}from'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.goto('http://localhost:5174/');await page.waitForFunction(()=>window.environmentLab?.metrics.ready||window.environmentLab?.metrics.error,{}, {timeout:90000});
await page.waitForTimeout(4000);await page.screenshot({path:'.artifacts/tantau-initial.png'});
console.log(await page.evaluate(()=>({metrics:window.environmentLab.metrics,world:!!window.environmentLab.world})),errors);
if(await page.evaluate(()=>!!window.environmentLab.world)){
 const report=await page.evaluate(async()=>{const THREE=await import('/node_modules/three/build/three.module.js');const lab=window.environmentLab;const bounds=new THREE.Box3().setFromObject(lab.world.collider);return{bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},camera:lab.camera.position.toArray(),target:lab.controls.target.toArray()};});
 console.log(report);await writeFile('.artifacts/tantau-inspection.json',JSON.stringify({report,errors},null,2));
 for(const [name,target]of [['front',[0,0,-1]],['right',[1,0,0]],['back',[0,0,1]],['left',[-1,0,0]]]){await page.evaluate(target=>{const lab=window.environmentLab;lab.camera.position.fromArray(lab.asset.camera.position);lab.controls.target.copy(lab.camera.position).add(new lab.camera.position.constructor(...target));lab.controls.update();},target);await page.waitForTimeout(1200);await page.screenshot({path:`.artifacts/tantau-${name}.png`});}
}
await browser.close();
