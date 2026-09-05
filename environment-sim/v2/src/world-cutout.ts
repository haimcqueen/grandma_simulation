import * as THREE from "three";
import type { WorldCutout } from "./contracts";

/** Bounds are expressed before rotation about their center; yaw is in radians. */
export function cutoutContains(cut: WorldCutout, point: THREE.Vector3) {
  const center = new THREE.Vector3(...cut.min).add(new THREE.Vector3(...cut.max)).multiplyScalar(0.5);
  const local = point.clone().sub(center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -(cut.yaw ?? 0)).add(center);
  return local.x >= cut.min[0] && local.x <= cut.max[0] && local.y >= cut.min[1] && local.y <= cut.max[1] && local.z >= cut.min[2] && local.z <= cut.max[2];
}
