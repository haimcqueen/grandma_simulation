import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/probe.html');
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {loadGrandmaResident}=await import('/src/characters/grandma.ts');
  const actor=await loadGrandmaResident();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e7e5dd');
  scene.add(new THREE.HemisphereLight(0xffffff,0x5b645c,2.4));
  const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,4,3);scene.add(light);
  scene.add(actor.root); actor.root.position.x=-.65;
  scene.add(actor.driver.root); actor.driver.root.position.x=.65;
  const camera=new THREE.PerspectiveCamera(40,1200/850,.01,30);camera.position.set(2,1.3,3.8);camera.lookAt(0,.6,0);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,850);
  document.body.replaceChildren(renderer.domElement);
  const bounds=()=>{actor.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(actor.root,true);return {height:b.max.y-b.min.y,min:b.min.y};};
  actor.setMotion('grandma',0,1);actor.update(0,0,false,false);
  const initial=bounds();const robot=new THREE.Box3().setFromObject(actor.driver.root).getSize(new THREE.Vector3()).y;
  const left=actor.root.getObjectByName('LeftLeg');
  const first=left.quaternion.clone();
  let moving=0; for(let i=1;i<=40;i++){actor.setMotion('grandma',i/40,1);actor.update(i/60,i*.01,true,false);moving=Math.max(moving,first.angleTo(left.quaternion));}
  const frozen=left.quaternion.clone();actor.update(.7,.4,true,true);
  const paused=frozen.angleTo(left.quaternion);
  actor.root.position.y=3.4;actor.update(.6,.2,false,false);const upper=bounds();actor.root.position.y=0;
  actor.root.rotation.y=1.1;actor.update(.7,.2,false,false);const turned=bounds();actor.root.rotation.y=0;
  const samples=[];
  for(const kind of ['trip','patio','sideways']){
   for(const elapsed of [0,.5,1,2.2,3.5,5,7]){
    actor.setFall({kind,elapsed,autoRecover:true});actor.update(1+elapsed,.2,false,false);
    samples.push({kind,elapsed,...bounds()});
   }
  }
  actor.setFall(null);actor.update(9,.2,false,false);
  renderer.render(scene,camera);
  window.motionReview={actor,scene,camera,renderer};
  return {initial,robot,moving,paused,upper,turned,samples};
 });
 assert.ok(Math.abs(report.initial.height-report.robot)<.03,JSON.stringify(report));
 assert.ok(report.moving>.01);assert.ok(report.paused<1e-6);
 assert.ok(Math.abs(report.upper.min-3.4)<.01);assert.ok(Math.abs(report.turned.min)<.01);
 assert.ok(report.samples.every(s=>Number.isFinite(s.height)&&s.height>.1&&Math.abs(s.min)<.01));
 await page.screenshot({path:'.artifacts/grandma-unitree-motion.png'});
 await page.evaluate(()=>{const {actor,scene,camera,renderer}=window.motionReview;actor.setFall({kind:'sideways',elapsed:2.2,autoRecover:true});actor.update(12,.2,false,false);renderer.render(scene,camera);});
 await page.screenshot({path:'.artifacts/grandma-unitree-fall.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({height:report.initial.height,robotHeight:report.robot,moving:report.moving,paused:report.paused,fallSamples:report.samples.length}));
 console.log('PASS shared motion, posed height, animated knee, pause, elevated/rotated root, fall/recovery grounding');
}finally{await browser.close();}
