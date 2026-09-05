import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import type { Environment } from "./contracts";

/** Recheck only cells near removed furniture against the remaining room geometry. */
export function rebuildReplacementNavigation(environment: Environment, collider: THREE.Object3D, region: THREE.Box3): Environment {
  const original = environment.navigation;
  if (!original) return environment;
  const grid = { ...original, walkable: [...original.walkable], floorHeights: [...original.floorHeights] };
  const meshes: THREE.Mesh[] = [];
  collider.updateMatrixWorld(true);
  collider.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
    geometry.boundsTree = new MeshBVH(geometry);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.raycast = acceleratedRaycast; mesh.updateMatrixWorld(); meshes.push(mesh);
  });
  const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
  const down = new THREE.Vector3(0, -1, 0);
  const groundAt = (x: number, z: number) => {
    ray.set(new THREE.Vector3(x, environment.floorY + 0.25, z), down); ray.far = 0.45;
    const hit = ray.intersectObjects(meshes)[0];
    return hit && Math.abs(hit.point.y - environment.floorY) < 0.16 && Math.abs(hit.face!.normal.y) > 0.75 ? hit.point.y : null;
  };
  const radius = grid.clearance, inflated = radius + grid.cell * Math.SQRT2 / 2;
  const capsule = new THREE.Line3(), bounds = new THREE.Box3();
  const local = region.clone().expandByScalar(inflated + grid.cell);
  try {
    for (let key = 0; key < grid.walkable.length; key++) {
      const x = grid.origin.x + (key % grid.columns + 0.5) * grid.cell;
      const z = grid.origin.z + (Math.floor(key / grid.columns) + 0.5) * grid.cell;
      if (x < local.min.x || x > local.max.x || z < local.min.z || z > local.max.z) continue;
      const ground = groundAt(x, z);
      grid.walkable[key] = 0;
      if (ground === null) continue;
      grid.floorHeights[key] = ground;
      let supported = true;
      for (let sample = 0; sample < 8; sample++) {
        const angle = sample * Math.PI / 4;
        const height = groundAt(x + Math.cos(angle) * inflated, z + Math.sin(angle) * inflated);
        if (height === null || Math.abs(height - ground) > 0.12) { supported = false; break; }
      }
      if (!supported) continue;
      capsule.start.set(x, ground + radius, z); capsule.end.set(x, ground + grid.height - radius, z);
      bounds.setFromPoints([capsule.start, capsule.end]).expandByScalar(inflated);
      const blocked = meshes.some(mesh => mesh.geometry.boundsTree!.shapecast({
        intersectsBounds: box => box.intersectsBox(bounds),
        intersectsTriangle: triangle => Math.max(triangle.a.y, triangle.b.y, triangle.c.y) > ground + 0.12
          && triangle.closestPointToSegment(capsule) < inflated,
      }));
      if (!blocked) grid.walkable[key] = 1;
    }
  } finally {
    for (const mesh of meshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
  }
  return { ...environment, navigation: grid };
}
