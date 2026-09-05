import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer } from "@sparkjsdev/spark";
import { loadWorld } from "./world-loader";
import { parseWorldAsset } from "./asset-manifest";
import { sampleWorld } from "./environment";
import type { WorldAsset } from "./contracts";
import "./environment-style.css";

const mintUrl = "https://mint.gg/chat/ph76aa258at54gvzs8ytwm5je18dtcpx";
const references = [
  "https://photos.zillowstatic.com/fp/c547a9463a5bdb6987a2d29381aae429-cc_ft_576.jpg",
  "https://photos.zillowstatic.com/fp/5606d90947715b1c6c8afd31465618eb-cc_ft_576.jpg",
];
document.querySelector("#app")!.innerHTML = `
<header><a class="brand" href="/">HOUSE<span>LAB</span> <small>ENVIRONMENTS / 02</small></a><a href="${mintUrl}" target="_blank" rel="noreferrer">Open in Mint ↗</a></header>
<main><section id="viewport"><div class="room-title"><p class="eyebrow">CUPERTINO, CALIFORNIA</p><h1 id="room-name">The Tantau<br>great room.</h1><p id="provenance">Photo-guided World Labs environment</p></div><div id="loading" role="status">Preparing the environment…</div><div class="camera-toolbar"><button id="inside">Interior</button><button id="overview">Orbit</button><button id="reset-camera">Reset view</button><button id="capture">Save view</button></div><div class="hint">Drag to look around · Scroll to move closer · WASD to move</div></section>
<aside><p class="eyebrow">ENVIRONMENT WORKSPACE</p><h2>A real sense of home.</h2><p class="description">A living and kitchen space informed by the listing photographs, ready for the team to build on.</p>
<label for="world-select">Environment</label><select id="world-select"><option value="tantau">Tantau · photo-guided room</option><option value="sample">Official sample · diagnostics</option></select>
<div class="source-card"><span class="pill" id="state">GENERATING</span><p id="state-note">The final 3D environment is being generated from the approved preview.</p></div>
<div class="section-heading">REFERENCE PHOTOGRAPHS</div><div class="references">${references.map((url, index) => `<a href="${url}" target="_blank" rel="noreferrer"><img src="${url}" alt="Listing living and kitchen reference ${index + 1}"><span>View ${index + 1} ↗</span></a>`).join("")}</div><p class="fine">Generated appearance is an approximation. Unseen areas and dimensions are not verified by the photos.</p>
<div class="section-heading">INSPECT THE ENVIRONMENT</div><label class="toggle"><input id="show-collider" type="checkbox"> Collision geometry</label><label class="toggle"><input id="show-grid" type="checkbox"> Coordinate grid</label><label class="toggle"><input id="show-splats" type="checkbox" checked> Photorealistic appearance</label><p class="fine">Click a surface to record an anchor. These are spatial references for teammates, not automatically walkable destinations.</p><ol id="anchors"></ol><button class="secondary" id="clear-anchors">Clear anchors</button>
<div class="section-heading">TEAM HANDOFF</div><button class="primary" id="export">Export environment record ↓</button><p id="metrics" class="fine"></p><a class="text-link" href="/">Open house simulation ↗</a>
</aside></main>`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const viewport = element("viewport");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
viewport.append(renderer.domElement);
renderer.domElement.setAttribute(
  "aria-label",
  "Photorealistic house environment. Drag to look around; use camera buttons and WASD movement.",
);
const scene = new THREE.Scene();
const overlayScene = new THREE.Scene();
scene.background = new THREE.Color("#23332c");
const spark = new SparkRenderer({ renderer });
scene.add(spark);
const camera = new THREE.PerspectiveCamera(65, 1, 0.025, 150);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.08;
controls.maxDistance = 30;
const grid = new THREE.GridHelper(30, 60, 0xb4c9a1, 0x526b56);
overlayScene.add(grid);
grid.visible = false;
const pins = new THREE.Group();
overlayScene.add(pins);
let world: Awaited<ReturnType<typeof loadWorld>> | undefined,
  asset: WorldAsset | undefined,
  loadRevision = 0;
