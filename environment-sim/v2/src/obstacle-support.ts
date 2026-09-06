import * as THREE from "three";
import type { Footprint } from "./contracts";

export type ObstacleSupport = Footprint & { top: number };

/** Support the posed links on the furniture, rather than letting them sink into it.
 * Called after floor grounding. Forward travel and torso rotation carry the upper
 * body across the cushion; recovery withdraws to the original contact point.
 */
export function createObstacleSupport() {
  const bounds = new THREE.Box3();
  return (root: THREE.Object3D, support: ObstacleSupport) => {
    root.updateWorldMatrix(true, true);
    let lift = 0;
    root.traverse(child => {
      // Robot assets can originate from v1's Three.js module instance. Use the
      // public mesh flag so their links participate in support in either host.
      if (!(child as THREE.Mesh).isMesh) return;
      bounds.setFromObject(child);
      if (bounds.max.x < support.x - support.width / 2 || bounds.min.x > support.x + support.width / 2
        || bounds.max.z < support.z - support.depth / 2 || bounds.min.z > support.z + support.depth / 2) return;
      lift = Math.max(lift, support.top + 0.012 - bounds.min.y);
    });
    root.position.y += lift;
    root.updateWorldMatrix(true, true);
  };
}
