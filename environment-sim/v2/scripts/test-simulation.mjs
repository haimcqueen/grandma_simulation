import assert from "node:assert/strict";
import { test } from "node:test";
import { tantauFixture, isWalkable } from "../src/environment.ts";
import { Simulation } from "../src/simulation.ts";
import { planRoute, segmentClear } from "../src/navigation.ts";
const walk = (simulation) => {
  for (let step = 0; step < 3600 && simulation.status === "walking"; step++) {
    simulation.advance(1 / 60);
    assert.ok(
      isWalkable(
        simulation.environment,
        simulation.position,
        simulation.obstacles,
        simulation.profile.radius,
      ),
      "Resident maintains body clearance at every step",
    );
  }
};
test("all named destinations are reachable with conservative clearance", () => {
  for (const destination of tantauFixture.destinations) {
    const simulation = new Simulation(tantauFixture);
    simulation.requestDestination(destination.id);
    walk(simulation);
    assert.equal(simulation.status, "arrived");
    assert.ok(
      Math.hypot(
        simulation.position.x - destination.x,
        simulation.position.z - destination.z,
      ) < 1e-6,
    );
  }
});
test("cart replans an active journey and increases distance", () => {
  const baseline = new Simulation(tantauFixture);
  baseline.requestDestination("kitchen");
  walk(baseline);
  const simulation = new Simulation(tantauFixture);
  simulation.requestDestination("kitchen");
  simulation.advance(0.4);
  assert.equal(simulation.setScenario("cart"), true);
  assert.ok(simulation.events.some((event) => event.type === "routeReplanned"));
  walk(simulation);
  assert.equal(simulation.status, "arrived");
  assert.ok(simulation.distance > baseline.distance + 0.1);
});
test("barrier stops movement and removal resumes the same task", () => {
  const simulation = new Simulation(tantauFixture);
  simulation.requestDestination("kitchen");
  simulation.advance(0.5);
  simulation.setScenario("blocked");
  const position = { ...simulation.position };
  simulation.advance(4);
  assert.equal(simulation.status, "blocked");
  assert.deepEqual(simulation.position, position);
  assert.deepEqual(simulation.route, []);
  simulation.setScenario("clear");
  walk(simulation);
  assert.equal(simulation.status, "arrived");
});
test("cannot place an obstruction on the resident", () => {
  const simulation = new Simulation(tantauFixture);
  simulation.position = { ...tantauFixture.passage };
  assert.equal(simulation.setScenario("cart"), false);
  assert.equal(simulation.scenario, "clear");
  assert.equal(simulation.revision, 0);
});
test("pause freezes state and reset preserves a reproducible scenario", () => {
  const simulation = new Simulation(tantauFixture);
  simulation.setScenario("cart");
  simulation.profile.speed = 0.7;
  simulation.requestDestination("kitchen");
  simulation.advance(0.5);
  simulation.paused = true;
  const before = simulation.snapshot();
  simulation.advance(10);
  assert.deepEqual(simulation.snapshot(), before);
  simulation.reset();
  assert.equal(simulation.scenario, "cart");
  assert.equal(simulation.profile.speed, 0.7);
  assert.equal(simulation.time, 0);
  const run = () => {
    simulation.requestDestination("kitchen");
    walk(simulation);
    return {
      position: simulation.position,
      distance: simulation.distance,
      time: simulation.time,
    };
  };
  const first = run();
  simulation.reset();
  assert.deepEqual(run(), first);
});
test("planner supports shifted fixtures and rejects solid destinations", () => {
  const shift = (point) => ({ ...point, x: point.x - 20, z: point.z + 31 });
  const environment = {
    ...tantauFixture,
    floor: shift(tantauFixture.floor),
    objects: tantauFixture.objects.map(shift),
    spawn: shift(tantauFixture.spawn),
    destinations: tantauFixture.destinations.map(shift),
  };
  const route = planRoute(
    environment,
    environment.spawn,
    environment.destinations[1],
    environment.objects,
    0.28,
  );
  assert.ok(route);
  let previous = environment.spawn;
  for (const point of route) {
    assert.ok(
      segmentClear(environment, previous, point, environment.objects, 0.28),
    );
    previous = point;
  }
  assert.equal(
    planRoute(
      environment,
      environment.spawn,
      environment.objects.find((object) => object.id === "island"),
      environment.objects,
      0.28,
    ),
    null,
  );
});

