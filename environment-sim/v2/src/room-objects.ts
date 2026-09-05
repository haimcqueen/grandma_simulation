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
    danger: { likelihood: "high", intensity: "medium" },
    obstacle: { solidId: "living-room-ottoman", baseY: 0.02 } },
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
  return root;
}
