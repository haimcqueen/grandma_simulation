import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AssetTransform, WorldAsset } from "./contracts";
import { disposeMeshes } from "./scene-resources";

function transform(object: THREE.Object3D, value: AssetTransform) {
  object.position.fromArray(value.position);
  object.quaternion.fromArray(value.quaternion);
  object.scale.setScalar(value.scale);
  object.updateMatrixWorld(true);
}
export async function loadWorld(asset: WorldAsset) {
  const started = performance.now();
  const { SplatMesh } = await import("@sparkjsdev/spark");
  const splats = new SplatMesh({
    url: asset.splatUrl,
    ...(asset.splatUrl.split("?")[0].endsWith(".rad")
      ? { paged: true, lod: false }
      : {}),
  });
  const results = await Promise.allSettled([
    splats.initialized,
    new GLTFLoader().loadAsync(asset.colliderUrl),
  ]);
  const colliderResult = results[1];
  if (
    results[0].status === "rejected" ||
    colliderResult.status === "rejected"
  ) {
    splats.dispose();
    if (colliderResult.status === "fulfilled")
      disposeMeshes(colliderResult.value.scene);
    throw new Error(
      "Environment could not load. Check the asset paths, access and CORS; use the authored fixture while resolving it.",
    );
  }
  const collider = colliderResult.value.scene;
  transform(splats, asset.splatTransform);
  transform(collider, asset.colliderTransform);
  const depth = new THREE.Group(),
    wire = new THREE.Group();
  const depthMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    colorWrite: false,
  });
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xe3a65b,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  let triangles = 0;
  collider.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const old = Array.isArray(child.material)
      ? child.material
      : [child.material];
    old.forEach((material) => material.dispose());
    child.material = depthMaterial;
    triangles +=
      (child.geometry.index?.count ??
        child.geometry.attributes.position.count) / 3;
    for (const [group, material] of [
      [depth, depthMaterial],
      [wire, wireMaterial],
    ] as const) {
      const mesh = new THREE.Mesh(child.geometry, material);
      mesh.applyMatrix4(child.matrixWorld);
      mesh.renderOrder = -10;
      group.add(mesh);
    }
  });
  return {
    splats,
    collider,
    depth,
    wire,
    metrics: {
      loadMs: Math.round(performance.now() - started),
      triangles,
      splats: splats.numSplats || null,
    },
    floorAt(x: number, z: number, ceiling = 2) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(x, ceiling, z),
        new THREE.Vector3(0, -1, 0),
      );
      return ray.intersectObject(collider, true)[0]?.point ?? null;
    },
    dispose() {
      splats.dispose();
      collider.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      depthMaterial.dispose();
      wireMaterial.dispose();
    },
  };
}

export { disposeMeshes } from "./scene-resources";
