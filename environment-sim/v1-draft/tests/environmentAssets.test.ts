import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EnvironmentAssets, placeVisual } from "../src/environmentAssets.ts";

const model = () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), new THREE.MeshStandardMaterial());
  mesh.position.set(12, 8, -5);
  root.add(mesh);
  return root;
};
test("a replacement with an off-center origin fits the authored footprint after rotation", () => {
  const root = model();
  const footprint = { x: 5, z: 9, width: 0.85, depth: 2.7 };
  placeVisual(root, { url: "sofa.glb", rotationY: Math.PI / 2 }, footprint);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  assert.ok(size.x <= footprint.width + 1e-6 && size.z <= footprint.depth + 1e-6);
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  assert.ok(Math.abs(center.x - footprint.x) < 1e-6 && Math.abs(center.z - footprint.z) < 1e-6);
  assert.deepEqual(footprint, { x: 5, z: 9, width: 0.85, depth: 2.7 });
});
test("failed replacement preserves the current model, and restore releases imported resources", async () => {
  let fail = false;
  const imported = model();
  let disposed = false;
  (imported.children[0] as THREE.Mesh).geometry.addEventListener("dispose", () => { disposed = true; });
  const scene = new THREE.Scene();
  const assets = new EnvironmentAssets(scene, async () => { if (fail) throw new Error("missing"); return imported; });
  const fallback = model();
  const slot = assets.register("ground:sofa", scene, fallback);
  await assets.replace("ground:sofa", { url: "first.glb" });
  assert.equal(fallback.visible, false);
  fail = true;
  await assert.rejects(assets.replace("ground:sofa", { url: "missing.glb" }));
  assert.ok(slot.children.includes(imported));
  assert.equal(disposed, false);
  assets.restore("ground:sofa");
  assert.equal(fallback.visible, true);
  assert.equal(disposed, true);
  assert.equal(slot.children.length, 1);
});
test("a stale load cannot overwrite a newer choice or resurrect a restored asset", async () => {
  const pending: ((model: THREE.Object3D) => void)[] = [];
  const scene = new THREE.Scene();
  const assets = new EnvironmentAssets(scene, () => new Promise(resolve => pending.push(resolve)));
  const fallback = model();
  const slot = assets.register("upper:bed", scene, fallback);
  const first = assets.replace("upper:bed", { url: "slow.glb" });
  const second = assets.replace("upper:bed", { url: "fast.glb" });
  const latest = model();
  pending[1](latest);
  assert.equal(await second, true);
  pending[0](model());
  assert.equal(await first, false);
  assert.ok(slot.children.includes(latest));
  const third = assets.replace("upper:bed", { url: "cancelled.glb" });
  assets.restore("upper:bed");
  pending[2](model());
  assert.equal(await third, false);
  assert.equal(fallback.visible, true);
  assert.equal(slot.children.length, 1);
});
test("partial configuration failure leaves independent successful assets usable", async () => {
  const scene = new THREE.Scene();
  const assets = new EnvironmentAssets(scene, async () => model());
  const fallback = model();
  assets.register("ground:shell", scene, fallback);
  const result = await assets.apply({ assets: {
    "ground:shell": { url: "shell.glb" }, "unknown": { url: "unknown.glb" },
  } });
  assert.equal(result[0].ok, true);
  assert.equal(result[1].ok, false);
  assert.equal(fallback.visible, false);
  assets.dispose();
});
