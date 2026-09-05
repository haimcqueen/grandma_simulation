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

test('routes report crossed zones even with a long step, without triggering a fall or stopping travel', () => {
  const simulation = new Simulation(room);
  simulation.requestDestination('dining');
  simulation.advance(20);
  assert.equal(simulation.status, 'arrived');
  assert.equal(simulation.fall, null);
  assert.ok(simulation.events.some(event => event.type === 'hazardEncountered' && event.ids.includes('loose_rug')));
  assert.equal(simulation.pendingHazard, null, 'Popup clears after leaving the zone');
});

test('v2 body/profile changes, dismiss, pause, reset and fall playback share consistent hazard state', () => {
  const simulation = new Simulation(room);
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
