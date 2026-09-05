import * as THREE from "three";

/** Only use for meshes/resources owned by the disposed component. */
export function disposeMeshes(root: THREE.Object3D) {
  root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => material.dispose());
    }
  });
}
