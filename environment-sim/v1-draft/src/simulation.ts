import {
  destinations,
  objects,
  scenarioObjects,
  spawn,
  isWalkable,
  contains,
  patioFallZone,
  type Point,
  type DestinationId,
  type Scenario,
} from "./environment";
import { planRoute, segmentClear } from "./navigation";
import { angleDifference, approach } from "./robot/motion";
import { SUBJECTS, type Subject } from "./robot/subjects";
import { FALL_DURATION } from "./robot/fall";
import { conditionForSubject, type HazardHit } from "./hazards";
import { HazardTracker } from "./hazard-tracker";
export type SimulationEvent = {
  time: number;
  type: string;
  message: string;
  ids: string[];
};
export class Simulation {
  position: Point = { ...spawn };
  heading = 0;
  route: Point[] = [];
  destination: DestinationId | null = null;
  scenario: Scenario = "clear";
  status: "idle" | "walking" | "arrived" | "blocked" | "falling" | "fallen" = "idle";
  patioFallEnabled = false;
  /** Separate opt-in: falls triggered by hand-authored hazard zones (hazards.ts), not the fixed patio patch. */
  hazardFallEnabled = false;
  fallProgress = 0;
  fallStartedAt = 0;
  private fallCauseId = "patio-fall-zone";
  get isFalling() { return this.status === "falling" || this.status === "fallen"; }
  paused = false;
  subject = SUBJECTS[0];
  speed = this.subject.speedMps;
  currentSpeed = 0;
  gaitPhase = 0;
  gaitBlend = 0;
  time = 0;
  distance = 0;
  revision = 0;
  events: SimulationEvent[] = [];
  /** Manual drive suspends task planning; the resident is steered directly. */
  manual = false;
  /**
   * Hazard-zone detection (hand-authored, see hazards.ts) lives entirely in
   * this standalone tracker — it has no dependency on Simulation and can be
   * driven by any other simulation model the same way (see hazard-tracker.ts).
   */
  private hazardTracker = new HazardTracker();
  private static readonly HAZARD_ENTITY_ID = "resident-01";
  /** The hazard currently flagged for the popup, if any. */
  get pendingHazard(): HazardHit | null {
    return this.hazardTracker.pendingFor(Simulation.HAZARD_ENTITY_ID);
  }
  get turnRate() { return this.subject.motion.turnRate; }
  get obstacles() {
    return [...objects, ...scenarioObjects(this.scenario)];
  }
  constructor() {
    this.hazardTracker.onEnter = (_entityId, hit) => {
      this.record(
        "hazardEncountered",
        `${hit.zone.room}: ${hit.hazard.object} — ${hit.reason}`,
        ["resident-01", hit.zone.hazardId],
      );
      this.tryHazardFall(hit);
    };
    this.record("ready", "Resident ready in the living room.", ["resident-01"]);
  }
  setSubject(subject: Subject) {
    if (this.isFalling) this.reset();
    this.subject = subject;
    this.speed = subject.speedMps;
    this.currentSpeed = 0;
    this.gaitPhase = 0;
    this.gaitBlend = 0;
    // A different body can read differently against the same spot (e.g. a
    // toddler-only hazard), so re-check immediately even without moving.
    this.updateHazard();
  }
  dismissHazard() {
    this.hazardTracker.dismiss(Simulation.HAZARD_ENTITY_ID);
  }
  /** Hand-authored zone check (hazards.ts) — not automatic hazard detection. */
  private updateHazard() {
    this.hazardTracker.update(
      Simulation.HAZARD_ENTITY_ID,
      this.position,
      conditionForSubject(this.subject.id),
    );
  }
  setPatioFall(enabled: boolean) {
    this.patioFallEnabled = enabled;
  }
  setHazardFall(enabled: boolean) {
    this.hazardFallEnabled = enabled;
  }
  private checkPatioFall(travel: number) {
    if (!this.patioFallEnabled || this.subject.locomotion !== "biped" || travel <= 0 ||
      !contains(this.position, patioFallZone)) return false;
    this.fallCauseId = "patio-fall-zone";
    this.status = "falling";
    this.fallProgress = 0;
    this.fallStartedAt = this.time;
    this.currentSpeed = 0;
    this.route = [];
    this.record("fallStarted", "Patio fall demo: robot stumbles. This is an authored animation.",
      ["resident-01", "patio-fall-zone"]);
    return true;
  }
  /**
   * Separate opt-in demo: stumbles on entering a *high or critical severity*
   * hand-authored "falls_mobility" hazard zone (hazards.ts) for the current
   * subject's condition — e.g. a loose rug for an older adult. Like the
   * patio demo, this is an authored animation and not a fall prediction.
   */
  private tryHazardFall(hit: HazardHit) {
    if (!this.hazardFallEnabled || this.isFalling || this.subject.locomotion !== "biped") return;
    if (hit.hazard.category !== "falls_mobility") return;
    if (hit.severity !== "high" && hit.severity !== "critical") return;
    this.fallCauseId = hit.zone.hazardId;
    this.status = "falling";
    this.fallProgress = 0;
    this.fallStartedAt = this.time;
    this.currentSpeed = 0;
    this.route = [];
    this.record(
      "fallStarted",
      `Hazard fall demo: stumble on ${hit.hazard.object.toLowerCase()} in the ${hit.zone.room.toLowerCase()}. This is an authored animation, not a fall prediction.`,
      ["resident-01", hit.zone.hazardId],
    );
  }
  private animateMotion(travel: number, turn: number, delta: number) {
    this.gaitPhase += (travel + Math.abs(turn) * 0.12) / this.subject.motion.strideLength;
    const activity = Math.min(1, (Math.abs(travel) + Math.abs(turn) * 0.12) / delta / 0.18);
    this.gaitBlend += (activity - this.gaitBlend) * (1 - Math.exp(-10 * delta));
  }
  private changeSpeed(target: number, delta: number) {
    const motion = this.subject.motion;
    const accelerating = target * this.currentSpeed >= 0 && Math.abs(target) > Math.abs(this.currentSpeed);
    this.currentSpeed = approach(this.currentSpeed, target,
      (accelerating ? motion.acceleration : motion.deceleration) * delta);
  }
  private record(type: string, message: string, ids: string[]) {
    this.events.unshift({ time: this.time, type, message, ids });
    this.events = this.events.slice(0, 30);
  }
  requestDestination(id: DestinationId) {
    if (this.isFalling) return;
    if (this.manual) this.setManual(false);
    this.destination = id;
    this.replan(false);
  }

