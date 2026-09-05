import "./style.css";
import { destinations, type DestinationId, type Scenario } from "./environment";
import { Simulation } from "./simulation";
import { createHouseScene } from "./scene";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header><a class="brand" href="./"><span class="brand-icon">⌂</span> HOUSE LAB <span class="divider"></span><span class="project-name">Tantau residence</span></a><span class="prototype"><i></i> INTERACTIVE PROTOTYPE</span></header>
  <main>
    <section class="viewport" aria-label="House simulation">
      <div id="scene"></div>
      <div class="scene-heading"><div class="eyebrow">01 / GROUND FLOOR</div><h1>A little change.<br>A different journey.</h1><p>Explore how a room changes the way we move.</p></div>
      <div class="view-controls"><button id="orbit" class="active">Perspective</button><button id="top">Floor plan</button></div>
      <div class="scene-caption"><span><i class="legend-dot"></i> Resident & route</span><span><i class="legend-dot amber"></i> Scenario obstacle</span><small>Drag to orbit · Scroll to zoom · Click a destination ring</small></div>
      <div class="model-note">10536 S Tantau Ave, Cupertino<br><span>Approximate layout · Ground floor only</span></div>
    </section>
    <aside>
      <div class="panel-heading"><span class="eyebrow">THE EXPERIMENT</span><span class="step-count">01 — 03</span></div>
      <h2>Make room to move.</h2><p class="intro">Choose a destination, change the passage, and watch the resident respond.</p>
      <section class="control-section"><h3><span>01</span> Choose a destination</h3><div class="destinations">${destinations.map((destination, index) => `<button data-destination="${destination.id}"><span class="destination-number">0${index + 1}</span><span><strong>${destination.label}</strong><small>${destination.description}</small></span><span class="arrow">↗</span></button>`).join("")}</div></section>
      <section class="control-section"><h3><span>02</span> Change the passage</h3><div class="segmented" aria-label="Passage scenario"><button data-scenario="clear" class="active" aria-pressed="true">Clear</button><button data-scenario="cart" aria-pressed="false">Add cart</button><button data-scenario="blocked" aria-pressed="false">Block route</button></div><p id="scenario-description" class="hint">A clear passage beside the kitchen island.</p></section>
      <section class="control-section resident-section"><h3><span>03</span> Observe the journey</h3><div class="resident-status"><div class="avatar">R</div><div><strong>Resident 01</strong><small id="status" role="status">Ready to explore</small></div><span id="status-dot" class="status-dot"></span></div><label class="speed-label" for="speed">Walking speed <output id="speed-value">0.9 m/s</output></label><input id="speed" type="range" min="0.4" max="1.6" step="0.1" value="0.9"><div class="metrics"><div><strong id="elapsed">00:00</strong><small>SIMULATION TIME</small></div><div><strong id="distance">0.0 <em>m</em></strong><small>DISTANCE WALKED</small></div></div><div class="playback"><button id="pause">Ⅱ Pause</button><button id="reset">↺ Reset resident</button></div></section>
      <section class="event-section"><div class="event-title"><h3>Observations</h3><span>LIVE</span></div><ol id="events" aria-live="polite" aria-relevant="additions"></ol></section>
      <details><summary>About this experiment</summary><p>Floor-plan-inspired geometry with illustrative furniture. The resident is fictional; speed and clearance are explicit scenario settings, not inferred from age. Obstacles are manually placed. Events describe route availability, not fall risk.</p><p>Reset preserves the selected scenario and speed. Amber outlines show the 0.28 m clearance used by navigation.</p><label><input id="debug" type="checkbox"> Show navigation clearance</label><label><input id="labels" type="checkbox" checked> Show room labels</label><a href="https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_42_1.jpg" target="_blank" rel="noreferrer">Source floor plan ↗</a></details>
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
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-destination]",
))
  button.onclick = () =>
    requestDestination(button.dataset.destination as DestinationId);
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
element<HTMLInputElement>("speed").oninput = (event) => {
  simulation.speed = Number((event.target as HTMLInputElement).value);
  element("speed-value").textContent = `${simulation.speed.toFixed(1)} m/s`;
};
for (const id of ["orbit", "top"])
  element<HTMLButtonElement>(id).onclick = () => {
    view.setView(id === "top");
    for (const other of ["orbit", "top"]) {
      element(other).classList.toggle("active", other === id);
      element(other).setAttribute("aria-pressed", String(other === id));
    }
  };
element<HTMLInputElement>("debug").onchange = (event) =>
  view.setDebug((event.target as HTMLInputElement).checked);
element<HTMLInputElement>("labels").onchange = (event) =>
  view.setLabels((event.target as HTMLInputElement).checked);
const timestamp = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
let lastEvents: unknown = null;
function renderInterface() {
  const target = destinations
    .find((destination) => destination.id === simulation.destination)
    ?.label.toLowerCase();
  element("status").textContent = simulation.paused
    ? "Paused"
    : {
        idle: "Ready to explore",
        walking: `Walking to ${target}`,
        arrived: `Arrived · ${target}`,
        blocked: "Route blocked",
      }[simulation.status];
  element("status-dot").className = `status-dot ${simulation.status}`;
  element("elapsed").textContent = timestamp(simulation.time);
  element("distance").innerHTML =
    `${simulation.distance.toFixed(1)} <em>m</em>`;
  element("pause").textContent = simulation.paused ? "▶ Resume" : "Ⅱ Pause";
  element("scenario-description").textContent = {
    clear: "A clear passage beside the kitchen island.",
    cart: "The cart narrows one side. Look for a detour around the island.",
    blocked: "The barrier spans the room. Crossing requires removing it.",
  }[simulation.scenario];
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-scenario]",
  )) {
    const active = button.dataset.scenario === simulation.scenario;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-destination]",
  )) {
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
function frame(now: number) {
  accumulator += Math.min((now - previous) / 1000, 0.1);
  previous = now;
  while (accumulator >= fixedStep) {
    simulation.advance(fixedStep);
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
