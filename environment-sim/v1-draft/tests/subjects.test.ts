import test from "node:test";
import assert from "node:assert/strict";
import { SUBJECTS, subjectById } from "../src/robot/subjects.ts";
import { crawl, BABY_CRAWL, TROT } from "../src/robot/crawl.ts";

/** Records what a gait writes, so we can assert on joints without three.js. */
function recorder() {
  const joints = new Map<string, number>();
  return { set: (j: string, v: number) => joints.set(j, v), joints };
}

test("every subject names an asset that exists and a coherent gait", () => {
  for (const s of SUBJECTS) {
    assert.ok(["g1", "h1", "go2"].includes(s.asset), `${s.id} asset`);
    if (s.locomotion === "quadruped") assert.ok(s.crawl, `${s.id} needs a crawl style`);
    else assert.ok(s.stance, `${s.id} needs a stance`);
    assert.ok(s.speedMps > 0 && s.speedMps < 3, `${s.id} speed`);
    assert.ok(s.note.length > 20, `${s.id} must state where its numbers came from`);
  }
});

test("crawling infant drives all twelve Go2 joints", () => {
  const r = recorder();
  crawl(r, BABY_CRAWL, 0.3, 1);
  assert.equal(r.joints.size, 12);
  for (const leg of ["FL", "FR", "RL", "RR"])
    for (const part of ["hip", "thigh", "calf"])
      assert.ok(r.joints.has(`${leg}_${part}_joint`), `${leg}_${part}`);
});

test("lateral crawl keeps three limbs loaded; trot lifts diagonal pairs", () => {
  const lifted = (style: typeof BABY_CRAWL, phase: number) =>
    style.offsets.filter((offset) => {
      const local = (((phase + offset) % 1) + 1) % 1;
      return local < 1 - style.duty;          // airborne window
    }).length;

  for (let phase = 0; phase < 1; phase += 0.01)
    assert.ok(lifted(BABY_CRAWL, phase) <= 1, `crawl lifts at most one limb at ${phase.toFixed(2)}`);
  assert.equal(lifted(TROT, 0.1), 2, "trot lifts a diagonal pair");
});

test("infant reach envelope excludes the worktop and includes the floor", () => {
  const baby = subjectById("baby");
  const gran = subjectById("grandma");
  assert.ok(baby.reachM < 0.9, "cannot reach a worktop");
  assert.ok(gran.reachM > 1.4, "can reach a worktop");
  assert.ok(baby.clearanceM < gran.clearanceM, "crawling needs less room to pass");
});

test("swapping subject changes speed, not just the mesh", () => {
  const speeds = SUBJECTS.map((s) => s.speedMps);
  assert.equal(new Set(speeds).size, speeds.length, "each subject moves differently");
  assert.ok(subjectById("baby").speedMps < subjectById("grandma").speedMps);
});

test("every livery resolves a material for any link name", async () => {
  const { LIVERIES, materialFor, liveryById } = await import("../src/robot/livery.ts");
  const links = ["pelvis", "head_link", "left_hand", "FR_calf_joint", "unknown_thing"];
  for (const livery of LIVERIES) {
    for (const link of links) assert.ok(materialFor(livery, link), `${livery.id}/${link}`);
    assert.equal(liveryById(livery.id).id, livery.id);
  }
  assert.equal(liveryById("nonexistent").id, "factory", "falls back rather than throwing");
});
