import * as THREE from "three";
import { cutoutContains } from "./world-cutout";
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
  const { SplatMesh, SplatEdit, SplatEditSdf, SplatEditSdfType } = await import("@sparkjsdev/spark");
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
  // Both visual splats and depth geometry use the same world-space cut plane.
  // Camera cuts only change presentation. Authored openings also filter collider queries;
  // the shared connector supplies movement and floor support across those openings.
  const cutaway = new SplatEdit({ name: "House cutaway", softEdge: 0 });
  const ceiling = new SplatEditSdf({ type: SplatEditSdfType.PLANE, opacity: 1 });
  ceiling.rotation.x = Math.PI / 2;
  cutaway.add(ceiling);
  cutaway.sdfs = [ceiling];
  const frontEdit = new SplatEdit({ name: "Camera-facing wall cut", softEdge: 0 });
  const frontBox = new SplatEditSdf({ type: SplatEditSdfType.BOX, opacity: 1 });
  frontBox.scale.set(100, 50, 50);
  frontEdit.add(frontBox);
  frontEdit.sdfs = [frontBox];
  cutaway.add(frontEdit);
  // Explicit mesh edits prevent one floor's ceiling or portal cut affecting another floor.
  const openings = (asset.cutouts ?? []).map(bounds => {
    const edit = new SplatEdit({ name: "Authored connection opening", softEdge: 0 });
    const box = new SplatEditSdf({ type: SplatEditSdfType.BOX, opacity: 0 });
    box.position.fromArray(bounds.min).add(new THREE.Vector3().fromArray(bounds.max)).multiplyScalar(0.5);
    box.scale.fromArray(bounds.max).sub(new THREE.Vector3().fromArray(bounds.min)).multiplyScalar(0.5);
    box.rotation.y = bounds.yaw ?? 0;
    edit.add(box); edit.sdfs = [box]; edit.updateMatrixWorld(true);
    return edit;
  });
  splats.edits = [cutaway, frontEdit, ...openings];
  const cutoutBounds = (asset.cutouts ?? []).map(bounds => new THREE.Box3(new THREE.Vector3().fromArray(bounds.min), new THREE.Vector3().fromArray(bounds.max)));
  const raycast = (ray: THREE.Raycaster) => ray.intersectObject(collider, true).filter(hit => !(asset.cutouts ?? []).some(cut => cutoutContains(cut, hit.point)));
  const frontEnabled = { value: false };
  const frontEquation = { value: new THREE.Vector3() };
  const frontBase = { value: 0.65 };
  for (const material of [depthMaterial, wireMaterial]) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.frontEnabled = frontEnabled;
      shader.uniforms.frontEquation = frontEquation;
      shader.uniforms.frontBase = frontBase;
      shader.uniforms.openingCount = { value: cutoutBounds.length };
      shader.uniforms.openingMin = { value: Array.from({length: 8}, (_, i) => cutoutBounds[i]?.min ?? new THREE.Vector3()) };
      shader.uniforms.openingMax = { value: Array.from({length: 8}, (_, i) => cutoutBounds[i]?.max ?? new THREE.Vector3()) };
      shader.uniforms.openingYaw = { value: Array.from({length: 8}, (_, i) => asset.cutouts?.[i]?.yaw ?? 0) };
      shader.vertexShader = "varying vec3 cutawayWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\ncutawayWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = "varying vec3 cutawayWorld; uniform bool frontEnabled; uniform vec3 frontEquation; uniform float frontBase; uniform int openingCount; uniform vec3 openingMin[8]; uniform vec3 openingMax[8]; uniform float openingYaw[8];\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nfor (int i = 0; i < 8; i++) { if (i >= openingCount) break; vec3 center = (openingMin[i] + openingMax[i]) * 0.5; vec3 p = cutawayWorld - center; float c = cos(openingYaw[i]); float s = sin(openingYaw[i]); p = vec3(c*p.x-s*p.z,p.y,s*p.x+c*p.z)+center; if (all(greaterThanEqual(p, openingMin[i])) && all(lessThanEqual(p, openingMax[i]))) discard; }\nif (frontEnabled && cutawayWorld.y > frontBase && dot(cutawayWorld.xz, frontEquation.xy) > frontEquation.z) discard;");
    };
    material.customProgramCacheKey = () => "house-camera-openings-v3";
  }
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2);
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
    raycast,
    cutaway,
    get cutawayState() {
      return { ceilingHeight: ceiling.opacity === 0 ? ceiling.position.y : null,
        frontEnabled: frontEnabled.value, frontEquation: frontEquation.value.toArray() };
    },
    setFrontCut(normal: THREE.Vector3 | null, point: THREE.Vector3, floorY: number) {
      frontEnabled.value = normal !== null;
      frontBox.opacity = normal === null ? 1 : 0;
      if (normal) {
        frontBase.value = floorY + 0.65;
        frontEquation.value.set(normal.x, normal.z, normal.dot(point));
        frontBox.position.copy(point).addScaledVector(normal, 50);
        frontBox.position.y = frontBase.value + 50;
        frontBox.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        frontBox.updateMatrixWorld(true);
      }
    },
    setCutaway(height: number | null) {
      ceiling.opacity = height === null ? 1 : 0;
      if (height !== null) { ceiling.position.y = height; cutPlane.constant = height; }
      cutaway.updateMatrixWorld(true);
      depthMaterial.clippingPlanes = height === null ? null : [cutPlane];
      wireMaterial.clippingPlanes = height === null ? null : [cutPlane];
      depthMaterial.needsUpdate = true;
      wireMaterial.needsUpdate = true;
    },
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
      return raycast(ray)[0]?.point ?? null;
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