  setManual(on: boolean) {
    if (this.isFalling) return;
    if (this.manual === on) return;
    this.manual = on;
    this.currentSpeed = 0;
    if (on) {
      this.route = [];
      this.destination = null;
      this.status = "idle";
      this.record("manualControlStarted", "Manual drive engaged. Arrow keys steer the resident.", [
        "resident-01",
      ]);
    } else {
      this.record("manualControlEnded", "Manual drive released.", ["resident-01"]);
    }
  }

  /**
   * Steer directly. `forward` and `turn` are -1..1. Movement is refused where
   * the planner would refuse it, using the same clearance and obstacle set, so
   * manual control cannot walk through walls the router respects.
   */
  drive(forward: number, turn: number, delta: number) {
    if (!this.manual || this.paused || this.isFalling || !Number.isFinite(delta) || delta <= 0) return;
    if (!Number.isFinite(forward) || !Number.isFinite(turn)) return;
    forward = Math.max(-1, Math.min(1, forward));
    turn = Math.max(-1, Math.min(1, turn));
    const obstacles = this.obstacles;
    for (let remaining = delta; remaining > 0.0000001;) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step;
      const rotation = turn * this.turnRate * step;
      this.heading += rotation;
      const target = forward * this.speed * (forward < 0 ? 0.5 : 1) * (1 - Math.abs(turn) * 0.45);
      this.changeSpeed(target, step);
      const travel = this.currentSpeed * step;
      const next = {
        x: this.position.x + Math.sin(this.heading) * travel,
        z: this.position.z + Math.cos(this.heading) * travel,
      };
      const previous = this.position;
      if (segmentClear(previous, next, obstacles)) this.position = next;
      else this.currentSpeed = 0;
      const actual = Math.hypot(this.position.x - previous.x, this.position.z - previous.z);
      this.distance += actual;
      this.animateMotion(actual * Math.sign(travel), rotation, step);
      this.status = actual > 0.000001 || Math.abs(rotation) > 0.000001 ? "walking" : "idle";
      this.updateHazard();
      if (this.isFalling) return;
      if (this.checkPatioFall(actual)) return;
    }
  }
  private replan(changed: boolean) {
    const target = destinations.find((item) => item.id === this.destination);
    if (!target) return;
    const route = planRoute(this.position, target, this.obstacles);
    this.route = route ?? [];
    this.currentSpeed = 0;
    this.status = route ? "walking" : "blocked";
    this.record(
      route ? (changed ? "routeReplanned" : "routeStarted") : "routeBlocked",
      route
        ? changed
          ? `Route updated around the obstruction toward ${target.label.toLowerCase()}.`
          : `Walking to ${target.label.toLowerCase()}.`
        : `No clear route to ${target.label.toLowerCase()}. Remove the obstruction to continue.`,
      [
        "resident-01",
        target.id,
        ...(this.scenario !== "clear" ? ["passage-obstruction"] : []),
      ],
    );
  }
  setScenario(scenario: Scenario) {
    if (scenario === this.scenario) return true;
    if (
      !isWalkable(this.position, [...objects, ...scenarioObjects(scenario)])
    ) {
      this.record(
        "changeRejected",
        "Resident occupies this passage. Let them move clear or reset before placing the obstacle.",
        ["resident-01", "passage-obstruction"],
      );
      return false;
    }
    this.scenario = scenario;
    this.revision++;
    this.route = [];
    this.record(
      "environmentChanged",
      scenario === "clear"
        ? "Passage cleared."
        : scenario === "cart"
          ? "A storage cart narrows the passage."
          : "A barrier closes the passage.",
      ["passage-obstruction"],
    );
    if (this.destination && this.status !== "arrived" && !this.isFalling) this.replan(true);
    return true;
  }
  advance(delta: number) {
    if (this.paused || !Number.isFinite(delta) || delta <= 0) return;
    for (let remaining = delta; remaining > 0.0000001;) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step;
      this.time += step;
      if (this.status === "falling") {
        this.fallProgress = Math.min(1, this.fallProgress + step / FALL_DURATION);
        if (this.fallProgress >= 1) {
          this.status = "fallen";
          this.record("fallCompleted", "Robot is down. Reset resident to stand up and try again.",
            ["resident-01", this.fallCauseId]);
        }
      } else if (!this.manual && !this.isFalling) this.walkStep(step);
    }
  }
  private walkStep(delta: number) {
    if (this.status !== "walking") {
      this.currentSpeed = 0;
      this.animateMotion(0, 0, delta);
      return;
    }
    while (this.route.length && Math.hypot(this.route[0].x - this.position.x,
      this.route[0].z - this.position.z) < 0.00001) this.route.shift();
    const next = this.route[0];
    if (next) {
      const dx = next.x - this.position.x;
      const dz = next.z - this.position.z;
      const length = Math.hypot(dx, dz);
      const error = angleDifference(Math.atan2(dx, dz), this.heading);
      const rotation = Math.max(-this.turnRate * delta, Math.min(this.turnRate * delta, error));
      this.heading += rotation;
      const aligned = Math.abs(error - rotation) < 0.12;
      const brakingSpeed = Math.sqrt(2 * this.subject.motion.deceleration * length);
      this.changeSpeed(aligned ? Math.min(this.speed, brakingSpeed) : 0, delta);
      const travel = aligned ? Math.min(length, this.currentSpeed * delta) : 0;
      this.position = {
        x: this.position.x + dx / length * travel,
        z: this.position.z + dz / length * travel,
      };
      this.distance += travel;
      this.animateMotion(travel, rotation, delta);
      this.updateHazard();
      if (this.isFalling) return;
      if (this.checkPatioFall(travel)) return;
      if (travel === length) {
        this.route.shift();
        this.currentSpeed = 0;
      }
    }
    if (!this.route.length) {
      this.currentSpeed = 0;
      this.status = "arrived";
      this.record(
        "destinationReached",
        `Arrived at ${destinations.find((item) => item.id === this.destination)?.label.toLowerCase()}.`,
        ["resident-01", this.destination!],
      );
    }
  }
  reset() {
    this.position = { ...spawn };
    this.heading = 0;
    this.route = [];
    this.destination = null;
    this.status = "idle";
    this.fallProgress = 0;
    this.fallStartedAt = 0;
    this.fallCauseId = "patio-fall-zone";
    this.paused = false;
    this.manual = false;
    this.time = 0;
    this.distance = 0;
    this.currentSpeed = 0;
    this.gaitPhase = 0;
    this.gaitBlend = 0;
    this.events = [];
    this.hazardTracker.reset(Simulation.HAZARD_ENTITY_ID);
    this.revision++;
    this.record(
      "reset",
      "Resident reset; scenario and walking speed preserved.",
      ["resident-01"],
    );
  }
}
