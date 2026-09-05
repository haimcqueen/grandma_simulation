import { cutoutContains } from "../src/world-cutout.ts";
import { buildStairStructure } from "../src/stair-structure.ts";
import { readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

// Usage: npx tsx scripts/bake-navigation.mjs <world.json> <collider.glb> <calibration.json> <output.json>
const [worldPath, colliderPath, calibrationPath, outputPath] =
  process.argv.slice(2);
if (!outputPath)
  throw new Error(
    "Expected world manifest, collider file, calibration JSON, and output path.",
  );
const world = JSON.parse(await readFile(worldPath, "utf8"));
const settings = JSON.parse(await readFile(calibrationPath, "utf8"));
const bytes = await readFile(colliderPath);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
gltf.scene.position.fromArray(world.colliderTransform.position);
gltf.scene.quaternion.fromArray(world.colliderTransform.quaternion);
gltf.scene.scale.setScalar(world.colliderTransform.scale);
gltf.scene.updateMatrixWorld(true);
const meshes = [];
const generated = new Set();
gltf.scene.traverse((child) => {
  if (!child.isMesh) return;
  const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  geometry.boundsTree = new MeshBVH(geometry);
  mesh.raycast = acceleratedRaycast;
  mesh.updateMatrixWorld();
  meshes.push(mesh); generated.add(mesh);
});
const reservedStairwells = [];
if (settings.houseUrl) {
  const house = JSON.parse(await readFile(`public${settings.houseUrl}`, "utf8"));
  for (const link of house.connections) {
    if (link.fromFloor === settings.floorId && link.stairwell) reservedStairwells.push({ ...link.stairwell, width: link.width });
    const structure = buildStairStructure(link);
    structure.traverse(child => {
      if (!child.isMesh) return;
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
      geometry.boundsTree = new MeshBVH(geometry);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      mesh.raycast = acceleratedRaycast; mesh.updateMatrixWorld(); meshes.push(mesh);
    });
  }
}
const { floorY, minimumX, maximumX, minimumZ, maximumZ } = settings;
const cell = settings.cell ?? 0.15,
  radius = settings.radius ?? 0.28,
  height = settings.height ?? 1.7;
const columns = Math.ceil((maximumX - minimumX) / cell),
  rows = Math.ceil((maximumZ - minimumZ) / cell);
const walkable = Array(columns * rows).fill(0),
  floorHeights = Array(columns * rows).fill(floorY);
const ray = new THREE.Raycaster();
ray.firstHitOnly = false;
const downward = new THREE.Vector3(0, -1, 0);
const floorTolerance = settings.floorTolerance ?? .16;
const getFloor = (x, z) => {
  ray.set(new THREE.Vector3(x, floorY + floorTolerance + .09, z), downward);
  ray.far = floorTolerance * 2 + .13;
  const hit = ray.intersectObjects(meshes).find(hit => !generated.has(hit.object) || !(world.cutouts ?? []).some(cut => cutoutContains(cut, hit.point)));
  return hit &&
    Math.abs(hit.point.y - floorY) < floorTolerance &&
    Math.abs(hit.face.normal.y) > 0.75
    ? hit.point.y
    : null;
};
const capsule = new THREE.Line3(),
  capsuleBounds = new THREE.Box3();
// The radius includes a cell diagonal, making every point in an accepted cell safe.
const inflated = radius + (cell * Math.SQRT2) / 2;
for (let z = 0; z < rows; z++)
  for (let x = 0; x < columns; x++) {
    const px = minimumX + (x + 0.5) * cell,
      pz = minimumZ + (z + 0.5) * cell,
      index = z * columns + x;
    // Floor walking cannot enter the flight volume. The stair controller takes over at its supported endpoint.
    if (reservedStairwells.some(layout => {
      const local = new THREE.Vector3(px-layout.origin.x, 0, pz-layout.origin.z).applyAxisAngle(new THREE.Vector3(0,1,0), -layout.yaw);
      return local.x > .18 && local.x < layout.approach+layout.run+layout.width/2+.16 && local.z > -layout.width/2-.16 && local.z < layout.separation+layout.width/2+.16;
    })) continue;
    const ground = getFloor(px, pz);
    if (ground === null) continue;
    floorHeights[index] = Number(ground.toFixed(4));
    let supported = true;
    for (let sample = 0; sample < 8; sample++) {
      const angle = (sample * Math.PI) / 4,
        h = getFloor(
          px + Math.cos(angle) * inflated,
          pz + Math.sin(angle) * inflated,
        );
      if (h === null || Math.abs(h - ground) > 0.12) {
        supported = false;
        break;
      }
    }
    if (!supported) continue;
    capsule.start.set(px, ground + radius, pz);
    capsule.end.set(px, ground + height - radius, pz);
    capsuleBounds
      .setFromPoints([capsule.start, capsule.end])
      .expandByScalar(inflated);
    const obstructed = meshes.some((mesh) =>
      mesh.geometry.boundsTree.shapecast({
        intersectsBounds: (bounds) => bounds.intersectsBox(capsuleBounds),
        intersectsTriangle: (triangle) => {
          if (
            Math.max(triangle.a.y, triangle.b.y, triangle.c.y) <=
            ground + 0.12
          )
            return false;
          const point = new THREE.Vector3();
          const distance = triangle.closestPointToSegment(capsule, point);
          return distance < inflated && (!generated.has(mesh) || !(world.cutouts ?? []).some(cut => cutoutContains(cut, point)));
        },
      }),
    );
    if (!obstructed) walkable[index] = 1;
  }
const grid = {
  origin: { x: minimumX, z: minimumZ },
  cell,
  columns,
  rows,
  clearance: radius,
  height,
  walkable,
  floorHeights,
};
await writeFile(outputPath, JSON.stringify(grid));
console.log(
  JSON.stringify({
    columns,
    rows,
    walkable: walkable.reduce((a, b) => a + b, 0),
    total: columns * rows,
    cell,
    radius,
    height,
    floorY,
  }),
);
// An ASCII map helps select and document anchors; x grows right, z grows down.
for (let z = 0; z < rows; z++)
  console.log(
    String(z).padStart(3) +
      " " +
      walkable
        .slice(z * columns, (z + 1) * columns)
        .map((value) => (value ? "·" : "#"))
        .join(""),
  );
