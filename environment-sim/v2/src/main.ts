import { loadHouse } from "./house-loader";
import { attachClickWalking } from "./movement/pointer";
import { MovementProgram } from "./movement/program";
import * as THREE from "three";
import { createFallDangerOverlay } from "./fall-danger-overlay";
import { rebuildReplacementNavigation } from "./replacement-navigation";
import { tantauOttoman, loadRoomObject } from "./room-objects";
import { parseWorldAsset } from "./asset-manifest";
import type { Environment } from "./contracts";
import { createKeyboardControls } from "./keyboard-controls";
import { loadSimulationEnvironment, validateSimulationEnvironment } from "./simulation-environment";
import { Viewer } from "./viewer";
import { createWalkthroughSimulation, createHouseWalkthrough, walkthroughViews } from "./walkthrough";
import "./walkthrough.css";

const connectedHouse = new URLSearchParams(location.search).has("house");
const views = connectedHouse ? [...walkthroughViews, { id: "top", label: "Top down", shortcut: "T" }, { id: "side", label: "Side", shortcut: "C" }] : walkthroughViews;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<main id="viewport" aria-label="Walk through the room">
  <nav class="camera-views" aria-label="Camera views">
    ${views.map(view => `<button data-view="${view.id}" aria-pressed="${view.id === "follow"}" title="${view.label} (${view.shortcut})" disabled>${view.label}</button>`).join("")}
  </nav>
  ${connectedHouse ? `<div class="house-actions"><button id="walk-floor" disabled>Walk upstairs</button><button id="stop-walk" disabled>Stop here</button><span id="movement-status" role="status"></span></div>` : ""}
  <div class="loading-message" role="status"><span id="load-status">Loading the room…</span><button id="retry" hidden>Try again</button></div>
  <div class="walk-hint"><span>↑ ↓ Move <span class="hint-divider">/</span> ← → Turn <span class="hint-divider">/</span> WASD</span><span id="camera-hint">Drag to look · Scroll to zoom</span></div>
