import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.ts";
import {
  destinations,
  isWalkable,
  objects,
  scenarioObjects,
  spawn,
} from "../src/environment.ts";
import { planRoute, segmentClear } from "../src/navigation.ts";
function complete(simulation: Simulation) {
  for (let i = 0; i < 120 * 60 && simulation.status === "walking"; i++) {
    simulation.advance(1 / 60);
    assert.ok(
      isWalkable(simulation.position, simulation.obstacles),
      "resident stays in free space",
    );
  }
  assert.equal(simulation.status, "arrived");
}
test("all destinations are reachable from the living room", () => {
  for (const destination of destinations) {
    const simulation = new Simulation();
    simulation.requestDestination(destination.id);
    complete(simulation);
    assert.ok(
      Math.hypot(
        simulation.position.x - destination.x,
        simulation.position.z - destination.z,
      ) < 0.001,
    );
  }
});
test("cart produces a longer, collision-free kitchen detour", () => {
  const clear = new Simulation();
  clear.requestDestination("kitchen");
  complete(clear);
  const cart = new Simulation();
  assert.ok(cart.setScenario("cart"));
  cart.requestDestination("kitchen");
  complete(cart);
  assert.ok(cart.distance > clear.distance + 1);
});
test("barrier blocks kitchen and removing it resumes the same task", () => {
  const simulation = new Simulation();
  simulation.setScenario("blocked");
  simulation.requestDestination("kitchen");
  assert.equal(simulation.status, "blocked");
  assert.equal(simulation.route.length, 0);
  simulation.advance(5);
  assert.deepEqual(simulation.position, spawn);
  simulation.setScenario("clear");
  complete(simulation);
});
test("mid-route changes invalidate and replace the route", () => {
  const simulation = new Simulation();
  simulation.requestDestination("kitchen");
  simulation.advance(0.2);
  simulation.setScenario("cart");
  assert.equal(simulation.events[0].type, "routeReplanned");
  complete(simulation);
});
test("obstruction cannot be placed on the resident", () => {
  const simulation = new Simulation();
  simulation.position = { x: 5.7, z: 11 };
  assert.equal(simulation.setScenario("cart"), false);
  assert.equal(simulation.scenario, "clear");
  assert.equal(simulation.events[0].type, "changeRejected");
});
test("pause freezes time and position; reset preserves scenario and speed", () => {
  const simulation = new Simulation();
  simulation.speed = 1.2;
  simulation.setScenario("cart");
  simulation.requestDestination("kitchen");
  simulation.advance(1);
  simulation.paused = true;
  const position = { ...simulation.position };
  const time = simulation.time;
  simulation.advance(10);
  assert.equal(simulation.time, time);
  assert.deepEqual(simulation.position, position);
  simulation.reset();
  assert.equal(simulation.scenario, "cart");
  assert.equal(simulation.speed, 1.2);
  assert.equal(simulation.time, 0);
  assert.equal(simulation.paused, false);
  assert.deepEqual(simulation.position, spawn);
  simulation.requestDestination("kitchen");
  complete(simulation);
});
test("routes include safe segments and reject occupied endpoints", () => {
  const obstacles = [...objects, ...scenarioObjects("cart")];
  const route = planRoute(spawn, destinations[1], obstacles)!;
  assert.ok(route);
  let previous = spawn;
  for (const point of route) {
    assert.ok(segmentClear(previous, point, obstacles));
    previous = point;
  }
  assert.equal(planRoute(spawn, { x: 8.15, z: 12.15 }, obstacles), null);
});
