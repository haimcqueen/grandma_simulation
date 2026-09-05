import * as THREE from "three";
import { FLOOR_RISE } from "./stairs";

export function createStaircase() {
  const group = new THREE.Group();
  group.name = "connecting-staircase";
  const wood = new THREE.MeshStandardMaterial({ color: 0xb39a77, roughness: 0.65 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x41483f, metalness: 0.4, roughness: 0.4 });
  function box(x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  function bar(a: THREE.Vector3, b: THREE.Vector3, thickness: number) {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, delta.length(), 8), rail);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    group.add(mesh);
  }
  const run = (5.508 - 3.7) / 9;
  for (let i = 0; i < 9; i++) {
    const low = (i + 1) * 0.17;
    const high = FLOOR_RISE / 2 + low;
    box(5.508 - (i + 0.5) * run, low - 0.085, 14.5, run, 0.17, 0.64);
    box(3.7 + (i + 0.5) * run, high - 0.085, 13.95, run, 0.17, 0.64);
    for (const [x, y, z] of [[5.508 - (i + 0.5) * run, low, 14.92], [3.7 + (i + 0.5) * run, high, 13.64]]) {
      bar(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 0.9, z), 0.015);
    }
  }
  box(3.41, FLOOR_RISE / 2 - 0.085, 14.275, 0.58, 0.17, 1.29);
  bar(new THREE.Vector3(5.50, 1.07, 14.92), new THREE.Vector3(3.7, FLOOR_RISE / 2 + 0.9, 14.92), 0.035);
  bar(new THREE.Vector3(3.7, FLOOR_RISE / 2 + 1.07, 13.64), new THREE.Vector3(5.50, FLOOR_RISE + 0.9, 13.64), 0.035);
  bar(new THREE.Vector3(3.12, FLOOR_RISE / 2 + 0.9, 13.64), new THREE.Vector3(3.12, FLOOR_RISE / 2 + 0.9, 14.92), 0.035);
  return group;
}
