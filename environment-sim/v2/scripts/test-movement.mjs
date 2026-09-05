import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MovementProgram,parseMovementSteps} from '../src/movement/program.ts';
import {Simulation} from '../src/simulation.ts';
import {isWalkable,tantauFixture} from '../src/environment.ts';
const read=async path=>JSON.parse(await readFile(`public${path}`,'utf8'));
async function houseFixture(){
 const house=await read('/environment/house/house.json');
 for(const floor of house.floors){floor.environment=await read(floor.environmentUrl);floor.environment.navigation=await read(floor.environment.navigationUrl);floor.world=await read(floor.worldUrl);}
 const sim=new Simulation(house.floors[0].environment);sim.configureHouse(house,'ground');return sim;
}
function until(sim,program,predicate){for(let i=0;i<25000&&!predicate();i++){sim.advance(1/60);program?.advance();}assert.ok(predicate());}
test('arbitrary points replan around blockers and reject invalid input without teleporting',()=>{
 const sim=new Simulation(tantauFixture);assert.ok(sim.requestPoint({x:3.2,z:7.2}));
 sim.setScenario('blocked');assert.equal(sim.status,'blocked');sim.setScenario('clear');assert.equal(sim.status,'walking');
 until(sim,null,()=>sim.status==='arrived');assert.equal(sim.destination,null);assert.deepEqual(sim.position,{x:3.2,z:7.2});
 const position={...sim.position};assert.equal(sim.requestPoint({x:NaN,z:0}),false);assert.equal(sim.requestPoint({x:100,z:100}),false);assert.deepEqual(sim.position,position);
});
test('program runs points, waits and both floors using one clock',async()=>{
 const sim=await houseFixture(),program=new MovementProgram(sim);
 program.run([{type:'walk',point:{x:1.275,z:2.225}},{type:'wait',seconds:2},{type:'destination',floor:'upper',id:'primary'},{type:'wait',seconds:1},{type:'destination',floor:'ground',id:'living'}]);
 until(sim,program,()=>program.index===1);sim.paused=true;const snapshot=sim.snapshot();for(let i=0;i<100;i++){sim.advance(.1);program.advance();}assert.deepEqual(sim.snapshot(),snapshot);
 sim.paused=false;until(sim,program,()=>program.status==='completed');assert.equal(sim.floorId,'ground');assert.equal(sim.destination,'living');
});
test('blocked programs retry; manual takeover cancels without moving the actor',()=>{
 const sim=new Simulation(tantauFixture),program=new MovementProgram(sim);sim.setScenario('blocked');
 program.run([{type:'destination',id:'kitchen'}]);program.advance();assert.equal(program.status,'blocked');
 sim.setScenario('clear');program.retry();until(sim,program,()=>program.status==='completed');
 program.run([{type:'destination',id:'living'}]);sim.setManual();const position={...sim.position};program.advance();assert.equal(program.status,'cancelled');assert.deepEqual(sim.position,position);
});
test('manual stair takeover stops, reverses to source, then climbs and descends',async()=>{
 const sim=await houseFixture();sim.requestFloor('upper');until(sim,null,()=>sim.elevation>1);
 sim.setManual();sim.drive(0,0,1/60);const height=sim.elevation;for(let i=0;i<60;i++)sim.advance(1/60);assert.equal(sim.elevation,height);
 sim.drive(-1,0,1/60);until(sim,null,()=>!sim.floorJourney);assert.equal(sim.floorId,'ground');assert.ok(Math.abs(sim.elevation)<.16);
 sim.heading=Math.PI;sim.drive(1,0,1/60);assert.ok(sim.floorJourney,'Keyboard approach enters stairs without a floor button');
 for(let i=0;i<15000&&sim.floorId!=='upper';i++){sim.drive(1,0,1/60);sim.advance(1/60);}assert.equal(sim.floorId,'upper');assert.equal(sim.manual,true);
 sim.heading=Math.PI;sim.drive(1,0,1/60);assert.ok(sim.floorJourney);for(let i=0;i<15000&&sim.floorId!=='ground';i++){sim.drive(1,0,1/60);sim.advance(1/60);}assert.equal(sim.floorId,'ground');
});
test('direct walking slides along a boundary without leaving valid space',()=>{
 const environment={...structuredClone(tantauFixture),objects:[],spawn:{x:.3,z:2}};
 const sim=new Simulation(environment);sim.heading=-Math.PI/4;sim.setManual();
 for(let i=0;i<120;i++){sim.drive(1,0,1/60);sim.advance(1/60);assert.ok(isWalkable(environment,sim.position,[],.28));}
 assert.ok(sim.position.z>2.5);assert.ok(sim.position.x>=.28);
});
test('program validation rejects malformed input and bounded zero-wait loops yield',()=>{
 for(const value of [[],[{type:'walk',point:{x:0,z:Infinity}}],[{type:'wait',seconds:-1}],[{type:'eval',code:'alert(1)'}]])assert.throws(()=>parseMovementSteps(value));
 const sim=new Simulation(tantauFixture),program=new MovementProgram(sim);program.run([{type:'wait',seconds:0}],{loop:true});for(let i=0;i<100;i++){sim.advance(1/60);program.advance();}assert.equal(program.status,'running');
 program.cancel();assert.equal(program.status,'cancelled');
});