let anchors: Array<{ id: string; position: number[] }> = [];
let bounds = new THREE.Box3();
const keys = new Set<string>();
const metrics: Record<string, unknown> = { ready: false };
function setStatus(state: string, note: string) {
  element("state").textContent = state;
  element("state-note").textContent = note;
}
function inside() {
  if (!asset) return;
  camera.position.fromArray(asset.camera.position);
  controls.target.fromArray(asset.camera.target);
  controls.update();
}
function overview() {
  if (!world) return;
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3()).length();
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(new THREE.Vector3(size * 0.55, size * 0.38, size * 0.55));
  controls.update();
}
async function selectWorld(name: string) {
  const revision = ++loadRevision;
  metrics.ready = false;
  delete metrics.error;
  asset = undefined;
  element<HTMLSelectElement>("world-select").value = name;
  element("room-name").innerHTML =
    name === "sample" ? "Sample kitchen." : "The Tantau<br>great room.";
  if (world) {
    world.splats.visible = false;
    world.wire.visible = false;
  }
  clearAnchors();
  element("loading").hidden = false;
  element("loading").textContent = "Loading the 3D environment…";
  try {
    let candidate: WorldAsset;
    if (name === "sample") candidate = sampleWorld;
    else {
      const response = await fetch(
        import.meta.env.VITE_WORLD_MANIFEST_URL || "/environment/tantau.json",
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("json")
      )
        throw new Error(
          "The Tantau runtime assets are not available locally yet. The Mint generation is still being checked.",
        );
      const manifest = await response.json();
      candidate = parseWorldAsset(manifest.world ?? manifest);
    }
    const loaded = await loadWorld(candidate);
    if (revision !== loadRevision) {
      loaded.dispose();
      return;
    }
    if (world) {
      scene.remove(world.splats);
      overlayScene.remove(world.wire);
      world.dispose();
    }
    world = loaded;
    asset = candidate;
    scene.add(world.splats);
    overlayScene.add(world.wire);
    world.wire.visible = element<HTMLInputElement>("show-collider").checked;
    world.splats.visible = element<HTMLInputElement>("show-splats").checked;
    bounds = new THREE.Box3().setFromObject(world.collider);
    inside();
    grid.position.y = bounds.min.y;
    metrics.ready = true;
    metrics.asset = candidate.id;
    metrics.load = loaded.metrics;
    element("provenance").textContent = candidate.source;
    setStatus(
      "READY",
      candidate.metricStatus === "calibrated"
        ? "Environment loaded. Camera views and spatial anchors can be shared with the team."
        : "Environment loaded. Scale is provisional until checked against physical references.",
    );
    element("metrics").textContent =
      `${Math.round(loaded.metrics.triangles).toLocaleString()} collision triangles · ${loaded.metrics.loadMs} ms to initialize`;
    element("loading").hidden = true;
    clearAnchors();
  } catch (error) {
    if (revision !== loadRevision) return;
    metrics.error = String(error);
    setStatus(
      name === "tantau" ? "PENDING ASSETS" : "LOAD ERROR",
      error instanceof Error ? error.message : String(error),
    );
    element("loading").textContent =
      name === "tantau"
        ? "Final room assets are pending. The reference photos are shown at right."
        : "Sample unavailable. Run npm run fetch-sample.";
  }
}
function clearAnchors() {
  anchors = [];
  pins.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  pins.clear();
  element("anchors").replaceChildren();
}
let pointer = { x: 0, y: 0 };
renderer.domElement.addEventListener("pointerdown", (event) => {
  pointer = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener("pointerup", (event) => {
  if (
    !world ||
    Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4
  )
    return;
  const rect = renderer.domElement.getBoundingClientRect(),
    ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  const hit = ray.intersectObject(world.collider, true)[0];
  if (!hit) return;
  const anchor = {
    id: `anchor-${String(anchors.length + 1).padStart(2, "0")}`,
    position: hit.point.toArray().map((value) => Number(value.toFixed(4))),
  };
  anchors.push(anchor);
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xe7b767, depthTest: false }),
  );
  pin.position.copy(hit.point);
  pins.add(pin);
  const item = document.createElement("li");
  item.textContent = `${anchor.id} · ${anchor.position.map((value) => value.toFixed(2)).join(", ")}`;
  element("anchors").append(item);
});
function renderLayers() {
  renderer.autoClear = true;
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(overlayScene, camera);
  renderer.autoClear = true;
}
function download(filename: string, data: Blob) {
  const url = URL.createObjectURL(data),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
element("export").onclick = () => {
  if (!asset) return;
  download(
    "tantau-environment-record.json",
    new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            world: asset,
            anchors,
            camera: {
              position: camera.position.toArray(),
              target: controls.target.toArray(),
            },
            notes:
              "Anchors are surface picks. Scale and traversability require explicit validation.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
};
element("capture").onclick = () => {
  renderLayers();
  renderer.domElement.toBlob((blob) => {
    if (blob) download("tantau-view.png", blob);
  });
};
element("inside").onclick = inside;
element("reset-camera").onclick = inside;
element("overview").onclick = overview;
element("clear-anchors").onclick = clearAnchors;
element<HTMLSelectElement>("world-select").onchange = (event) =>
  void selectWorld((event.target as HTMLSelectElement).value);
element<HTMLInputElement>("show-collider").onchange = (event) => {
  if (world) world.wire.visible = (event.target as HTMLInputElement).checked;
};
element<HTMLInputElement>("show-splats").onchange = (event) => {
  if (world) world.splats.visible = (event.target as HTMLInputElement).checked;
};
element<HTMLInputElement>("show-grid").onchange = (event) => {
  grid.visible = (event.target as HTMLInputElement).checked;
};
window.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement).matches("input,select,button")) return;
  keys.add(event.key.toLowerCase());
});
window.addEventListener("keyup", (event) =>
  keys.delete(event.key.toLowerCase()),
);
window.addEventListener("blur", () => keys.clear());
const resize = new ResizeObserver(() => {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
});
resize.observe(viewport);
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const delta = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (world && keys.size) {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up);
    const movement = new THREE.Vector3();
    if (keys.has("w")) movement.add(forward);
    if (keys.has("s")) movement.sub(forward);
    if (keys.has("d")) movement.add(right);
    if (keys.has("a")) movement.sub(right);
    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(delta * 1.3);
      const ray = new THREE.Raycaster(
        camera.position,
        movement.clone().normalize(),
        0,
        movement.length() + 0.18,
      );
      if (!ray.intersectObject(world.collider, true).length) {
        camera.position.add(movement);
        controls.target.add(movement);
      }
    }
  }
  controls.update();
  renderLayers();
});
Object.assign(window, {
  environmentLab: {
    metrics,
    camera,
    controls,
    renderer,
    get world() {
      return world;
    },
    get asset() {
      return asset;
    },
    get anchors() {
      return anchors;
    },
    selectWorld,
    inside,
    overview,
  },
});
void selectWorld(
  new URLSearchParams(location.search).has("sample") ? "sample" : "tantau",
);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    loadRevision++;
    renderer.setAnimationLoop(null);
    resize.disconnect();
    controls.dispose();
    world?.dispose();
    spark.dispose();
    renderer.dispose();
  });
