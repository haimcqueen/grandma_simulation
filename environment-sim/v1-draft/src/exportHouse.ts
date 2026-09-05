import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { floors, objects, type FloorLevel } from "./environment";
import { upperFloors, upperObjects } from "./upperFloor";

/** A geometry reference for Chisel/Blender, with full-height walls and metre units. */
export async function exportHouse(level: FloorLevel) {
  const root = new THREE.Group();
  root.name = `tantau-${level}-floor-reference`;
  root.userData = { units: "metres", up: "+Y", planFront: "+Z", source: "Approximate interpretation of supplied floor plan", wallHeight: 2.85 };
  const regions = level === "upper" ? upperFloors : floors;
  const items = level === "upper" ? upperObjects : objects;
  for (const floor of regions) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(floor.width, 0.16, floor.depth),
      new THREE.MeshStandardMaterial({ color: floor.color, roughness: 0.8 }));
    mesh.position.set(floor.x, -0.08, floor.z);
    mesh.name = floor.id;
    root.add(mesh);
  }
  for (const object of items) {
    const height = object.kind === "wall" ? 2.85 : object.height;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(object.width, height, object.depth),
      new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.8 }));
    mesh.position.set(object.x, height / 2, object.z);
    mesh.name = object.id;
    root.add(mesh);
  }
  try {
    const output = await new GLTFExporter().parseAsync(root, { binary: true });
    const blob = new Blob([output as ArrayBuffer], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${root.name}.glb`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
  }
}
