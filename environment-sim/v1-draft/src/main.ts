import { visualConfig } from "./visualConfig";
import "./style.css";
import { destinations, type DestinationId, type Scenario, type FloorLevel } from "./environment";
import { Simulation } from "./simulation";
import { createHouseScene } from "./scene";
import { SUBJECTS } from "./robot/subjects";
import { FALL_SCENARIOS, type FallKind } from "./robot/fall";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header><a class="brand" href="./"><span class="brand-icon">⌂</span> HOUSE LAB <span class="divider"></span><span class="project-name">Tantau residence</span></a><span class="prototype"><i></i> INTERACTIVE PROTOTYPE</span></header>
  <main>
    <section class="viewport" aria-label="House simulation">
      <div id="scene"><div id="wide-view" class="camera-input" aria-label="Interactive character camera"></div></div>
      <div class="view-controls" aria-label="Camera mode"><button id="orbit" class="active">Wide view</button><button id="first-person" aria-keyshortcuts="v">First person</button><button id="third-person" aria-keyshortcuts="f">Third person</button><button id="top">Floor plan</button></div>
      <div id="camera-caption" class="camera-title"></div>
      <div class="scene-caption"><span><i class="legend-dot"></i> Resident & route</span><span><i class="legend-dot amber"></i> Scenario obstacle</span><small id="camera-hint">WASD / arrows move · 1–6 switch characters<br>Drag to orbit · Scroll to zoom</small></div>
      <div class="model-note">10536 S Tantau Ave, Cupertino<br><span id="floor-note">Approximate layout · Ground floor</span></div>
      <div id="hazard-popup" class="hazard-popup" role="alert" hidden>
        <div class="hazard-popup-top"><span id="hazard-severity" class="hazard-severity"></span><span id="hazard-room" class="hazard-room"></span><button id="hazard-dismiss" aria-label="Dismiss">✕</button></div>
        <strong id="hazard-object"></strong>
        <p id="hazard-reason"></p>
        <small>Hand-authored hazard zone for <span id="hazard-condition"></span> — not automatically detected.</small>
      </div>
    </section>
    <aside>
      <section class="control-section"><label class="speed-label" for="floor-level">Go to floor</label><select id="floor-level"><option value="ground">Ground floor</option><option value="upper">Second floor · 3 bedrooms</option></select><p id="floor-description" class="hint">Living spaces, kitchen, patio and attached ADU.</p></section>
      <section class="control-section"><h3><span>01</span> Choose a destination</h3><div class="destinations">${destinations.map((destination, index) => `<button data-destination="${destination.id}"><span class="destination-number">0${index + 1}</span><span><strong>${destination.label}</strong><small>${destination.description}</small></span><span class="arrow">↗</span></button>`).join("")}</div></section>
      <section class="control-section"><h3><span>02</span> Change the passage</h3><div class="segmented" aria-label="Passage scenario"><button data-scenario="clear" class="active" aria-pressed="true">Clear</button><button data-scenario="cart" aria-pressed="false">Add cart</button><button data-scenario="blocked" aria-pressed="false">Block route</button></div><p id="scenario-description" class="hint">A clear passage beside the kitchen island.</p></section>
      <section class="control-section resident-section"><h3><span>03</span> Observe the journey</h3><div class="resident-status"><div class="avatar">R</div><div><strong>Resident 01</strong><small id="status" role="status">Ready to explore</small></div><span id="status-dot" class="status-dot"></span></div><label class="speed-label" for="speed">Walking speed <output id="speed-value">0.9 m/s</output></label><input id="speed" type="range" min="0.4" max="1.6" step="0.1" value="0.9"><div class="metrics"><div><strong id="elapsed">00:00</strong><small>SIMULATION TIME</small></div><div><strong id="distance">0.0 <em>m</em></strong><small>DISTANCE WALKED</small></div></div><div class="playback"><button id="pause">Ⅱ Pause</button><button id="reset">↺ Reset resident</button></div></section>
      <section class="control-section"><label class="speed-label" for="subject">Character</label><select id="subject">${SUBJECTS.map(subject => `<option value="${subject.id}">${subject.label}</option>`).join("")}</select><p id="motion-note" class="hint"></p></section>
      <section class="control-section"><h3>Fall animations</h3><label class="speed-label" for="fall-animation">Scene</label><select id="fall-animation">${FALL_SCENARIOS.map(scene => `<option value="${scene.id}">${scene.label}</option>`).join("")}</select><label class="speed-label" for="animation-speed">Playback speed</label><select id="animation-speed"><option value="1">Normal</option><option value="0.5">Half speed</option><option value="0.25">Quarter speed</option></select><div class="playback"><button id="play-fall">▶ Play / replay fall</button></div><p id="fall-stage" class="hint" role="status">Watch the approach, fall, impact, and injured resting pose.</p><p id="fall-description" class="hint"></p><p class="hint">Authored movement demos. The grandma figurine tumbles as one piece; robots use articulated poses.</p><label class="figurine-label"><input id="patio-fall" type="checkbox"> Trigger patio fall while walking</label></section>
      <section class="event-section"><div class="event-title"><h3>Observations</h3><span>LIVE</span></div><ol id="events" aria-live="polite" aria-relevant="additions"></ol></section>
      <details><summary>About this experiment</summary><p>Floor-plan-inspired geometry with illustrative furniture. The resident is fictional; speed and clearance are explicit scenario settings, not inferred from age. Obstacles are manually placed. Events describe route availability, not fall risk.</p><p>Reset preserves the selected scenario and speed. Amber outlines show the 0.28 m clearance used by navigation.</p><label><input id="debug" type="checkbox"> Show navigation clearance</label><label><input id="labels" type="checkbox" checked> Show room labels</label><label><input id="hazard-props" type="checkbox" checked> Show hazard objects</label><button id="export-house">Download this floor’s 3D layout (.glb)</button><p id="export-status" class="hint">Geometry reference for World Labs Chisel or Blender.</p><a href="https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_42_1.jpg" target="_blank" rel="noreferrer">Source floor plan ↗</a></details>
    </aside>
  </main>
  <footer><span>HOUSE LAB / SPATIAL SCENARIOS</span><span>Authored geometry · Three.js · Local simulation</span></footer>`;
const simulation = new Simulation();
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
function requestDestination(id: DestinationId) {
  simulation.requestDestination(id);
  renderInterface();
}
let view: ReturnType<typeof createHouseScene>;
try {
  view = createHouseScene(element("scene"), requestDestination);
} catch (error) {
  element("scene").innerHTML =
    '<div class="render-error">This demo needs WebGL. Try a browser with hardware acceleration enabled.</div>';
  throw error;
}
void view.assets.apply(visualConfig).then(results => {
  for (const result of results) if (!result.ok) console.error(`[environment asset: ${result.id}]`, result.error);
});
element<HTMLButtonElement>("export-house").onclick = async () => {
  const button = element<HTMLButtonElement>("export-house");
  button.disabled = true;
  try {
    const { exportHouse } = await import("./exportHouse");
    await exportHouse(simulation.level);
    element("export-status").textContent = "Layout exported with full-height walls. Import the GLB into Chisel as a 3D reference.";
  } catch (error) {
    element("export-status").textContent = "Export failed. Please try again.";
    console.error("House export failed", error);
  } finally { button.disabled = false; }
};
const speedInput = element<HTMLInputElement>("speed");
speedInput.min = "0.1";
speedInput.step = "0.01";
let animationSpeed = 1;
element<HTMLSelectElement>("animation-speed").onchange = event => {
  animationSpeed = Number((event.target as HTMLSelectElement).value);
};
element<HTMLSelectElement>("fall-animation").onchange = () => renderInterface();
element<HTMLButtonElement>("play-fall").onclick = () => {
  const kind = element<HTMLSelectElement>("fall-animation").value as FallKind;
  if (simulation.playFall(kind) && view.cameraMode() === "wide") view.setCameraMode("third-person");
  renderInterface();
};
element<HTMLInputElement>("patio-fall").onchange = event =>
  simulation.setPatioFall((event.target as HTMLInputElement).checked);
void view.figurineReady.catch(error =>
  console.error("[figurine] load failed", error));
async function selectSubject(id: string) {
  try {
    const next = await view.setSubject(id);
    if (!next) return;
    simulation.setSubject(next);
    renderInterface();
  } catch (error) {
    element("motion-note").textContent = "Character could not load. Please try again.";
    console.error("[resident] load failed", error);
  }
}
element<HTMLSelectElement>("subject").onchange = event =>
  {
    const select = event.target as HTMLSelectElement;
    void selectSubject(select.value);
    select.blur();
  };
document.querySelector(".destinations")!.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-destination]");
  if (button) requestDestination(button.dataset.destination as DestinationId);
});
element<HTMLSelectElement>("floor-level").onchange = event => {
  const select = event.target as HTMLSelectElement;
  if (simulation.requestFloor(select.value as FloorLevel) && view.cameraMode() === "wide") view.setCameraMode("third-person");
  select.blur();
  pressed.clear();
  renderInterface();
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-scenario]",
))
  button.onclick = () => {
    simulation.setScenario(button.dataset.scenario as Scenario);
    renderInterface();
  };
element<HTMLButtonElement>("pause").onclick = () => {
  simulation.paused = !simulation.paused;
  renderInterface();
};
element<HTMLButtonElement>("reset").onclick = () => {
  simulation.reset();
  renderInterface();
};
element<HTMLButtonElement>("hazard-dismiss").onclick = () => {
  simulation.dismissHazard();
  renderHazardPopup();
};
element<HTMLInputElement>("speed").oninput = (event) => {
  simulation.speed = Number((event.target as HTMLInputElement).value);
  element("speed-value").textContent = `${simulation.speed.toFixed(2)} m/s`;
};
for (const id of ["orbit", "top", "first-person", "third-person"])
  element<HTMLButtonElement>(id).onclick = () => {
    if (id === "first-person" || id === "third-person") view.setCameraMode(id);
    else view.setView(id === "top");
    renderInterface();
  };
element<HTMLInputElement>("debug").onchange = (event) =>
  view.setDebug((event.target as HTMLInputElement).checked);
element<HTMLInputElement>("labels").onchange = (event) =>
  view.setLabels((event.target as HTMLInputElement).checked);
element<HTMLInputElement>("hazard-props").onchange = (event) =>
  view.setHazardProps((event.target as HTMLInputElement).checked);
const timestamp = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
let shownHazard: unknown = null;
function renderHazardPopup() {
  const current = simulation.pendingHazard;
  if (current === shownHazard) return;
  shownHazard = current;
  const popup = element("hazard-popup");
  if (!current) {
    popup.hidden = true;
    return;
  }
  popup.hidden = false;
  popup.className = `hazard-popup sev-${current.severity}`;
  const severity = element("hazard-severity");
  severity.textContent = current.severity;
  severity.className = `hazard-severity sev-${current.severity}`;
  element("hazard-room").textContent = current.zone.room;
  element("hazard-object").textContent = current.hazard.object;
  element("hazard-reason").textContent = current.reason;
  element("hazard-condition").textContent =
    current.condition === "elderly" ? "older adults" : "toddlers";
}
let lastEvents: unknown = null;
let lastFloor: FloorLevel | null = null;
function renderInterface() {
  renderHazardPopup();
  const upstairs = simulation.level === "upper";
  element<HTMLSelectElement>("floor-level").value = simulation.stairTarget ?? simulation.level;
  element<HTMLSelectElement>("floor-level").disabled = simulation.changingFloor;
  if (lastFloor !== simulation.level) {
    lastFloor = simulation.level;
    document.querySelector(".destinations")!.innerHTML = simulation.availableDestinations.map((destination, index) =>
      `<button data-destination="${destination.id}"><span class="destination-number">0${index + 1}</span><span><strong>${destination.label}</strong><small>${destination.description}</small></span><span class="arrow">↗</span></button>`).join("");
  }
  element("floor-note").textContent = `Approximate layout · ${upstairs ? "Second floor" : "Ground floor"}`;
  element("floor-description").textContent = upstairs
    ? "Recreated from your plan · 780 sq ft as labeled. Choose Ground floor to walk down the stairs."
    : "Choose Second floor to walk to the stairs and climb upstairs.";
  if (simulation.changingFloor) element("floor-description").textContent = simulation.manualStairs ? "Hold W / ↑ to move along the stairs; release to stop. V / F changes camera. Reset cancels." : simulation.onStairs ? "Walking on the staircase. V / F changes camera; pause freezes the climb." : "Walking to the staircase.";
  element<HTMLInputElement>("patio-fall").disabled = upstairs || simulation.changingFloor;
  element<HTMLInputElement>("patio-fall").checked = simulation.patioFallEnabled;
  element("fall-description").textContent = FALL_SCENARIOS.find(scene => scene.id === element<HTMLSelectElement>("fall-animation").value)?.description ?? "";
  const cameraMode = view.cameraMode();
  element("scene").dataset.cameraMode = cameraMode;
  for (const id of ["orbit", "top", "first-person", "third-person"]) {
    const active = id === "top" ? cameraMode === "wide" && view.isTopView()
      : id === "orbit" ? cameraMode === "wide" && !view.isTopView() : cameraMode === id;
    element(id).classList.toggle("active", active);
    element(id).setAttribute("aria-pressed", String(active));
  }
  element("camera-caption").textContent = cameraMode === "wide" ? (view.isTopView() ? "Floor plan" : "Wide view")
    : `${cameraMode === "first-person" ? "First person" : "Third person"} · ${simulation.subject.label}`;
  element("camera-hint").textContent = cameraMode === "wide"
    ? "WASD / arrows move · 1–6 switch · Drag to orbit · Scroll to zoom"
    : "WASD / arrows move · Face stairs and hold W / ↑ to climb · V first person · F third person";
  speedInput.value = String(simulation.speed);
  element("speed-value").textContent = `${simulation.speed.toFixed(2)} m/s`;
  element<HTMLSelectElement>("subject").value = simulation.subject.id;
  element("motion-note").textContent = simulation.subject.locomotion === "rigid"
    ? "Controlling your grandma figurine. Arrows or WASD move and turn; choose a camera mode above the scene."
    : `${simulation.subject.motion.strideLength.toFixed(2)} m per gait cycle · Tunable movement preset. Keys 1–6 switch characters; arrows or WASD steer.`;
  element<HTMLButtonElement>("play-fall").disabled = simulation.changingFloor || upstairs || simulation.subject.locomotion === "quadruped";
  element("fall-stage").textContent = upstairs ? "Fall animation sets are available on the ground floor." : simulation.subject.locomotion === "quadruped"
    ? "Select a walking robot or the grandma figurine to play these animations."
    : simulation.isFalling ? simulation.fallStage
    : "Watch the approach, fall, impact, and injured resting pose.";
  const target = simulation.availableDestinations
    .find((destination) => destination.id === simulation.destination)
    ?.label.toLowerCase();
  element("status").textContent = simulation.paused
    ? "Paused"
    : {
        idle: "Ready to explore",
        walking: simulation.changingFloor ? (simulation.onStairs ? (simulation.stairTarget === "upper" ? "Climbing upstairs" : "Walking downstairs") : "Walking to stairs") : simulation.manual ? "Manual movement" : `Walking to ${target}`,
        arrived: `Arrived · ${target}`,
        blocked: "Route blocked",
        falling: simulation.fallStage,
        fallen: simulation.subject.locomotion === "rigid" ? "Grandma down · Replay or reset" : "Robot down · Reset to stand up",
      }[simulation.status];
  element("status-dot").className = `status-dot ${simulation.status}`;
  element("elapsed").textContent = timestamp(simulation.time);
  element("distance").innerHTML =
    `${simulation.distance.toFixed(1)} <em>m</em>`;
  element("pause").textContent = simulation.paused ? "▶ Resume" : "Ⅱ Pause";
  element("scenario-description").textContent = upstairs ? "Passage scenarios are available on the ground floor." : {
    clear: "A clear passage beside the kitchen island.",
    cart: "The cart narrows one side. Look for a detour around the island.",
    blocked: "The barrier spans the room. Crossing requires removing it.",
  }[simulation.scenario];
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-scenario]",
  )) {
    button.disabled = upstairs || simulation.changingFloor;
    const active = button.dataset.scenario === simulation.scenario;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-destination]",
  )) {
    button.disabled = simulation.changingFloor;
    const active = button.dataset.destination === simulation.destination;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (lastEvents !== simulation.events) {
    lastEvents = simulation.events;
    element("events").replaceChildren(
      ...simulation.events.slice(0, 5).map((event) => {
        const item = document.createElement("li");
        item.className =
          event.type === "routeBlocked" || event.type === "changeRejected"
            ? "warning"
            : "";
        const time = document.createElement("time");
        time.textContent = timestamp(event.time);
        const message = document.createElement("span");
        message.textContent = event.message;
        item.append(time, message);
        item.title = `${event.type} · ${event.ids.join(", ")}`;
        return item;
      }),
    );
  }
}
let previous = performance.now(),
  accumulator = 0,
  lastInterface = 0;
const fixedStep = 1 / 60;
// Arrow keys steer the resident. Held keys are sampled inside the fixed step so
// manual movement advances at the same rate as the simulation, not the display.
const pressed = new Set<string>();
const DRIVE_KEYS = new Set([
  "arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d",
]);

// Subject swap (1-6), follow camera (F), zoom (+/-).
const SUBJECT_KEYS = ["1", "2", "3", "4", "5", "6"];
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  const slot = SUBJECT_KEYS.indexOf(key);
  if (slot >= 0 && slot < view.subjects.length) {
    const next = view.subjects[slot];
    void selectSubject(next.id);
  }
  if (key === "v") view.setCameraMode("first-person");
  if (key === "f") view.setCameraMode("third-person");
  if (key === "escape") view.setView(false);
  if (["v", "f", "escape"].includes(key)) renderInterface();
  if (key === "+" || key === "=") view.zoomFollow(-0.5);
  if (key === "-" || key === "_") view.zoomFollow(0.5);
});
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (!DRIVE_KEYS.has(key)) return;
  event.preventDefault();
  pressed.add(key);
  if (!simulation.manual) simulation.setManual(true);
});
window.addEventListener("keyup", (event) => pressed.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => pressed.clear());

const down = (...keys: string[]) => keys.some((key) => pressed.has(key));

function frame(now: number) {
  accumulator += Math.min((now - previous) / 1000, 0.1);
  previous = now;
  while (accumulator >= fixedStep) {
    simulation.setStairInput(down("arrowup", "w") ? 1 : 0);
    if (simulation.manual) {
      simulation.drive(
        (down("arrowup", "w") ? 1 : 0) - (down("arrowdown", "s") ? 1 : 0),
        (down("arrowleft", "a") ? 1 : 0) - (down("arrowright", "d") ? 1 : 0),
        fixedStep,
      );
    }
    simulation.advance(fixedStep * (simulation.isFalling ? animationSpeed : 1));
    accumulator -= fixedStep;
  }
  view.update(simulation);
  if (now - lastInterface > 100) {
    renderInterface();
    lastInterface = now;
  }
  requestAnimationFrame(frame);
}
renderInterface();
requestAnimationFrame(frame);
