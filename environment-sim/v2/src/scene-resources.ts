import * as THREE from "three";

/** Only use for meshes/resources owned by the disposed component. */
export function disposeMeshes(root: THREE.Object3D, textures = false) {
  const disposed = new Set<THREE.Texture>();
  root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
        if (textures) for (const value of Object.values(material)) if (value instanceof THREE.Texture && !disposed.has(value)) {
          disposed.add(value); value.dispose();
        }
        material.dispose();
      });
    }
  });
}