test("grid navigation avoids blocked cells and rejects unsupported clearance", async () => {
  const { gridSegmentClear } = await import("../src/navigation-grid.ts");
  const grid = {
    origin: { x: 0, z: 0 },
    cell: 0.2,
    columns: 30,
    rows: 30,
    clearance: 0.28,
    height: 1.7,
    walkable: Array(900).fill(1),
    floorHeights: Array(900).fill(0),
  };
  for (let z = 5; z < 25; z++) grid.walkable[z * 30 + 15] = 0;
  const environment = {
    ...tantauFixture,
    floor: { x: 3, z: 3, width: 6, depth: 6 },
    objects: [],
    navigation: grid,
  };
  const start = { x: 1, z: 3 },
    goal = { x: 5, z: 3 };
  const route = planRoute(environment, start, goal, [], 0.28);
  assert.ok(route);
  let previous = start;
  for (const point of route) {
    assert.ok(gridSegmentClear(grid, previous, point));
    previous = point;
  }
  assert.equal(planRoute(environment, start, goal, [], 0.4), null);
  assert.equal(
    gridSegmentClear(grid, { x: 2.99, z: 1.19 }, { x: 3.21, z: 0.99 }),
    false,
    "A segment crossing a tiny blocked-cell corner must be rejected",
  );
});

const { readFileSync } = await import('node:fs');
const roomDescriptor = JSON.parse(readFileSync(new URL('../public/environment/tantau-simulation.json', import.meta.url)));
// Navigation-only fixture. Automatic encounters/recovery are covered in test-hazards.mjs.
const realisticRoom = { ...roomDescriptor, hazardZones: [], navigation: JSON.parse(readFileSync(new URL('../public/environment/tantau-navigation.json', import.meta.url))) };
test('keyboard takeover cancels routes, ramps speed, brakes and preserves pause', () => {
  const simulation = new Simulation(realisticRoom);
  simulation.requestDestination('kitchen');
  simulation.setManual();
  assert.equal(simulation.destination, null);
  assert.deepEqual(simulation.route, []);
  simulation.drive(1, 0, 1 / 60);
  assert.ok(simulation.currentSpeed > 0 && simulation.currentSpeed < simulation.profile.speed);
  simulation.drive(1, 0, 0.4);
  assert.ok(simulation.distance > 0.05);
  simulation.paused = true;
  const paused = simulation.snapshot();
  simulation.drive(1, 1, 10);
  simulation.advance(10);
  assert.deepEqual(simulation.snapshot(), paused);
  simulation.paused = false;
  simulation.drive(0, 0, 2);
  assert.equal(simulation.currentSpeed, 0);
  assert.equal(simulation.status, 'idle');
  simulation.requestDestination('kitchen');
  assert.equal(simulation.manual, false);
  walk(simulation);
  assert.equal(simulation.status, 'arrived');
});
test('keyboard movement cannot tunnel through generated geometry or scenario blockers', () => {
  for (const scenario of ['clear', 'cart', 'blocked']) {
    for (let direction = 0; direction < 12; direction++) {
      const simulation = new Simulation(realisticRoom);
      simulation.setScenario(scenario);
      simulation.setManual();
      simulation.heading = direction * Math.PI / 6;
      const start = { ...simulation.position };
      simulation.drive(1, 0, 30);
      assert.ok(segmentClear(realisticRoom, start, simulation.position, simulation.obstacles, simulation.profile.radius));
      assert.equal(simulation.currentSpeed, 0);
      const phase = simulation.gaitPhase;
      simulation.drive(1, 0, 2);
      assert.equal(simulation.gaitPhase, phase, 'Blocked feet stop stepping');
    }
  }
});
test('grandma preset, reverse gait, turning and reset share one motion state', () => {
  const simulation = new Simulation(realisticRoom);
  assert.equal(simulation.posture, 'grandma');
  assert.equal(simulation.profile.speed, 0.77);
  simulation.setManual();
  simulation.drive(-1, 0, 0.2);
  assert.ok(simulation.gaitPhase < 0);
  simulation.stopManualMotion();
  const position = { ...simulation.position };
  simulation.drive(0, 1, 0.5);
  assert.deepEqual(simulation.position, position);
  assert.ok(simulation.heading > 0);
  simulation.setPosture('upright');
  assert.equal(simulation.profile.speed, 1.3);
  assert.deepEqual(simulation.position, position);
  simulation.reset();
  assert.equal(simulation.manual, false);
  assert.equal(simulation.gaitPhase, 0);
  assert.equal(simulation.posture, 'upright');
  assert.deepEqual(simulation.position, realisticRoom.spawn);
});
const { validateSimulationEnvironment } = await import('../src/simulation-environment.ts');
const { WalkingRoutine } = await import('../src/walking-routine.ts');
test('actual room anchors are reachable in both directions with clearance on every step', () => {
  validateSimulationEnvironment(realisticRoom);
  for (const start of realisticRoom.destinations) for (const target of realisticRoom.destinations) {
    const simulation = new Simulation({...realisticRoom, spawn:start});
    simulation.requestDestination(target.id); walk(simulation);
    assert.equal(simulation.status,'arrived');
  }
});
test('actual room cart detours and barrier blocks, then clearing resumes', () => {
  const base = new Simulation(realisticRoom);base.requestDestination('kitchen');walk(base);
  const simulation = new Simulation(realisticRoom);
  simulation.requestDestination('kitchen');simulation.advance(.1);
  assert.equal(simulation.setScenario('cart'),true);walk(simulation);
  assert.equal(simulation.status,'arrived');assert.ok(simulation.distance > base.distance + .05);
  simulation.reset();assert.equal(simulation.setScenario('blocked'),true);
  simulation.requestDestination('kitchen');assert.equal(simulation.status,'blocked');
  const blocked=simulation.position;simulation.advance(2);assert.deepEqual(simulation.position,blocked);
  simulation.setScenario('clear');walk(simulation);assert.equal(simulation.status,'arrived');
});
test('walking routine visits every actual-room destination and respects pause', () => {
  const simulation = new Simulation(realisticRoom);const routine=new WalkingRoutine(simulation);routine.start();
  const reached=new Set();
  for(let step=0;step<2400;step++) { simulation.advance(1/60);routine.advance();
    assert.ok(isWalkable(realisticRoom,simulation.position,simulation.obstacles,simulation.profile.radius));
    for(const event of simulation.events)if(event.type==='destinationReached')reached.add(event.ids[1]);
  }
  assert.equal(reached.size,3);simulation.paused=true;const before=simulation.snapshot();
  for(let i=0;i<120;i++){simulation.advance(1/60);routine.advance();}assert.deepEqual(simulation.snapshot(),before);
  routine.stop();simulation.reset();assert.equal(routine.active,false);assert.equal(simulation.status,'idle');
});

