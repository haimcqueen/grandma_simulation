import type { Point } from "../contracts";
import type { Simulation } from "../simulation";

export type MovementStep =
  | { type: "walk"; point: Point; floor?: string }
  | { type: "destination"; id: string; floor?: string }
  | { type: "floor"; floor: string }
  | { type: "wait"; seconds: number };

/** JSON data only: no eval, timers, rendering dependencies, or independent movement state. */
export function parseMovementSteps(value: unknown): MovementStep[] {
  if (!Array.isArray(value) || !value.length || value.length > 256) throw new Error("Provide 1–256 movement steps.");
  return value.map((step, index) => {
    const fail = () => { throw new Error(`Invalid movement step ${index + 1}. Use walk, destination, floor, or wait.`); };
    if (!step || typeof step !== "object") return fail();
    if (step.floor !== undefined && (typeof step.floor !== "string" || !step.floor.length)) return fail();
    if (step.type === "walk" && step.point && [step.point.x, step.point.z].every(Number.isFinite))
      return { type: "walk", point: { x: step.point.x, z: step.point.z }, ...(step.floor ? { floor: step.floor } : {}) };
    if (step.type === "destination" && typeof step.id === "string" && step.id.length)
      return { type: "destination", id: step.id, ...(step.floor ? { floor: step.floor } : {}) };
    if (step.type === "floor" && step.floor) return { type: "floor", floor: step.floor };
    if (step.type === "wait" && Number.isFinite(step.seconds) && step.seconds >= 0 && step.seconds <= 3600)
      return { type: "wait", seconds: step.seconds };
    return fail();
  });
}

export class MovementProgram {
  steps: MovementStep[] = [];
  index = 0;
  status: "idle" | "running" | "blocked" | "completed" | "cancelled" = "idle";
  message = "Click a floor to walk. Shift-click builds a path.";
  private stage: "start" | "transfer" | "walk" | "wait" = "start";
  private deadline = 0;
  private previousTime = 0;
  private loop = false;
  constructor(readonly simulation: Simulation, private readonly onTakeover: () => void = () => {}) {}
  run(steps: unknown, options: { loop?: boolean } = {}) {
    const parsed = parseMovementSteps(steps);
    if (this.simulation.fall || this.simulation.floorJourney?.phase === "stairs")
      throw new Error("Finish the fall or stair transfer before starting a new path.");
    // Validate all references before taking over the current movement.
    let plannedFloor = this.simulation.floorId;
    for (const step of parsed) {
      if (step.type === "wait") continue;
      plannedFloor = step.floor ?? plannedFloor;
      const environment = plannedFloor !== this.simulation.floorId
        ? this.simulation.house?.floors.find(floor => floor.id === plannedFloor)?.environment : this.simulation.environment;
      if (!environment) throw new Error(`Unknown floor: ${plannedFloor}`);
      if (step.type === "destination" && !environment.destinations.some(target => target.id === step.id))
        throw new Error(`Unknown destination: ${step.id}`);
    }
    this.onTakeover();
    this.simulation.stopMovement();
    this.steps = parsed; this.index = 0; this.stage = "start"; this.loop = options.loop ?? false;
    this.status = "running"; this.previousTime = this.simulation.time; this.advance();
  }
  cancel(stopMovement = true) {
    if (stopMovement) this.simulation.stopMovement();
    this.status = "cancelled"; this.message = "Path stopped. You can walk freely or run a new path.";
  }
  retry() {
    if (this.status !== "blocked") return;
    this.stage = "start"; this.status = "running"; this.advance();
  }
  private block(message: string) { this.status = "blocked"; this.message = message; }
  private beginWalking(step: MovementStep) {
    if (step.type === "walk") {
      if (!this.simulation.requestPoint(step.point)) { this.block("Point is unreachable. Edit the path or clear the obstruction, then retry."); return; }
    } else if (step.type === "destination") this.simulation.requestDestination(step.id);
    this.stage = "walk";
  }
  /** Call once after Simulation.advance in the host's fixed-step loop. */
  advance() {
    const sim = this.simulation;
    if (this.status !== "running") return;
    if (sim.time < this.previousTime) { this.cancel(false); return; }
    this.previousTime = sim.time;
    if (sim.paused || sim.fall) return;
    // At most one command completes per tick; looping zero-duration waits cannot hang.
    const step = this.steps[this.index];
    this.message = `Step ${this.index + 1}/${this.steps.length} · ${step.type}`;
    if (this.stage === "start") {
      if (step.type === "wait") { sim.stopMovement(); this.deadline = sim.time + step.seconds; this.stage = "wait"; }
      else if (step.floor && step.floor !== sim.floorId) {
        if (!sim.requestFloor(step.floor)) { this.block("Cannot reach that floor. Clear the stair approach, then retry."); return; }
        this.stage = "transfer";
      } else if (step.type === "floor") this.completeStep();
      else this.beginWalking(step);
      return;
    }
    if (this.stage === "transfer") {
      if (sim.floorJourney) return;
      if (sim.floorId !== (step.type === "wait" ? undefined : step.floor)) { this.cancel(false); return; }
      if (step.type === "floor") this.completeStep(); else this.beginWalking(step);
    } else if (this.stage === "walk") {
      if (sim.manual) { this.cancel(false); return; }
      if (sim.status === "blocked") this.block("Route is blocked. Clear the obstruction and retry.");
      else if (sim.status === "arrived") this.completeStep();
    } else if (sim.time >= this.deadline) this.completeStep();
  }
  private completeStep() {
    this.index++; this.stage = "start";
    if (this.index === this.steps.length) {
      if (this.loop) this.index = 0;
      else { this.status = "completed"; this.message = "Path complete."; }
    }
  }
  snapshot() { return { steps: structuredClone(this.steps), index: this.index, status: this.status, message: this.message, loop: this.loop }; }
}
