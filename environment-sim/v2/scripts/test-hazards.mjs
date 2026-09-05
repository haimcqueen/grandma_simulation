import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { HazardTracker, hazardAt } from '../src/hazards.ts';
import { Simulation } from '../src/simulation.ts';
import { tantauFixture, isWalkable } from '../src/environment.ts';
import { validateSimulationEnvironment } from '../src/simulation-environment.ts';

const room = JSON.parse(readFileSync(new URL('../public/environment/tantau-simulation.json', import.meta.url)));
room.navigation = JSON.parse(readFileSync(new URL('../public/environment/tantau-navigation.json', import.meta.url)));
const zone = { hazardId: 'small_objects_reachable', x: 0, z: 0, radius: 1, room: 'Test room' };

test('shared catalogue filters conditions, prioritizes severity and breaks ties by distance', () => {
  const zones = [zone, { ...zone, hazardId: 'loose_rug', x: 0.5 }];
  assert.equal(hazardAt({ x: 0, z: 0 }, null, zones), null);
  assert.equal(hazardAt({ x: 0, z: 0 }, 'elderly', zones).zone.hazardId, 'loose_rug');
  assert.equal(hazardAt({ x: 0, z: 0 }, 'toddler', zones).zone.hazardId, 'small_objects_reachable');
  assert.equal(hazardAt({ x: 0, z: 0 }, 'elderly', [{ ...zone, hazardId: 'missing_baby_gate' }]), null);
});

test('tracker dismisses until re-entry and refreshes ratings when the profile changes in place', () => {
  const tracker = new HazardTracker({ zones: [zone] });
  const transitions = [];
  tracker.onEnter = (id, hit) => transitions.push(`enter:${id}:${hit.condition}`);
  tracker.onExit = (id, hit) => transitions.push(`exit:${id}:${hit.condition}`);
  assert.equal(tracker.update('a', zone, 'elderly').severity, 'low');
  tracker.dismiss('a');
  assert.equal(tracker.update('a', zone, 'elderly'), null);
  assert.equal(tracker.update('a', zone, 'toddler').severity, 'high');
  assert.equal(tracker.update('a', { x: 10, z: 10 }, 'toddler'), null);
  assert.equal(tracker.update('a', zone, 'toddler').severity, 'high');
  assert.deepEqual(transitions, ['enter:a:elderly', 'enter:a:toddler', 'exit:a:toddler', 'enter:a:toddler']);
  tracker.reset('a');
  assert.equal(tracker.pendingFor('a'), null);
});

test('tracker emits exit before entering another zone and keeps entities independent', () => {
  const other = { ...zone, x: 4 };
  const tracker = new HazardTracker({ zones: [zone, other] });
  const transitions = [];
  tracker.onEnter = (id, hit) => transitions.push(`enter:${id}:${hit.zone.x}`);
  tracker.onExit = (id, hit) => transitions.push(`exit:${id}:${hit.zone.x}`);
  tracker.update('a', zone, 'elderly');
  tracker.update('b', zone, 'toddler');
  tracker.update('a', other, 'elderly');
  assert.equal(tracker.pendingFor('b').condition, 'toddler');
  assert.deepEqual(transitions.slice(-2), ['exit:a:0', 'enter:a:4']);
});

test('v2 demo zones are registered on the real room grid; unknown or invalid definitions fail', () => {
  validateSimulationEnvironment(room);
  for (const point of room.hazardZones) assert.ok(isWalkable(room, point, room.objects, 0.28));
  for (const change of [{ radius: -1 }, { x: Infinity }, { hazardId: 'unknown' }, { propScale: 0 }]) {
    assert.throws(() => validateSimulationEnvironment({ ...room, hazardZones: [{ ...room.hazardZones[0], ...change }] }));
  }
});

test('alert-only routes report crossed zones even with a long step', () => {
  const simulation = new Simulation(room);
  simulation.autoHazardFalls = false;
  simulation.requestDestination('dining');
  simulation.advance(20);
  assert.equal(simulation.status, 'arrived');
  assert.equal(simulation.fall, null);
  assert.ok(simulation.events.some(event => event.type === 'hazardEncountered' && event.ids.includes('loose_rug')));
  assert.equal(simulation.pendingHazard, null, 'Popup clears after leaving the zone');
});

test('v2 body/profile changes, dismiss, pause, reset and fall playback share consistent hazard state', () => {
  const simulation = new Simulation(room);
  simulation.autoHazardFalls = false;
  simulation.requestDestination('kitchen');
  simulation.advance(20);
  assert.equal(simulation.pendingHazard.severity, 'low');
  simulation.paused = true;
  const before = simulation.snapshot();
  simulation.advance(20);
  assert.deepEqual(simulation.snapshot(), before);
  simulation.setPosture('toddler');
  assert.equal(simulation.pendingHazard.severity, 'high');
  simulation.dismissHazard();
  assert.equal(simulation.pendingHazard, null);
  simulation.setHazardProfile('elderly');
  assert.equal(simulation.pendingHazard.severity, 'low');
  simulation.setHazardProfile('off');
  assert.equal(simulation.pendingHazard, null);
  simulation.setHazardProfile('toddler');
  assert.equal(simulation.pendingHazard.severity, 'high');
  simulation.playFall('trip');
  assert.equal(simulation.pendingHazard, null);
  simulation.reset();
  assert.equal(simulation.pendingHazard, null);
  assert.equal(simulation.hazardProfile, 'toddler');
});

