import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Simulation } from '../src/simulation.ts';
import { tantauFixture, sampleWorld } from '../src/environment.ts';
import { validateHouse } from '../src/house-loader.ts';

function fixture() {
 const ground=structuredClone(tantauFixture);
 const upper={...structuredClone(tantauFixture),id:'upper',label:'Upstairs',floorY:3.4};
 const house={id:'house',floors:[{id:'ground',label:'Ground',environment:ground,world:sampleWorld},{id:'upper',label:'Upstairs',environment:upper,world:sampleWorld}],connections:[{id:'stairs',label:'Authored stairs',fromFloor:'ground',toFloor:'upper',width:1.1,points:[{x:3.2,z:2.5,y:0},{x:3.2,z:3.5,y:1.7},{x:4.5,z:3.5,y:1.7},{x:3.2,z:2.5,y:3.4}]}]};
 validateHouse(house);
 const sim=new Simulation(ground);sim.configureHouse(house,'ground');return {sim,house};
}
function until(sim,predicate){for(let i=0;i<20000&&!predicate();i++)sim.advance(1/60);assert.ok(predicate());}
test('continuous ascent and descent preserve identity, time and settings',()=>{
 const {sim}=fixture();sim.skin='slate';sim.hunch=.4;
 assert.equal(sim.requestFloor('upper','kitchen'),true);
 let previous=sim.elevation;
 until(sim,()=>{assert.ok(Math.abs(sim.elevation-previous)<.02);previous=sim.elevation;return sim.floorId==='upper'&&sim.status==='arrived';});
 assert.equal(sim.elevation,3.4);assert.equal(sim.destination,'kitchen');assert.equal(sim.skin,'slate');assert.equal(sim.hunch,.4);
 const time=sim.time;
 assert.equal(sim.requestFloor('ground','living'),true);
 until(sim,()=>sim.floorId==='ground'&&sim.status==='arrived');
 assert.equal(sim.elevation,0);assert.ok(sim.time>time);assert.equal(sim.characterId,'resident-01');
});
test('pause, controls and reset cannot corrupt a stair transfer',()=>{
 const {sim}=fixture();sim.requestFloor('upper');until(sim,()=>sim.elevation>1);
 sim.paused=true;const snapshot=sim.snapshot();sim.advance(2);sim.drive(1,1,2);sim.setManual();sim.requestDestination('kitchen');
 assert.equal(sim.playFall('trip'),false);assert.equal(sim.setScenario('blocked'),false);
 assert.deepEqual(sim.snapshot(),snapshot);
 sim.reset();assert.equal(sim.floorJourney,null);assert.equal(sim.floorId,'ground');assert.equal(sim.elevation,0);assert.deepEqual(sim.position,sim.environment.spawn);
 sim.requestFloor('upper');until(sim,()=>sim.floorId==='upper');sim.reset();assert.equal(sim.elevation,3.4);assert.equal(sim.floorId,'upper');
});
test('blocked stair approach and invalid floor leave character in place',()=>{
 const {sim,house}=fixture();house.connections[0].points[0]={x:3.2,z:7.4,y:0};
 sim.setScenario('blocked');const initial={...sim.position};assert.equal(sim.requestFloor('upper'),false);assert.equal(sim.requestFloor('absent'),false);
 assert.deepEqual(sim.position,initial);assert.equal(sim.floorJourney,null);assert.equal(sim.events[0].type,'routeBlocked');
});
test('unwalkable or wrong-height endpoints reject the house',()=>{
 const {house}=fixture();house.connections[0].points[0].y=2;assert.throws(()=>validateHouse(house),/height/);
 house.connections[0].points[0]={x:100,z:100,y:0};assert.throws(()=>validateHouse(house),/not supported/);
});

test('shipped room manifests support the full return journey and every destination',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {validateSimulationEnvironment}=await import('../src/simulation-environment.ts');
 const {planRoute}=await import('../src/navigation.ts');
 const {isWalkable}=await import('../src/environment.ts');
 const read=async path=>JSON.parse(await readFile(`public${path}`,'utf8'));
 const house=await read('/environment/house/house.json');
 for(const floor of house.floors){
  floor.world=await read(floor.worldUrl);floor.environment=await read(floor.environmentUrl);
  floor.environment.navigation=await read(floor.environment.navigationUrl);
  validateSimulationEnvironment(floor.environment);
  for(const a of floor.environment.destinations)for(const b of floor.environment.destinations)
   assert.ok(planRoute(floor.environment,a,b,[],.28),`${floor.id}: ${a.id} to ${b.id}`);
 }
 validateHouse(house);
 const sim=new Simulation(house.floors[0].environment);sim.configureHouse(house,'ground');
 for(const [floor,destination] of [['upper','primary'],['ground','living']]){
  assert.ok(sim.requestFloor(floor,destination));let previous=sim.elevation;
  until(sim,()=>{
   assert.ok(Math.abs(sim.elevation-previous)<.05,'Elevation remains continuous across sampled floors and stairs');previous=sim.elevation;
   if(sim.floorJourney?.phase!=='stairs')assert.ok(isWalkable(sim.environment,sim.position,sim.obstacles,.28));
   return sim.floorId===floor&&sim.status==='arrived';
  });
 }
 sim.setScenario('blocked');assert.equal(sim.requestFloor('upper'),true,'Island barrier does not block the foyer stair');sim.reset();
 sim.setScenario('clear');assert.ok(sim.requestFloor('upper'));until(sim,()=>sim.floorId==='upper');
 sim.setScenario('cart');assert.ok(sim.requestFloor('ground'));until(sim,()=>sim.floorId==='ground');
 assert.equal(sim.scenario,'clear');assert.ok(sim.requestFloor('upper'));until(sim,()=>sim.floorId==='upper');assert.equal(sim.scenario,'cart');
});

test('rotated openings include their own frame and preserve neighboring geometry',async()=>{
 const THREE=await import('three');const {cutoutContains}=await import('../src/world-cutout.ts');
 const cut={min:[-2,0,-.5],max:[2,3,.5],yaw:Math.PI/4};
 const inside=new THREE.Vector3(1.8,1,0).applyAxisAngle(new THREE.Vector3(0,1,0),cut.yaw);
 assert.ok(cutoutContains(cut,inside));
 assert.equal(cutoutContains(cut,new THREE.Vector3(1.8,1,.4)),false,'A neighboring surface in the unrotated bounds is preserved');
 assert.equal(cutoutContains(cut,new THREE.Vector3(0,4,0)),false);
});

test('house reserves the stair flight and provides ordinary navigable hall space',async()=>{
 const {readFile}=await import('node:fs/promises');const {isWalkable}=await import('../src/environment.ts');
 const read=async path=>JSON.parse(await readFile(`public${path}`,'utf8'));
 const house=await read('/environment/house/house.json'),layout=house.connections[0].stairwell;
 const point=(u,v)=>({x:layout.origin.x+Math.cos(layout.yaw)*u+Math.sin(layout.yaw)*v,z:layout.origin.z-Math.sin(layout.yaw)*u+Math.cos(layout.yaw)*v});
 for(const floor of house.floors){floor.environment=await read(floor.environmentUrl);floor.environment.navigation=await read(floor.environment.navigationUrl);}
 assert.equal(isWalkable(house.floors[0].environment,point(1.4,0),[],.28),false);
 assert.ok(isWalkable(house.floors[1].environment,point(0,3.4),[],.28));
 assert.ok(isWalkable(house.floors[1].environment,point(.1,3.4),[],.28),'Hall permits movement away from its centerline');
});