test('room fall demos preserve world coordinates, pause, replay and movement ownership', () => {
  for (const kind of ['trip', 'patio', 'sideways']) {
    const simulation = new Simulation(realisticRoom);
    const origin = { ...simulation.position };
    simulation.requestDestination('kitchen');
    assert.equal(simulation.playFall(kind), true);
    assert.equal(simulation.destination, null);
    assert.deepEqual(simulation.route, []);
    simulation.advance(0.7);
    simulation.paused = true;
    const paused = simulation.snapshot();
    simulation.advance(10);
    simulation.setManual();
    simulation.drive(1, 1, 10);
    simulation.requestDestination('dining');
    assert.deepEqual(simulation.snapshot(), paused);
    assert.equal(simulation.setScenario('cart'), false);
    simulation.paused = false;
    for (let step = 0; step < 240; step++) {
      const before = { ...simulation.position };
      simulation.advance(1 / 60);
      assert.ok(segmentClear(realisticRoom, before, simulation.position, simulation.obstacles, simulation.profile.radius));
    }
    assert.equal(simulation.status, 'fallen');
    assert.equal(simulation.events.filter(event => event.type === 'fallCompleted').length, 1);
    const landed = { ...simulation.position };
    assert.equal(simulation.playFall(kind), true);
    assert.deepEqual(simulation.position, origin);
    simulation.advance(10);
    assert.deepEqual(simulation.position, landed);
    simulation.reset();
    assert.equal(simulation.fall, null);
    assert.equal(simulation.status, 'idle');
    assert.deepEqual(simulation.position, origin);
  }
});

test('generated room rejects unsupported stair and balcony demos without changing state', () => {
  const simulation = new Simulation(realisticRoom);
  const before = simulation.snapshot();
  assert.equal(simulation.playFall('stairs'), false);
  assert.equal(simulation.playFall('balcony'), false);
  assert.deepEqual(simulation.snapshot(), before);
});

test('Unitree body presets and slow playback retain the generated-room navigation contract', () => {
  for (const preset of ['grandma', 'upright', 'adult', 'baby', 'toddler', 'dog']) {
    const simulation = new Simulation(realisticRoom);
    simulation.setPosture(preset);
    simulation.playbackSpeed = 0.25;
    simulation.setManual();
    simulation.drive(1, 0, 1);
    simulation.advance(1);
    assert.equal(simulation.time, 0.25);
    assert.ok(simulation.distance > 0);
    assert.ok(isWalkable(realisticRoom, simulation.position, simulation.obstacles, simulation.profile.radius));
    assert.equal(simulation.playFall('trip'), !['baby', 'dog'].includes(preset));
    if (simulation.fall) {
      simulation.advance(1);
      assert.equal(simulation.fall.elapsed, 0.25);
    }
    simulation.reset();
    assert.equal(simulation.posture, preset);
    assert.equal(simulation.playbackSpeed, 0.25);
  }
});
