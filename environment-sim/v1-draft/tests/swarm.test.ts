import test from "node:test";
import assert from "node:assert/strict";
import { Swarm } from "../src/robot/swarm.ts";
import { isWalkable, objects } from "../src/environment.ts";

const run = (s: Swarm, secs: number, dt = 1 / 60) => {
  for (let i = 0; i < secs / dt; i++) s.step(dt);
};

test("agents spawn on walkable floor, not inside furniture", () => {
  const s = new Swarm(200);
  for (const a of s.agents)
    assert.ok(isWalkable({ x: a.x, z: a.z }, objects), `spawned at ${a.x},${a.z}`);
});

test("agents stay inside the house while running around", () => {
  const s = new Swarm(120);
  run(s, 20);
  for (const a of s.agents) {
    if (a.fallT > 0) continue;
    assert.ok(isWalkable({ x: a.x, z: a.z }, objects),
      `escaped to ${a.x.toFixed(2)},${a.z.toFixed(2)}`);
  }
});

test("falls happen, and are recorded with a location", () => {
  const s = new Swarm(300);
  run(s, 45);
  assert.ok(s.totalFalls > 0, "no falls occurred at all");
  assert.equal(s.falls.length > 0, true);
  for (const f of s.falls) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.z));
});

test("falls cluster in tight space, not on open floor", () => {
  const s = new Swarm(300);
  run(s, 45);
  // every recorded fall should be at a spot whose local clearance is poor
  const tight = s.falls.filter((f) => !isWalkable({ x: f.x, z: f.z }, objects, 0.62));
  assert.ok(tight.length / s.falls.length > 0.6,
    `only ${((tight.length / s.falls.length) * 100).toFixed(0)}% of falls were in tight space`);
});

test("a fallen agent recovers rather than accumulating forever", () => {
  const s = new Swarm(80);
  run(s, 40);
  const down = s.agents.filter((a) => a.fallT > 0).length;
  assert.ok(down < s.agents.length * 0.5, "over half the swarm is stuck down");
});

test("reset clears the record and keeps the population", () => {
  const s = new Swarm(50);
  run(s, 30);
  const n = s.agents.length;
  s.reset();
  assert.equal(s.totalFalls, 0);
  assert.equal(s.falls.length, 0);
  assert.equal(s.agents.length, n);
});

test("500 agents step in reasonable time", () => {
  const s = new Swarm(500);
  const t0 = performance.now();
  run(s, 2);
  const ms = performance.now() - t0;
  const perFrame = ms / 120;
  assert.ok(perFrame < 6, `${perFrame.toFixed(2)} ms/frame for 500 agents is too slow`);
});
