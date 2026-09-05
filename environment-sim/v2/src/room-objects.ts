import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { RoomHazardZone } from "./hazards";

export type RoomObject = {
  id: string; modelUrl: string; position: [number, number, number]; size: [number, number, number];
  replacement: { min: [number, number, number]; max: [number, number, number] };
  hazard: RoomHazardZone;
};
/** Registered against the ottoman already present in the Tantau room, beside the rug. */
export const tantauOttoman: RoomObject = {
  id: "living-room-ottoman", modelUrl: "/props/ottoman.glb",
  position: [0.64, 0.02, -2.84], size: [0.74, 0.54, 0.8],
  replacement: { min: [-0.02, -0.12, -3.48], max: [1.23, 0.78, -2.05] },
  hazard: { hazardId: "ottoman", x: 0.64, z: -2.84, radius: 1.05, room: "Living-room ottoman",
    obstacle: { solidId: "living-room-ottoman" } },
};

/** Imported textured object with its base on the floor. Host owns placement and disposal. */
export async function loadRoomObject(definition: RoomObject) {
  const model = (await new GLTFLoader().loadAsync(definition.modelUrl)).scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(value => value > 0 && Number.isFinite(value))) throw new Error("Invalid object dimensions");
  const root = new THREE.Group(); root.name = definition.id;
  model.scale.set(...definition.size.map((value, axis) => value / size.getComponent(axis)) as [number, number, number]);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.traverse(child => { if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true; });
  root.add(model); root.position.fromArray(definition.position);
  // Fill the small rug patch hidden by the original ottoman in the scan.
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, v = y / 127;
    const grain = ((x * 73856093 ^ y * 19349663) >>> 0) % 17 - 8;
    const shadow = 1 - 0.22 * Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) * 20);
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const i = (y * 128 + x) * 4;
    pixels[i] = (179 + grain) * shadow; pixels[i + 1] = (164 + grain) * shadow; pixels[i + 2] = (151 + grain) * shadow;
    pixels[i + 3] = Math.min(1, edge / 0.07) * 255;
  }
  const texture = new THREE.DataTexture(pixels, 128, 128); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(definition.replacement.max[0] - definition.replacement.min[0] + 0.3,
    definition.replacement.max[2] - definition.replacement.min[2] + 0.3), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  patch.name = "replacement-floor"; patch.renderOrder = -20; patch.rotation.x = -Math.PI / 2;
  patch.position.set((definition.replacement.min[0] + definition.replacement.max[0]) / 2 - definition.position[0], 0.002,
    (definition.replacement.min[2] + definition.replacement.max[2]) / 2 - definition.position[2]);
  root.add(patch);
  return root;
}