test('unconfigured environments never inherit the original house zones', () => {
  const simulation = new Simulation(tantauFixture);
  simulation.position = { x: 6.5, z: 8.8 };
  simulation.advance(1);
  assert.equal(simulation.pendingHazard, null);
});

const openRoom = (hazardId = 'loose_rug') => ({ ...tantauFixture, objects: [], navigation: undefined,
  floor: { x: 0, z: 0, width: 20, depth: 20 }, spawn: { x: 0, z: -2 },
  destinations: [{ id: 'end', label: 'End', x: 0, z: 3 }],
  hazardZones: [{ hazardId, x: 0, z: 0, radius: 0.6, room: 'Test' }] });

test('grandma route trips, rests, gets up at landing and resumes the destination', () => {
  const sim = new Simulation(openRoom());
  sim.requestDestination('end');
  sim.advance(20);
  assert.equal(sim.status, 'falling');
  assert.equal(sim.fall.kind, 'trip');
  assert.ok(sim.position.z < 0, 'long route step stops at the hazard edge');
  sim.advance(2);
  assert.equal(sim.status, 'fallen');
  const landing = { ...sim.position };
  sim.advance(1.5);
  assert.equal(sim.status, 'recovering');
  sim.paused = true;
  const frozen = sim.snapshot();
  sim.advance(20);
  sim.drive(1, 0, 20);
  assert.deepEqual(sim.snapshot(), frozen);
  sim.paused = false;
  sim.advance(10);
  assert.equal(sim.fall, null);
  assert.deepEqual(sim.position, landing, 'get-up stays at landing, not spawn');
  assert.equal(sim.destination, 'end');
  sim.advance(20);
  assert.equal(sim.status, 'arrived');
  assert.equal(sim.events.filter(e => e.type === 'fallStarted').length, 1);
  assert.equal(sim.events.filter(e => e.type === 'recoveryCompleted').length, 1);
});

test('manual sideways fall locks controls, recovers, and rearms only after exiting the zone', () => {
  const sim = new Simulation(openRoom('small_objects_reachable'));
  sim.setManual();
  sim.drive(1, 0, 10);
  assert.equal(sim.fall.kind, 'sideways');
  const before = sim.snapshot();
  sim.drive(1, 1, 20);
  assert.deepEqual(sim.snapshot(), before);
  sim.advance(20);
  assert.equal(sim.fall, null);
  assert.equal(sim.manual, true);
  sim.drive(1, 0, 0.1);
  assert.equal(sim.fall, null, 'no repeat inside the same zone');
  sim.drive(1, 0, 3);
  sim.heading = Math.PI;
  sim.drive(1, 0, 10);
  assert.equal(sim.fall.kind, 'sideways', 'new entry triggers again');
  sim.reset();
  sim.setManual();
  sim.drive(1, 0, 10);
  assert.equal(sim.status, 'falling', 'reset clears suppression');
});

test('stationary grandma and other bodies do not auto-fall; disabling hazards is respected', () => {
  for (const mode of ['stationary', 'adult', 'off', 'disabled']) {
    const sim = new Simulation(openRoom());
    if (mode === 'adult') { sim.setPosture('adult'); sim.setHazardProfile('elderly'); }
    if (mode === 'off') sim.setHazardProfile('off');
    if (mode === 'disabled') sim.autoHazardFalls = false;
    if (mode === 'stationary') { sim.position = { x: 0, z: 0 }; sim.advance(10); }
    else { sim.requestDestination('end'); sim.advance(20); }
    assert.equal(sim.fall, null, mode);
  }
});

test('recovery frames join the fallen and standing poses without a root jump', async () => {
  const { poseRoomRecovery, roomFallFrame, roomFallTotalDuration } = await import('../src/falls.ts');
  const { poseFall } = await import('../../v1-draft/src/robot/fall-motion.ts');
  const { postures } = await import('../src/posture.ts');
  const { stance, motion } = postures.grandma;
  for (const kind of ['trip', 'patio', 'sideways']) {
    for (const progress of [0, 1]) {
      const actual = new Map(), expected = new Map();
      const orientation = poseRoomRecovery({ set: (n, a) => actual.set(n, a) }, stance, 0, 0, motion, 0, progress, 0, kind);
      const target = poseFall({ set: (n, a) => expected.set(n, a) }, stance, 0, 0, motion, 0, 1 - progress, 0, kind);
      for (const [joint, angle] of expected) assert.ok(Math.abs(actual.get(joint) - angle) < 1e-10);
      assert.ok(Math.abs(orientation.pitch - target.pitch) < 1e-10);
      assert.ok(Math.abs(orientation.roll - target.roll) < 1e-10);
    }
    const fall = { kind, elapsed: 0, autoRecover: true };
    fall.elapsed = roomFallTotalDuration(fall);
    assert.equal(roomFallFrame(fall).recovery, 1);
  }
});
