import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import "./probe.css";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header><b>HOUSE LAB <span>/ V2 RESEARCH</span></b><a href="http://localhost:5173">V1 simulation ↗</a></header><main><section id="viewport"><div class="caption"><small>WORLD LABS OFFICIAL SAMPLE</small><h1>Inside the environment.</h1><p>Rendering and alignment probe · Not the Zillow house</p></div><div id="loading" role="status">Loading sample…</div></section><aside><h2>Inspect the layers</h2><p>A real splat environment, its exported collider, and an ordinary Three.js marker.</p><label><input id="splats" type="checkbox" checked> Show Gaussian splats</label><label><input id="collider" type="checkbox"> Show collider wireframe</label><label><input id="depth" type="checkbox"> Collider writes depth</label><label><input id="marker" type="checkbox" checked> Show resident-sized marker</label><label><input id="grid" type="checkbox"> Show reference grid</label><h3>Coordinate experiment</h3><label>Splat orientation<select id="splat-axis"><option value="flip">Rotate X 180°</option><option value="raw">Raw</option></select></label><label>Collider orientation<select id="collider-axis"><option value="flip">Rotate X 180°</option><option value="raw">Raw</option></select></label><p class="note">Unit scale is provisional. No metric metadata accompanies this sample. Marker: 1.7 units tall, 0.56 wide.</p><div class="buttons"><button id="front">View A</button><button id="left">View B</button><button id="right">View C</button><button id="orbit">Overview</button></div><button id="measure">Measure visible surfaces</button><button id="reload">Reload assets</button><p class="note">Click a floor surface to place the marker. Orange wireframe and depth-only mesh share the same transform.</p><pre id="metrics"></pre><details><summary>Surface comparison</summary><pre id="rays"></pre></details><p class="note">Drag to look around, scroll to zoom. This viewer does not implement navigation or collision response.</p></aside></main>`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const viewport = element("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#202725");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
viewport.append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(65, 1, 0.03, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.1;
controls.maxDistance = 25;
scene.add(new THREE.HemisphereLight(0xffffff, 0x727c70, 3));
const spark = new SparkRenderer({ renderer });
scene.add(spark);
const marker = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.28, 1.14, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0x38cda4, roughness: 0.7 }),
);
scene.add(marker);
const grid = new THREE.GridHelper(12, 24, 0xa2c5a8, 0x52645b);
scene.add(grid);
grid.visible = false;
let splats: SplatMesh | undefined, collider: THREE.Group | undefined;
const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0xffa54d,
  wireframe: true,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});
const depthMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  side: THREE.DoubleSide,
});
const colliderMaterial = new THREE.MeshBasicMaterial({
  side: THREE.DoubleSide,
});
const wireGroup = new THREE.Group();
scene.add(wireGroup);
const depthGroup = new THREE.Group();
scene.add(depthGroup);
depthGroup.visible = false;
let floorY = -1.5;
const metrics: Record<string, unknown> = {
  ready: false,
  three: THREE.REVISION,
  spark: "2.1.0",
  scale: "1.0, not metrically verified",
  loadCount: 0,
};
let frameSamples: number[] = [];
let previous = performance.now();
let loading = false;
function showMetrics() {
  element("metrics").textContent = JSON.stringify(metrics, null, 2);
}
function setView(name: string) {
  const views: Record<string, { position: number[]; target: number[] }> = {
    front: { position: [0, 0, 0], target: [2, -0.25, -1] },
    left: { position: [0, 0, 0], target: [-3, -0.1, -2] },
    right: { position: [0, 0, -1], target: [0, -0.1, 3] },
    orbit: { position: [7, 5, 8], target: [-1, -0.2, 1] },
  };
  const view = views[name];
  camera.position.fromArray(view.position);
  controls.target.fromArray(view.target);
  controls.update();
  metrics.view = name;
}
function transforms() {
  if (splats)
    splats.rotation.x =
      element<HTMLSelectElement>("splat-axis").value === "flip" ? Math.PI : 0;
  const rotation =
    element<HTMLSelectElement>("collider-axis").value === "flip" ? Math.PI : 0;
  if (collider) {
    collider.rotation.x = rotation;
    collider.updateMatrixWorld(true);
  }
  wireGroup.rotation.x = rotation;
  depthGroup.rotation.x = rotation;
  scene.updateMatrixWorld(true);
  metrics.transforms = {
    splatX: splats?.rotation.x,
    colliderX: rotation,
    scale: 1,
  };
  showMetrics();
}
function floorAt(x: number, z: number) {
  if (!collider) return null;
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, 2, z),
    new THREE.Vector3(0, -1, 0),
  );
  return (
    ray.intersectObject(collider, true).find((hit) => hit.point.y < -0.4)
      ?.point ?? null
  );
}
function placeMarker(x: number, z: number) {
  const point = floorAt(x, z);
  if (point) {
    marker.position.set(point.x, point.y + 0.85, point.z);
    floorY = point.y;
    grid.position.y = floorY;
    metrics.markerBase = point.toArray();
    showMetrics();
  }
}
async function load() {
  if (loading) return;
  loading = true;
  metrics.ready = false;
  element("loading").hidden = false;
  element("loading").textContent = "Loading sample…";
  if (splats) {
    scene.remove(splats);
    splats.dispose();
    splats = undefined;
  }
  if (collider) {
    collider.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    });
    collider = undefined;
  }
  wireGroup.clear();
  depthGroup.clear();
  delete metrics.surfaceRays;
  delete metrics.frameMedianMs;
  delete metrics.frameP95Ms;
  const started = performance.now();
  const params = new URLSearchParams(location.search);
  try {
    const world = new SplatMesh({
      url: params.has("missing")
        ? "/samples/missing.spz"
        : "/samples/kitchen.spz",
    });
    splats = world;
    scene.add(world);
    const gltfPromise = new GLTFLoader().loadAsync(
      "/samples/kitchen-collider.glb",
    );
    const worldPromise = world.initialized.then(() => {
      metrics.splatReadyMs = Math.round(performance.now() - started);
    });
    const [gltf] = await Promise.all([gltfPromise, worldPromise]);
    collider = gltf.scene;
    let triangles = 0;
    collider.updateMatrixWorld(true);
    collider.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material))
          child.material.forEach((material) => material.dispose());
        else child.material.dispose();
        child.material = colliderMaterial;
        triangles +=
          (child.geometry.index?.count ??
            child.geometry.attributes.position.count) / 3;
        const wire = new THREE.Mesh(child.geometry, wireMaterial);
        wire.applyMatrix4(child.matrixWorld);
        wireGroup.add(wire);
        const depth = new THREE.Mesh(child.geometry, depthMaterial);
        depth.applyMatrix4(child.matrixWorld);
        depth.renderOrder = -10;
        depthGroup.add(depth);
      }
    });
    transforms();
    metrics.rawColliderBounds = new THREE.Box3()
      .setFromObject(collider)
      .getSize(new THREE.Vector3())
      .toArray();
    metrics.rawSplatBounds = world
      .getBoundingBox()
      .getSize(new THREE.Vector3())
      .toArray();
    metrics.triangles = triangles;
    metrics.splats = world.numSplats;
    metrics.loadMs = Math.round(performance.now() - started);
    metrics.loadCount = Number(metrics.loadCount) + 1;
    metrics.ready = true;
    delete metrics.error;
    wireGroup.visible = element<HTMLInputElement>("collider").checked;
    depthGroup.visible = element<HTMLInputElement>("depth").checked;
    world.visible = element<HTMLInputElement>("splats").checked;
    placeMarker(0, 1);
    setView("front");
    element("loading").hidden = true;
    frameSamples = [];
  } catch (error) {
    metrics.error = String(error);
    element("loading").textContent =
      `Could not load sample: ${error instanceof Error ? error.message : String(error)}. Run npm run fetch-sample, then reload.`;
  } finally {
    loading = false;
    showMetrics();
  }
}
function compareSurfaces() {
  if (!splats || !collider || !metrics.ready) return;
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  const result = [];
  for (const [x, y] of [
    [-0.5, 0],
    [0, 0],
    [0.5, 0],
    [-0.4, -0.5],
    [0, -0.5],
    [0.4, -0.5],
  ]) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    const meshHit = ray.intersectObject(collider, true)[0];
    const splatHit = ray.intersectObject(splats)[0];
    result.push({
      screen: [x, y],
      collider: meshHit?.point.toArray(),
      splat: splatHit?.point.toArray(),
      distanceDifference:
        meshHit && splatHit
          ? Math.abs(meshHit.distance - splatHit.distance)
          : null,
    });
  }
  metrics.surfaceRays = result;
  element("rays").textContent = JSON.stringify(result, null, 2);
  showMetrics();
  return result;
}
for (const id of ["front", "left", "right", "orbit"])
  element(id).onclick = () => setView(id);
element("measure").onclick = compareSurfaces;
element("reload").onclick = load;
for (const id of ["splat-axis", "collider-axis"])
  element(id).onchange = () => {
    transforms();
    placeMarker(0, 1);
  };
for (const [id, object] of [
  ["collider", wireGroup],
  ["depth", depthGroup],
  ["marker", marker],
  ["grid", grid],
] as const)
  element<HTMLInputElement>(id).onchange = (event) =>
    (object.visible = (event.target as HTMLInputElement).checked);
element<HTMLInputElement>("splats").onchange = (event) => {
  if (splats) splats.visible = (event.target as HTMLInputElement).checked;
};
let pointer = { x: 0, y: 0 };
renderer.domElement.onpointerdown = (event) => {
  pointer = { x: event.clientX, y: event.clientY };
};
renderer.domElement.addEventListener("pointerup", (event) => {
  if (
    !collider ||
    Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4
  )
    return;
  const bounds = renderer.domElement.getBoundingClientRect();
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    ),
    camera,
  );
  const hit = ray.intersectObject(collider, true)[0];
  if (hit) {
    marker.position.copy(hit.point).add(new THREE.Vector3(0, 0.85, 0));
    metrics.markerBase = hit.point.toArray();
    showMetrics();
  }
});
new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(viewport);
renderer.setAnimationLoop((now) => {
  const delta = now - previous;
  previous = now;
  if (metrics.ready && delta > 0 && delta < 1000) {
    frameSamples.push(delta);
    if (frameSamples.length > 600) frameSamples.shift();
  }
  if (frameSamples.length && frameSamples.length % 60 === 0) {
    const sorted = [...frameSamples].sort((a, b) => a - b);
    metrics.frameMedianMs = Number(
      sorted[Math.floor(sorted.length * 0.5)].toFixed(1),
    );
    metrics.frameP95Ms = Number(
      sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    );
    showMetrics();
  }
  controls.update();
  renderer.render(scene, camera);
});
setView("front");
void load();
Object.assign(window, {
  probe: {
    metrics,
    setView,
    compareSurfaces,
    placeMarker,
    marker,
    reload: load,
    renderer,
    camera,
    controls,
  },
});
