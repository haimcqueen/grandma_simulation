import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.ts";
import { isWalkable, radius, spawn } from "../src/environment.ts";
import { upperDestinations, upperObjects, upperSpawn } from "../src/upperFloor.ts";
import { FLOOR_RISE, STAIR_ENTRY } from "../src/stairs.ts";

test("all upstairs rooms are reachable and every movement step stays on that floor", () => {
  for (const destination of upperDestinations) {
    const sim = new Simulation();
    sim.setLevel("upper");
    sim.requestDestination(destination.id);
    assert.equal(sim.status, "walking", destination.label);
    for (let i = 0; i < 120 * 60 && sim.status === "walking"; i++) {
      sim.advance(1 / 60);
      assert.ok(isWalkable(sim.position, sim.obstacles, radius, sim.floorRegions), destination.label);
    }
    assert.equal(sim.status, "arrived", destination.label);
    assert.ok(Math.hypot(sim.position.x - destination.x, sim.position.z - destination.z) < 0.001);
  }
});

test("floor switching clears incompatible tasks and scenarios; reset stays upstairs", () => {
  const sim = new Simulation();
  sim.setScenario("cart");
  sim.requestDestination("kitchen");
  sim.setPatioFall(true);
  sim.setLevel("upper");
  assert.deepEqual(sim.position, upperSpawn);
  assert.equal(sim.destination, null);
  assert.equal(sim.scenario, "clear");
  assert.equal(sim.patioFallEnabled, false);
  assert.equal(sim.setScenario("blocked"), false);
  assert.equal(sim.playFall("balcony"), false);
  sim.requestDestination("kitchen");
  assert.equal(sim.destination, null);
  sim.requestDestination("primary");
  sim.advance(1);
  sim.reset();
  assert.equal(sim.level, "upper");
  assert.deepEqual(sim.position, upperSpawn);
  sim.setLevel("ground");
  assert.deepEqual(sim.position, spawn);
  sim.requestDestination("kitchen");
  assert.equal(sim.status, "walking");
});

test("upstairs exterior and stair opening are excluded from manual navigation", () => {
  const sim = new Simulation();
  sim.setLevel("upper");
  assert.equal(isWalkable({ x: 1, z: 1 }, sim.obstacles, radius, sim.floorRegions), false);
  const stair = upperObjects.find(o => o.id === "upper-stair-opening")!;
  assert.equal(isWalkable(stair, sim.obstacles, radius, sim.floorRegions), false);
  sim.setManual(true);
  sim.drive(1, 0, 30);
  assert.ok(isWalkable(sim.position, sim.obstacles, radius, sim.floorRegions));
});

test("robot walks continuously up and down stairs, pauses mid-flight, and arrives on walkable floor", () => {
  const sim = new Simulation();
  for (const target of ["upper", "ground"] as const) {
    assert.equal(sim.requestFloor(target), true);
    let sawClimb = false;
    let checkedPause = false;
    for (let i = 0; i < 180 * 60 && sim.changingFloor; i++) {
      const before = { ...sim.position, y: sim.elevation };
      sim.advance(1 / 60);
      assert.ok(Math.hypot(sim.position.x - before.x, sim.position.z - before.z, sim.elevation - before.y) < 0.05,
        "no teleport between staircase and floors");
      if (sim.onStairs) {
        sawClimb = true;
        if (!checkedPause && sim.elevation > 0.5 && sim.elevation < 2.5) {
          checkedPause = true;
          sim.paused = true;
          const paused = { ...sim.position, y: sim.elevation, phase: sim.gaitPhase };
          sim.advance(2);
          assert.deepEqual({ ...sim.position, y: sim.elevation, phase: sim.gaitPhase }, paused);
          sim.paused = false;
        }
      } else assert.ok(isWalkable(sim.position, sim.obstacles, radius, sim.floorRegions));
    }
    assert.ok(sawClimb && checkedPause);
    assert.equal(sim.changingFloor, false);
    assert.equal(sim.level, target);
    assert.equal(sim.elevation, target === "upper" ? FLOOR_RISE : 0);
    assert.deepEqual(sim.position, STAIR_ENTRY[target]);
  }
});

test("blocked stair approach is rejected and reset safely cancels a climb", () => {
  const sim = new Simulation();
  sim.setScenario("blocked");
  assert.equal(sim.requestFloor("upper"), false);
  assert.equal(sim.changingFloor, false);
  sim.setScenario("clear");
  sim.requestFloor("upper");
  for (let i = 0; i < 12000 && sim.elevation < 1; i++) sim.advance(1 / 60);
  assert.ok(sim.onStairs);
  assert.equal(sim.setScenario("blocked"), false);
  sim.reset();
  assert.equal(sim.onStairs, false);
  assert.equal(sim.changingFloor, false);
  assert.equal(sim.elevation, 0);
  assert.deepEqual(sim.position, spawn);
});

test("walking into the stair entrance engages keyboard traversal and releasing forward stops it", () => {
  for (const level of ["ground", "upper"] as const) {
    const sim = new Simulation();
    sim.setLevel(level);
    sim.position = { ...STAIR_ENTRY[level] };
    sim.heading = -Math.PI / 2;
    sim.setManual(true);
    sim.setStairInput(1);
    sim.drive(1, 0, 1 / 60);
    assert.equal(sim.manualStairs, true);
    for (let i = 0; i < 1200 && Math.abs(sim.elevation - (level === "upper" ? FLOOR_RISE : 0)) < 0.4; i++) sim.advance(1 / 60);
    assert.equal(sim.onStairs, true);
    sim.setStairInput(0);
    const stopped = { ...sim.position, elevation: sim.elevation };
    sim.advance(2);
    assert.deepEqual({ ...sim.position, elevation: sim.elevation }, stopped);
    sim.setStairInput(1);
    for (let i = 0; i < 9000 && sim.changingFloor; i++) sim.advance(1 / 60);
    assert.equal(sim.level, level === "ground" ? "upper" : "ground");
    assert.equal(sim.manual, true);
    assert.equal(sim.manualStairs, false);
  }
});
