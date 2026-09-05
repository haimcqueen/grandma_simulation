import { tantauFixture, sampleWorld } from "./environment";
import type { Scenario, WorldAsset, Environment } from "./contracts";
import { parseWorldAsset } from "./asset-manifest";
import { Simulation } from "./simulation";
import { Viewer } from "./viewer";
import { loadSimulationEnvironment } from "./simulation-environment";
import { WalkingRoutine } from "./walking-routine";
import { postures, type Posture } from "./posture";
import { LIVERIES } from "../../v1-draft/src/robot/livery";
import { roomFalls, roomFallFrame, type RoomFallKind } from "./falls";
import { createKeyboardControls } from "./keyboard-controls";
import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<header><a class="wordmark" href="/">HOUSE<span>LAB</span><i>02</i></a><div class="address">10536 S Tantau Avenue <span>Cupertino, California</span></div><a class="mint-link" href="https://mint.gg/chat/ph76aa258at54gvzs8ytwm5je18dtcpx" target="_blank" rel="noreferrer">World source ↗</a></header>
<main><section id="viewport"><div class="scene-heading"><div class="eyebrow" id="scene-label">GROUND FLOOR / INTERACTIVE STUDY</div><h1 id="scene-title">A little room<br>to move.</h1><p id="provenance">Authored approximation · listing-inspired materials</p></div>
<div class="view-controls" aria-label="Camera views"><button data-view="overview" class="active">Overview</button><button data-view="interior">Inside</button><button data-view="follow">Third person</button><button data-view="first">First person</button><button data-view="top">Top down</button><button data-view="side">Side</button><button data-view="map">Map</button></div>
<div id="cutaway-controls" hidden><label><input type="checkbox" id="cutaway-enabled" checked> Reveal interior</label><label>Wall height <input id="cutaway-height" type="range" min="0.6" max="3.3" step="0.1" value="1.8"><output id="cutaway-value">1.8 m</output></label></div><div id="map-legend" hidden>Navigation map · green: walkable · rings: destinations<br>Blank areas: blocked or unverified · dimensions estimated</div><div id="notice" role="status" hidden></div><div class="scene-footer"><span id="scene-hint">Drag to orbit · Scroll to zoom</span><label><input type="checkbox" id="debug"> Show geometry</label></div></section>
<aside><div class="eyebrow">SCENARIO STUDIO</div><h2>Everyday journeys.</h2><p class="intro">Explore how a small change in a room changes the way through it.</p>
<label class="field-label" for="environment">Environment</label><select id="environment"><option value="fixture">V1-style · authored fixture</option><option value="sample">World Labs · sample inspection</option></select>
<p class="source-note" id="environment-note">Estimated layout, inspired by the listing. The realistic room is available in the environment selector.</p>
<div id="simulation-controls"><button id="routine" class="routine-button">▶ Walk around</button><section class="control-section"><div class="section-number">01 <span>Choose a destination</span></div><div class="destinations">${tantauFixture.destinations.map((target, index) => `<button data-destination="${target.id}"><span>0${index + 1}</span>${target.label}<b>↗</b></button>`).join("")}</div></section>
<section class="control-section"><div class="section-number">02 <span>Change the passage</span></div><div class="segmented"><button data-scenario="clear">Clear</button><button data-scenario="cart">Add cart</button><button data-scenario="blocked">Block</button></div><p id="scenario-description" class="source-note"></p></section>
<section class="resident-card"><div class="resident-avatar">R</div><div><strong id="resident-name">Unitree G1</strong><small id="resident-model" role="status">Loading robot…</small></div><span class="status-dot"></span></section>
<label class="field-label" for="posture">Unitree body & movement</label><select id="posture">${Object.entries(postures).map(([id, preset]) => `<option value="${id}">${preset.label}</option>`).join("")}</select><p class="source-note">Authored movement presets, not a medical model or a rule about older adults.</p>
<label class="speed-label" for="hunch">Posture intensity <output id="hunch-value">100%</output></label><input id="hunch" type="range" min="0" max="1" step="0.1" value="1"><label class="field-label" for="skin">Robot appearance</label><select id="skin">${LIVERIES.map(skin => `<option value="${skin.id}">${skin.label}</option>`).join("")}</select><p class="source-note">1–5: body presets · [ / ]: posture · K: appearance</p>
<label class="speed-label" for="speed">Walking speed <output id="speed-value">0.77 m/s</output></label><input id="speed" type="range" min="0.2" max="1.6" step="0.01" value="0.77"><p class="source-note" id="keyboard-help">W / ↑ forward · S / ↓ backward · A/D or ←/→ turn. Keyboard takes over the walking routine. Release to stop; choose a destination to resume routes. F: first person · V: third person.</p>
<section class="control-section"><div class="section-number">03 <span>Fall animations</span></div><label class="field-label" for="fall-kind">Situation</label><select id="fall-kind">${roomFalls.map(fall => `<option value="${fall.id}">${fall.label}</option>`).join("")}</select><p class="source-note" id="fall-description"></p><button id="play-fall" class="routine-button">▶ Play fall</button><p class="source-note">Authored movement at the resident's position. Reset to walk again.</p><p class="source-note">Stairs and upstairs are not yet reconstructed in this room.</p></section>
<div class="metrics"><div><small>SIMULATION TIME</small><strong id="elapsed">00:00</strong></div><div><small>DISTANCE WALKED</small><strong id="distance">0.0 <em>m</em></strong></div></div>
<label class="field-label" for="playback-speed">Playback speed</label><select id="playback-speed"><option value="1">Normal</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select><div class="playback"><button id="pause">Ⅱ Pause</button><button id="reset">↺ Reset</button></div><p id="status" role="status"></p></div>
<div id="inspection-controls" hidden><h3>Inspect before enabling routes</h3><p class="source-note">This official sample is not the listing house. Click a surface to place a reference resident. Placement is not a walkability test; scale is unverified.</p><label><input type="checkbox" id="depth" checked> Occlude marker behind geometry</label><p id="surface" class="source-note"></p><a href="/probe.html">Open detailed alignment probe ↗</a></div>
<p class="source-note"><a href="/environment.html">Inspect room & export anchors ↗</a></p><section class="observations"><div class="section-number">OBSERVATIONS <button id="export">Export ↓</button></div><ol id="events"></ol></section><footer>Known-condition simulation. Observations describe this model, not real-world fall risk.</footer>
</aside></main>`;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const configuredManifest = import.meta.env.VITE_WORLD_MANIFEST_URL || "/environment/tantau.json";
if (configuredManifest) {
  const option = document.createElement("option");
  option.value = "generated";
  option.textContent = "Tantau · realistic simulation";
  element("environment").append(option);
}
let simulation = new Simulation(tantauFixture);
let routine = new WalkingRoutine(simulation);
let loading = false;
let residentLoading = false;
const keyboard = createKeyboardControls(window, {
  canDrive: () => !loading && !residentLoading && !simulation.paused && !simulation.fall && viewer.mode !== "world",
  onClear: () => simulation.stopManualMotion(),
  onDriveStart: () => {
    routine.stop();
    if (!simulation.manual && viewer.view !== "first") viewer.setView("follow");
    simulation.setManual();
  },
  onShortcut: event => {
    if (loading || residentLoading || viewer.mode === "world") return false;
    if (event.code === "KeyF" || event.code === "KeyV") {
      viewer.setView(event.code === "KeyF" ? "first" : "follow");
      renderUI();
      return true;
    }
    if (simulation.fall) return false;
    const presets: Record<string, Posture> = { Digit1: "grandma", Digit2: "adult", Digit3: "baby", Digit4: "toddler", Digit5: "dog" };
    if (presets[event.code]) { void selectPosture(presets[event.code]); return true; }
    if (event.code === "BracketLeft" || event.code === "BracketRight") {
      simulation.hunch = Math.max(0, Math.min(1, simulation.hunch + (event.code === "BracketRight" ? 0.1 : -0.1)));
      return true;
    }
    if (event.code === "KeyK") {
      simulation.skin = LIVERIES[(LIVERIES.findIndex(skin => skin.id === simulation.skin) + 1) % LIVERIES.length].id;
      return true;
    }
    return false;
  },
});
const clearKeys = () => keyboard.clear();
const viewer = new Viewer(element("viewport"), tantauFixture);
void viewer.loadRobot().then(() => {
  if (viewer.animatedResident && "robot" in viewer.animatedResident)
    element("resident-model").textContent = "Articulated robot · distance-driven gait";
}).catch(() => {
  element("resident-name").textContent = "Placeholder resident";
  element("resident-model").textContent = "Robot failed to load. Reload to retry.";
});
const notice = (message: string) => {
  element("notice").textContent = message;
  element("notice").hidden = !message;
};
viewer.onSurface = (point) => {
  element("surface").textContent = `Reference base: ${point
    .toArray()
    .map((value) => value.toFixed(2))
    .join(", ")} source units. Verify a floor before using this as an anchor.`;
};
document
  .querySelectorAll<HTMLButtonElement>("[data-destination]")
  .forEach(
    (button) =>
      (button.onclick = () =>
        requestDestination(button.dataset.destination!)),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-scenario]")
  .forEach(
    (button) =>
      (button.onclick = () =>
        simulation.setScenario(button.dataset.scenario as Scenario)),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach(
    (button) =>
      (button.onclick = () =>
        viewer.setView(button.dataset.view as Viewer["view"])),
  );
element("play-fall").onclick = () => {
  clearKeys();
  routine.stop();
  simulation.playFall(element<HTMLSelectElement>("fall-kind").value as RoomFallKind);
  viewer.setView("follow");
};
element("pause").onclick = () => {
  clearKeys();
  simulation.paused = !simulation.paused;
};
element("reset").onclick = () => {
  clearKeys();
  routine.stop();
  simulation.reset();
  notice("");
};
element<HTMLInputElement>("speed").oninput = (event) => {
  simulation.profile.speed = Number((event.target as HTMLInputElement).value);
};
async function selectPosture(posture: Posture) {
  if (residentLoading || simulation.fall || loading) return;
  clearKeys();
  residentLoading = true;
  const previous = simulation.posture;
  const wasPaused = simulation.paused;
  simulation.paused = true;
  element("simulation-controls").inert = true;
  try {
    const current = viewer.animatedResident;
    const preset = postures[posture];
    if (!current || !("robot" in current) || current.metadata.asset !== preset.asset || current.metadata.maxHeight !== preset.maxHeight)
      await viewer.loadRobot(posture);
    simulation.setPosture(posture);
    element("resident-name").textContent = viewer.animatedResident && "robot" in viewer.animatedResident ? viewer.animatedResident.metadata.model : "Unitree";
    element("resident-model").textContent = preset.crawl ? "Articulated quadruped · distance-driven gait" : "Articulated robot · distance-driven gait";
    notice("");
  } catch (error) {
    simulation.setPosture(previous);
    notice(`Could not load this body. ${String(error)}`);
  } finally {
    simulation.paused = wasPaused;
    residentLoading = false;
    element("simulation-controls").inert = false;
    renderUI();
  }
}
element<HTMLSelectElement>("posture").onchange = event => {
  const select = event.target as HTMLSelectElement;
  void selectPosture(select.value as Posture);
  select.blur();
};
element<HTMLInputElement>("hunch").oninput = event => { simulation.hunch = Number((event.target as HTMLInputElement).value); };
element<HTMLSelectElement>("skin").onchange = event => {
  simulation.skin = (event.target as HTMLSelectElement).value;
  (event.target as HTMLSelectElement).blur();
};
element<HTMLSelectElement>("playback-speed").onchange = event => {
  simulation.playbackSpeed = Number((event.target as HTMLSelectElement).value);
  (event.target as HTMLSelectElement).blur();
};
element<HTMLInputElement>("debug").onchange = (event) => {
  viewer.debugVisible = (event.target as HTMLInputElement).checked;
};
element<HTMLInputElement>("cutaway-enabled").onchange = (event) => {
  viewer.cutawayEnabled = (event.target as HTMLInputElement).checked;
};
element<HTMLInputElement>("cutaway-height").oninput = (event) => {
  viewer.cutawayHeight = Number((event.target as HTMLInputElement).value);
};
element<HTMLInputElement>("depth").onchange = (event) => {
  viewer.worldDepth = (event.target as HTMLInputElement).checked;
};
function requestDestination(id: string) {
  clearKeys();
  routine.stop();
  simulation.requestDestination(id);
}
element("routine").onclick = () => {
  clearKeys();
  if (routine.active) routine.stop();
  else routine.start();
};
function replaceSimulation(environment: Environment) {
  const next = new Simulation(environment);
  next.setPosture(simulation.posture);
  next.profile.speed = simulation.profile.speed;
  next.hunch = simulation.hunch;
  next.skin = simulation.skin;
  next.playbackSpeed = simulation.playbackSpeed;
  simulation = next;
  routine = new WalkingRoutine(simulation);
}
let switchRevision = 0;
async function selectEnvironment(value: string) {
  clearKeys();
  const revision = ++switchRevision;
  routine.stop();
  loading = value !== "fixture";
  element("simulation-controls").inert = loading;
  if (value === "fixture") {
    replaceSimulation(tantauFixture);
    viewer.environment = tantauFixture;
    viewer.showFixture();
    refreshDestinations();
    notice("");
    updateEnvironmentUI();
    return;
  }
  simulation.paused = true;
  notice("Loading the room and walking routes…");
  try {
    let asset: WorldAsset = sampleWorld;
    let bundle:
      | {
          environment?: Environment;
          resident?: import("./animated-resident").ResidentAssets;
        }
      | undefined;
    if (value === "generated") {
      if (!configuredManifest)
        throw new Error("No generated world manifest is configured.");
      const response = await fetch(configuredManifest);
      if (!response.ok)
        throw new Error("Generated environment manifest is unavailable.");
      const data = await response.json();
      bundle = data;
      asset = parseWorldAsset(data.world ?? data);
      if (!bundle?.environment && asset.id === "tantau-great-room") {
        bundle = { ...bundle, environment: await loadSimulationEnvironment("/environment/tantau-simulation.json") };
      }
    }
    if (revision !== switchRevision) return;
    const loaded = await viewer.showWorld(asset);
    if (revision !== switchRevision || !loaded) return;
    if (bundle?.environment) {
      replaceSimulation(bundle.environment);
      viewer.activateWorldSimulation(bundle.environment);
      refreshDestinations();
      if (bundle.resident) {
        try {
          await viewer.loadResident(bundle.resident);
          element("resident-name").textContent = "Custom resident";
          element("resident-model").textContent = "Manifest model · animated rig";
          notice("");
        }
        catch (error) { notice(`Room ready; retaining current resident. ${String(error)}`); }
      }
      if (revision !== switchRevision) return;
      routine.start();
    }
    if (!bundle?.resident) notice("");
    updateEnvironmentUI(asset);
  } catch (error) {
    if (revision !== switchRevision) return;
    replaceSimulation(tantauFixture);
    viewer.environment = tantauFixture;
    viewer.showFixture();
    refreshDestinations();
    element<HTMLSelectElement>("environment").value = "fixture";
    updateEnvironmentUI();
    notice(
      `${error instanceof Error ? error.message : String(error)} The authored fixture is available; select the room again to retry.`,
    );
  } finally {
    if (revision === switchRevision) { loading = false; element("simulation-controls").inert = false; }
  }
}
element<HTMLSelectElement>("environment").onchange = (event) =>
  void selectEnvironment((event.target as HTMLSelectElement).value);
function refreshDestinations() {
  const container = document.querySelector(".destinations")!;
  container.replaceChildren(
    ...simulation.environment.destinations.map((target, index) => {
      const button = document.createElement("button");
      button.dataset.destination = target.id;
      const ordinal = document.createElement("span");
      ordinal.textContent = String(index + 1).padStart(2, "0");
      button.append(ordinal, document.createTextNode(target.label));
      button.onclick = () => requestDestination(target.id);
      return button;
    }),
  );
}
function updateEnvironmentUI(asset?: WorldAsset) {
  const inspection = viewer.mode === "world";
  for (const view of ["top", "side", "map"]) document.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)!.disabled = inspection;
  const realistic = viewer.mode === "world-simulation";
  element("viewport").classList.toggle("inspection", inspection || realistic);
  element("simulation-controls").hidden = inspection;
  element("inspection-controls").hidden = !inspection;
  element("scene-label").textContent = inspection
    ? "ENVIRONMENT / ALIGNMENT INSPECTION"
    : realistic
      ? "TANTAU / PHOTO-GUIDED ENVIRONMENT"
      : "GROUND FLOOR / INTERACTIVE STUDY";
  element("scene-title").innerHTML = inspection
    ? "Inside the<br>environment."
    : realistic
      ? "Life at home."
      : "A little room<br>to move.";
  element("provenance").textContent =
    inspection || realistic ? asset!.source : tantauFixture.provenance;
  element("environment-note").textContent = inspection
    ? "Appearance and collider inspection. Movement remains in the authored fixture until spatial calibration is checked."
    : realistic
      ? simulation.environment.provenance
      : "Authored integration fixture for comparison. Select Tantau for the realistic room.";
  element("scene-hint").textContent = inspection
    ? "Drag to look · Click a surface to place reference"
    : "Drag to orbit · Scroll to zoom";
  document.querySelectorAll<HTMLButtonElement>('[data-view="follow"],[data-view="first"]').forEach(button => button.disabled = inspection);
}
const timestamp = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
let lastEvents: unknown;
function renderUI() {
  const canFall = !residentLoading && !postures[simulation.posture].crawl && !!viewer.animatedResident && "setFall" in viewer.animatedResident;
  element<HTMLButtonElement>("play-fall").disabled = !canFall;
  element("play-fall").textContent = simulation.fall ? "↺ Replay fall" : "▶ Play fall";
  element("fall-description").textContent = canFall
    ? roomFalls.find(fall => fall.id === element<HTMLSelectElement>("fall-kind").value)!.description
    : postures[simulation.posture].crawl ? "Select a G1 or H1 body for these biped fall animations." : "Fall animations need the articulated robot to finish loading.";
  element<HTMLButtonElement>("routine").disabled = !!simulation.fall;
  document.querySelectorAll<HTMLButtonElement>("[data-destination],[data-scenario]").forEach(button => button.disabled = !!simulation.fall);
  element<HTMLSelectElement>("posture").disabled = !!simulation.fall || residentLoading;
  element<HTMLInputElement>("hunch").disabled = !!postures[simulation.posture].crawl || !!simulation.fall;
  element<HTMLInputElement>("hunch").value = String(simulation.hunch);
  element("hunch-value").textContent = `${Math.round(simulation.hunch * 100)}%`;
  element<HTMLSelectElement>("skin").value = simulation.skin;
  element<HTMLSelectElement>("playback-speed").value = String(simulation.playbackSpeed);
  element<HTMLSelectElement>("posture").value = simulation.posture;
  element<HTMLInputElement>("speed").value = String(simulation.profile.speed);
  const top = viewer.view === "map";
  const cutaway = viewer.mode === "world-simulation" && ["top", "side", "overview"].includes(viewer.view);
  element("cutaway-controls").hidden = !cutaway;
  element("cutaway-value").textContent = `${viewer.cutawayHeight.toFixed(1)} m`;
  element("viewport").classList.toggle("cutaway-view", cutaway);
  element("map-legend").hidden = !top;
  element("viewport").classList.toggle("top-view", top);
  element("scene-hint").textContent = top ? "Drag to pan · Scroll to zoom" : viewer.mode === "world" ? "Drag to look · Click a surface to place reference" : "Drag to orbit · Scroll to zoom";
  element("routine").textContent = routine.active ? "■ Stop walking routine" : "▶ Walk around";
  element("routine").setAttribute("aria-pressed", String(routine.active));
  element("elapsed").textContent = timestamp(simulation.time);
  element("distance").innerHTML =
    `${simulation.distance.toFixed(1)} <em>m</em>`;
  element("speed-value").textContent =
    `${simulation.profile.speed.toFixed(2)} m/s`;
  element("pause").textContent = simulation.paused ? "▶ Resume" : "Ⅱ Pause";
  element("status").textContent = simulation.paused
    ? "Paused"
    : {
        idle: simulation.manual ? "Keyboard control · W/S move, A/D turn" : "Ready for a journey",
        walking: simulation.manual ? "Keyboard movement" : "Following the clear route",
        arrived: "Destination reached",
        blocked: "No clear route — remove the obstruction",
        falling: simulation.fall ? roomFallFrame(simulation.fall).stage : "Falling",
        fallen: "Fall complete · Replay or reset to walk again",
      }[simulation.status];
  element("scenario-description").textContent = {
    clear: "The passage beside the island is open.",
    cart: "A separate storage cart narrows the passage. Watch the route change.",
    blocked:
      "A barrier spans the room. The resident stops until the route reopens.",
  }[simulation.scenario];
  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-scenario],[data-destination],[data-view]",
    )
    .forEach((button) => {
      const active =
        button.dataset.scenario === simulation.scenario ||
        button.dataset.destination === simulation.destination ||
        button.dataset.view === viewer.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  if (lastEvents !== simulation.events) {
    lastEvents = simulation.events;
    element("events").replaceChildren(
      ...simulation.events.slice(0, 5).map((event) => {
        const item = document.createElement("li"),
          time = document.createElement("time"),
          message = document.createElement("span");
        time.textContent = timestamp(event.time);
        message.textContent = event.message;
        item.append(time, message);
        item.title = `${event.type} · ${event.ids.join(", ")} · revision ${event.revision}`;
        if (event.type === "routeBlocked" || event.type === "changeRejected")
          item.className = "warning";
        return item;
      }),
    );
  }
}
element("export").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: 2,
          assumptions: simulation.environment.provenance,
          environment: simulation.environment,
          world: viewer.asset,
          snapshot: simulation.snapshot(),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "house-lab-scenario.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let previous = performance.now(),
  accumulator = 0,
  lastUI = 0;
viewer.renderer.setAnimationLoop((now) => {
  accumulator += Math.min((now - previous) / 1000, 0.1);
  previous = now;
  while (accumulator >= 1 / 60) {
    if (!loading && !residentLoading && viewer.mode !== "world") {
      const { forward, turn } = keyboard.sample();
      simulation.drive(forward, turn, 1 / 60);
      simulation.advance(1 / 60);
      routine.advance();
    }
    accumulator -= 1 / 60;
  }
  viewer.update(simulation);
  if (now - lastUI > 100) {
    renderUI();
    lastUI = now;
  }
});
renderUI();
if (
  configuredManifest &&
  !new URLSearchParams(location.search).has("fixture")
) {
  element<HTMLSelectElement>("environment").value = "generated";
  void selectEnvironment("generated");
}
Object.assign(window, {
  houseLab: {
    get simulation() {
      return simulation;
    },
    viewer,
    get routine() { return routine; },
    selectEnvironment,
  },
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    keyboard.dispose();
    viewer.renderer.setAnimationLoop(null);
    viewer.dispose();
  });