</main>`;
const viewport = document.querySelector<HTMLElement>("#viewport")!;
const fallDanger = createFallDangerOverlay(viewport);
const status = document.querySelector<HTMLElement>("#load-status")!;
const retry = document.querySelector<HTMLButtonElement>("#retry")!;
const hint = document.querySelector<HTMLElement>("#camera-hint")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
let viewer: Viewer | undefined;
let simulation: ReturnType<typeof createWalkthroughSimulation> | undefined;
let movement: MovementProgram | undefined;
let disposeClickWalking: (() => void) | undefined;
let ready = false;
let disposed = false;

function selectView(view: Viewer["view"]) {
  if (!ready || !viewer) return;
  viewer.setView(view);
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.view === view));
  hint.textContent = view === "map" ? "Drag to pan · Scroll to zoom"
    : view === "first" ? "Turn with ← → or A / D"
    : "Drag to orbit · Scroll to zoom";
}
const keyboard = createKeyboardControls(window, {
  canDrive: () => ready && !simulation?.fall,
  onDriveStart: () => { movement?.cancel(false); simulation?.setManual(); },
  onClear: () => simulation?.stopManualMotion(),
  onShortcut: event => {
    if (!ready) return false;
    const view = views.find(view => event.code === `Key${view.shortcut}`);
    if (view) { selectView(view.id as Viewer["view"]); return true; }
    if (event.code === "KeyR") { keyboard.clear(); movement?.cancel(false); simulation?.reset(); simulation?.setManual(); return true; }
    return false;
  },
});
for (const button of buttons) button.onclick = () => {
  selectView(button.dataset.view as Viewer["view"]);
  button.blur();
};

async function start() {
  fallDanger.update(null, "idle");
  ready = false;
  retry.hidden = true;
  status.textContent = "Loading the room…";
  app.dataset.ready = "false";
  let nextViewer: Viewer | undefined;
  try {
    if (connectedHouse) {
      const source = await loadHouse(import.meta.env.VITE_HOUSE_MANIFEST_URL || "/environment/house/house.json");
      if (disposed) return;
      const session = createHouseWalkthrough(source);
      simulation = session.simulation;
      nextViewer = new Viewer(viewport, simulation.environment); viewer = nextViewer;
      viewer.hazardPropsVisible = false;
      const loaded = await Promise.allSettled([viewer.loadRobot("grandma"), viewer.showHouse(session.house)]);
      if (disposed) return;
      if (loaded.some(result => result.status === "rejected")) throw new Error("House or resident unavailable");
    } else {
      const response = await fetch(import.meta.env.VITE_WORLD_MANIFEST_URL || "/environment/tantau.json");
      if (!response.ok) throw new Error("Room unavailable");
      const bundle = await response.json();
      if (disposed) return;
      const asset = parseWorldAsset(bundle.world ?? bundle);
      if (!bundle.environment && asset.id !== "tantau-great-room") throw new Error("This room needs its own navigation configuration");
      const environment: Environment = bundle.environment ?? await loadSimulationEnvironment("/environment/tantau-simulation.json");
      validateSimulationEnvironment(environment);
      if (disposed) return;
      const furniture = asset.id === "tantau-great-room" ? [tantauOttoman] : [];
      simulation = createWalkthroughSimulation(environment, furniture.map(object => object.hazard));
      nextViewer = new Viewer(viewport, simulation.environment);
      viewer = nextViewer;
      viewer.hazardPropsVisible = false;
      const loaded = await Promise.allSettled([viewer.loadRobot("grandma"), viewer.showWorld(asset), ...furniture.map(async object => {
        const root = await loadRoomObject(object);
        viewer!.roomObjects.add(root); root.updateMatrixWorld(true);
        const floor = root.getObjectByName("replacement-floor");
        if (floor) viewer!.floorRepairs.attach(floor);
      })]);
      if (disposed) return;
      if (loaded.some(result => result.status === "rejected")) throw new Error("Room or resident unavailable");
      let walkingEnvironment = environment;
      for (const object of furniture) {
        const region = new THREE.Box3(new THREE.Vector3(...object.replacement.min), new THREE.Vector3(...object.replacement.max));
        viewer.world!.removeObjectRegion(region, object.position[1]);
        walkingEnvironment = rebuildReplacementNavigation(walkingEnvironment, viewer.world!.collider, region);
      }
      walkingEnvironment = { ...walkingEnvironment, objects: [...walkingEnvironment.objects, ...furniture.map(object => ({
        id: object.id, label: "Ottoman", kind: "obstruction" as const, x: object.position[0], z: object.position[2],
        width: object.size[0], depth: object.size[2], height: object.size[1],
      }))] };
      simulation = createWalkthroughSimulation(walkingEnvironment, furniture.map(object => object.hazard));
      viewer.activateWorldSimulation(simulation.environment);

    }
    movement = new MovementProgram(simulation, () => keyboard.clear());
    viewer.destinations.visible = false;
    viewer.marker.root.visible = false;
    if (connectedHouse) {
      const floorButton = document.querySelector<HTMLButtonElement>("#walk-floor")!;
      floorButton.disabled = false;
      floorButton.onclick = () => { keyboard.clear(); movement!.run([{ type: "floor", floor: simulation!.floorId === "ground" ? "upper" : "ground" }]); floorButton.blur(); };
      const stopButton = document.querySelector<HTMLButtonElement>("#stop-walk")!;
      stopButton.disabled = false; stopButton.onclick = () => { keyboard.clear(); movement!.cancel(); stopButton.blur(); };
      disposeClickWalking = attachClickWalking({
        viewer, program: () => movement!, enabled: () => ready,
        beforeRun: () => keyboard.clear(),
        onMessage: message => { document.querySelector<HTMLElement>("#movement-status")!.textContent = message; },
      });
    }
    ready = true;
    selectView("follow");
    for (const button of buttons) button.disabled = false;
    app.dataset.ready = "true";
    let previous = performance.now();
    let accumulator = 0;
    viewer.renderer.setAnimationLoop(now => {
      accumulator += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      while (accumulator >= 1 / 60) {
        const { forward, turn } = keyboard.sample();
        simulation!.drive(forward, turn, 1 / 60);
        simulation!.advance(1 / 60);
        movement!.advance();
        accumulator -= 1 / 60;
      }
      viewer!.update(simulation!);
      if (connectedHouse) {
        const floorButton = document.querySelector<HTMLButtonElement>("#walk-floor")!;
        floorButton.disabled = !!simulation!.floorJourney;
        floorButton.textContent = simulation!.floorId === "ground" ? "Walk upstairs" : "Walk downstairs";
        if (movement!.status === "blocked") document.querySelector<HTMLElement>("#movement-status")!.textContent = movement!.message;
      }
      fallDanger.update(simulation!.fall, simulation!.status);
    });
    // Inspection hook for integration tests and alternate hosts, without UI dependencies.
    Object.assign(window, { houseLab: { get simulation() { return simulation; }, get viewer() { return viewer; }, get movement() { return movement; } } });
  } catch {
    ready = false;
    nextViewer?.dispose();
    nextViewer?.renderer.domElement.remove();
    viewer = undefined;
    status.textContent = "The room could not load. Check your connection and try again.";
    retry.hidden = false;
  }
}
retry.onclick = () => void start();
void start();

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  ready = false;
  disposeClickWalking?.();
  keyboard.dispose();
  fallDanger.dispose();
  viewer?.renderer.setAnimationLoop(null);
  viewer?.dispose();
});
