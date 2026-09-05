import type { Viewer } from "../viewer";
import type { MovementProgram, MovementStep } from "./program";
import { parseMovementSteps } from "./program";
import type { Simulation } from "../simulation";

/** Small optional authoring UI; reusable program execution lives in program.ts. */
export function mountMovementStudio(container: HTMLElement, options: {
  viewer: Viewer;
  simulation(): Simulation;
  program(): MovementProgram;
  beforeRun(): void;
}) {
  container.innerHTML = `<section class="control-section movement-studio">
    <div class="section-number">PATH STUDIO <span>Walk your own route</span></div>
    <label class="source-note"><input id="click-walk" type="checkbox" checked> Click floor to walk · Shift-click to add a waypoint</label>
    <p class="source-note">Drag to orbit. Map shows reachable space. W/S takes over; on stairs, release to stop or S to backtrack.</p>
    <div class="segmented"><button id="path-wait">+ Wait 2s</button><button id="path-undo">Undo</button><button id="path-example">Example</button></div>
    <label class="field-label" for="path-json">Editable steps (JSON)</label><textarea id="path-json" rows="6" spellcheck="false">[]</textarea>
    <label class="source-note"><input id="path-loop" type="checkbox"> Repeat path</label>
    <div class="segmented"><button id="path-run">Run</button><button id="path-stop">Stop here</button><button id="path-retry">Retry</button><button id="path-save">Export</button></div>
    <label class="field-label" for="path-file">Import a path</label><input id="path-file" type="file" accept="application/json,.json">
    <p id="path-status" class="source-note" role="status"></p>
  </section>`;
  const find = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const editor = find<HTMLTextAreaElement>("path-json");
  const status = find("path-status");
  let error = "";
  const read = () => parseMovementSteps(JSON.parse(editor.value));
  const write = (steps: MovementStep[]) => { editor.value = JSON.stringify(steps, null, 2); error = ""; };
  const edit = (change: (steps: MovementStep[]) => void) => {
    try { const steps = editor.value.trim() === "[]" ? [] : read(); change(steps); write(steps); } catch (e) { error = String(e); }
  };
  const run = (steps: MovementStep[], loop = false) => {
    try { options.beforeRun(); options.program().run(steps, { loop }); error = ""; }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
  };
  find("path-run").onclick = () => { try { run(read(), find<HTMLInputElement>("path-loop").checked); } catch (e) { error = String(e); } };
  find("path-stop").onclick = () => { options.beforeRun(); options.program().cancel(); error = ""; };
  find("path-retry").onclick = () => { options.program().retry(); error = ""; };
  find("path-wait").onclick = () => edit(steps => { steps.push({ type: "wait", seconds: 2 }); });
  find("path-undo").onclick = () => edit(steps => { steps.pop(); });
  find("path-example").onclick = () => {
    const sim = options.simulation();
    const steps: MovementStep[] = sim.environment.destinations.slice(0, 2).flatMap(destination => [
      { type: "destination", id: destination.id, floor: sim.floorId }, { type: "wait", seconds: 2 },
    ]);
    if (sim.house) {
      const other = sim.house.floors.find(floor => floor.id !== sim.floorId)!;
      steps.push({ type: "destination", floor: other.id, id: other.environment.destinations[0].id }, { type: "wait", seconds: 2 }, { type: "floor", floor: sim.floorId });
    }
    write(steps);
  };
  find("path-save").onclick = () => {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(read(), null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "house-walking-path.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { error = String(e); }
  };
  find<HTMLInputElement>("path-file").onchange = async event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("Path file must be under 100 KB.");
      write(parseMovementSteps(JSON.parse(await file.text())));
    } catch (e) { error = String(e); }
  };
  editor.oninput = () => { error = ""; };
  const canvas = options.viewer.renderer.domElement;
  let down = { x: 0, y: 0, button: -1 };
  const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY, button: event.button }; };
  const pointerUp = (event: PointerEvent) => {
    if (down.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 || !find<HTMLInputElement>("click-walk").checked || container.closest<HTMLElement>("[inert]") || container.closest<HTMLElement>("[hidden]")) return;
    const target = options.viewer.pickMovementTarget(event.clientX, event.clientY);
    if (!target) { error = "Choose a visible floor surface, or use Map for precise waypoint placement."; return; }
    const step: MovementStep = { type: "walk", floor: target.floor, point: { x: Number(target.point.x.toFixed(3)), z: Number(target.point.z.toFixed(3)) } };
    if (event.shiftKey) edit(steps => { steps.push(step); });
    else { write([step]); run([step]); }
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  return {
    update() {
      const program = options.program();
      status.textContent = error || program.message;
      find<HTMLButtonElement>("path-retry").disabled = program.status !== "blocked";
    },
    dispose() { canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointerup", pointerUp); container.replaceChildren(); },
  };
}
