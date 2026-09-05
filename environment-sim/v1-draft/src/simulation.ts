import { FLOOR_RISE, STAIR_ENTRY, STAIR_ROUTE, type StairPoint } from "./stairs";
import { upperDestinations, upperFloors, upperObjects, upperSpawn } from "./upperFloor";
import {
  destinations, floors, type FloorLevel,
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
import { BALCONY_APPROACH, balconyFrame, fallDuration, situationFrame, type FallKind } from "./robot/fall";
import { conditionForSubject, type HazardHit } from "./hazards";
import { HazardTracker } from "./hazard-tracker";
export type SimulationEvent = {
  time: number;
  type: string;
  message: string;
  ids: string[];
};
export class Simulation {
  level: FloorLevel = "ground";
  stairTarget: FloorLevel | null = null;
  stairRoute: StairPoint[] = [];
  get onStairs() { return this.stairRoute.length > 0; }
  get changingFloor() { return this.stairTarget !== null; }
  manualStairs = false;
  private stairInput = 0;
  setStairInput(value: number) { this.stairInput = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
  requestFloor(level: FloorLevel, manualControl = false) {
    if (this.isFalling || this.changingFloor || level === this.level) return false;
    const route = planRoute(this.position, STAIR_ENTRY[this.level], this.obstacles, this.floorRegions);
    if (!route) {
      this.record("routeBlocked", "The route to the stairs is blocked. Clear the passage and try again.", ["stairs"]);
      return false;
    }
    this.manual = false;
    this.manualStairs = manualControl;
    this.destination = null;
    this.stairTarget = level;
    this.route = route;
    this.currentSpeed = 0;
    this.status = "walking";
    this.record("stairApproach", level === "upper" ? "Walking to the stairs to go upstairs." : "Walking to the landing to go downstairs.", ["stairs"]);
    return true;
  }
  private climbStep(delta: number) {
    const next = this.stairRoute[0];
    if (!next) return;
    const dx = next.x - this.position.x, dz = next.z - this.position.z, dy = next.y - this.elevation;
    const length = Math.hypot(dx, dy, dz);
    if (length > 0.000001) {
      const error = angleDifference(Math.atan2(dx, dz), this.heading);
      const rotation = Math.max(-this.turnRate * delta, Math.min(this.turnRate * delta, error));
      this.heading += rotation;
      const aligned = Math.abs(error - rotation) < 0.12;
      this.changeSpeed(aligned ? Math.min(this.speed * 0.55, Math.sqrt(2 * this.subject.motion.deceleration * length)) : 0, delta);
      const travel = aligned ? Math.min(length, this.currentSpeed * delta) : 0;
      this.position = { x: this.position.x + dx / length * travel, z: this.position.z + dz / length * travel };
      this.elevation += dy / length * travel;
      this.distance += travel;
      this.animateMotion(travel, rotation, delta);
      if (travel < length) return;
    }
    this.stairRoute.shift();
    this.currentSpeed = 0;
    if (!this.stairRoute.length) {
      this.manual = this.manualStairs;
      this.manualStairs = false;
      this.level = this.stairTarget!;
      this.stairTarget = null;
      this.elevation = this.level === "upper" ? FLOOR_RISE : 0;
      this.status = "idle";
      this.patioFallEnabled = false;
      this.revision++;
      this.record("floorReached", this.level === "upper" ? "Reached the second-floor landing." : "Reached the ground floor.", [this.level, "stairs"]);
    }
  }
  get floorRegions() { return this.level === "upper" ? upperFloors : floors; }
  get availableDestinations() { return this.level === "upper" ? upperDestinations : destinations; }
  setLevel(level: FloorLevel) {
    if (level === this.level) return;
    this.level = level;
    this.scenario = "clear";
    this.patioFallEnabled = false;
    this.reset();
    this.record("floorChanged", level === "upper"
      ? "Second floor selected. Resident placed at the stair landing."
      : "Ground floor selected. Resident placed in the living room.", [level]);
  }
  position: Point = { ...spawn };
  heading = 0;
  route: Point[] = [];
  destination: DestinationId | null = null;
  scenario: Scenario = "clear";
  status: "idle" | "walking" | "arrived" | "blocked" | "falling" | "fallen" = "idle";
  patioFallEnabled = false;
  fallProgress = 0;
  fallStartedAt = 0;
  fallKind: FallKind = "patio";
  fallElapsed = 0;
  injuryProgress = 0;
  elevation = 0;
  private fallOrigin: Point = { ...spawn };
  get fallStage() {
    return this.fallKind === "balcony" ? balconyFrame(this.fallElapsed).stage
      : situationFrame(this.fallKind, this.fallElapsed).stage;
  }
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
    return this.level === "ground" && !this.changingFloor ? this.hazardTracker.pendingFor(Simulation.HAZARD_ENTITY_ID) : null;
  }
  get turnRate() { return this.subject.motion.turnRate; }
  get obstacles() {
    return this.level === "upper" ? upperObjects : [...objects, ...scenarioObjects(this.scenario)];
  }
  constructor() {
    this.hazardTracker.onEnter = (_entityId, hit) => this.record(
      "hazardEncountered",
      `${hit.zone.room}: ${hit.hazard.object} — ${hit.reason}`,
      ["resident-01", hit.zone.hazardId],
    );
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
      this.level === "ground" && !this.changingFloor ? conditionForSubject(this.subject.id) : null,
    );
  }
  setPatioFall(enabled: boolean) {
    this.patioFallEnabled = this.level === "ground" && enabled;
  }
  playFall(kind: FallKind) {
    if (this.changingFloor || this.level === "upper" || this.subject.locomotion === "quadruped") return false;
    this.scenario = "clear";
    this.reset();
    this.fallKind = kind;
    this.status = "falling";
    this.fallStartedAt = this.time;
    this.gaitBlend = 1;
    if (kind === "balcony") {
      const frame = balconyFrame(0);
      this.position = { x: frame.x, z: frame.z };
      this.elevation = frame.elevation;
    } else {
      this.position = kind === "stairs" ? { x: 3.7, z: 14.5 }
        : kind === "patio" ? { x: patioFallZone.x, z: patioFallZone.z }
        : kind === "trip" ? { x: 5.7, z: 9.4 } : { x: 8.3, z: 5.4 };
      this.heading = kind === "stairs" ? Math.PI / 2 : 0;
      this.elevation = kind === "stairs" ? 1.53 : 0;
    }
    this.fallOrigin = { ...this.position };
    this.record("fallStarted", this.fallStage, ["resident-01", `${kind}-fall-zone`]);
    return true;
  }
  private checkPatioFall(travel: number) {
    if (this.changingFloor || !this.patioFallEnabled || this.subject.locomotion !== "biped" || travel <= 0 ||
      !contains(this.position, patioFallZone)) return false;
    this.fallOrigin = { ...this.position };
    this.status = "falling";
    this.fallProgress = 0;
    this.fallKind = "patio";
    this.fallElapsed = 0;
    this.injuryProgress = 0;
    this.fallStartedAt = this.time;
    this.currentSpeed = 0;
    this.route = [];
    this.record("fallStarted", "Patio fall demo: robot stumbles. This is an authored animation.",
      ["resident-01", "patio-fall-zone"]);
    return true;
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
    if (this.changingFloor || this.isFalling || !this.availableDestinations.some(d => d.id === id)) return;
    if (this.manual) this.setManual(false);
    this.destination = id;
    this.replan(false);
  }

  setManual(on: boolean) {
    if (this.changingFloor || this.isFalling) return;
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
    const entry = STAIR_ENTRY[this.level];
    if (forward > 0 && Math.hypot(this.position.x - entry.x, this.position.z - entry.z) < 0.8 && -Math.sin(this.heading) > 0.65) {
      if (this.requestFloor(this.level === "ground" ? "upper" : "ground", true)) return;
    }
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
      if (segmentClear(previous, next, obstacles, this.floorRegions)) this.position = next;
      else this.currentSpeed = 0;
      const actual = Math.hypot(this.position.x - previous.x, this.position.z - previous.z);
      this.distance += actual;
      this.animateMotion(actual * Math.sign(travel), rotation, step);
      this.status = actual > 0.000001 || Math.abs(rotation) > 0.000001 ? "walking" : "idle";
      this.updateHazard();
      if (this.checkPatioFall(actual)) return;
    }
  }
  private replan(changed: boolean) {
    const target = this.availableDestinations.find((item) => item.id === this.destination);
    if (!target) return;
    const route = planRoute(this.position, target, this.obstacles, this.floorRegions);
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
    if (this.changingFloor) return false;
    if (this.level === "upper") return scenario === "clear";
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
      if (this.changingFloor && this.manualStairs && this.stairInput <= 0) {
        this.currentSpeed = 0;
        this.animateMotion(0, 0, step);
      } else if (this.onStairs) this.climbStep(step);
      else if (this.isFalling) {
        const duration = fallDuration(this.fallKind);
        this.fallElapsed = Math.min(duration + 1.2, this.fallElapsed + step);
        if (this.fallKind === "balcony") {
          const frame = balconyFrame(this.fallElapsed);
          const travel = Math.hypot(frame.x - this.position.x, frame.z - this.position.z);
          this.position = { x: frame.x, z: frame.z };
          this.elevation = frame.elevation;
          this.fallProgress = frame.poseProgress;
          this.injuryProgress = frame.injuryProgress;
          if (this.fallElapsed <= BALCONY_APPROACH) {
            this.distance += travel;
            this.animateMotion(travel, 0, step);
          }
        } else {
          const frame = situationFrame(this.fallKind, this.fallElapsed);
          this.fallProgress = frame.progress;
          this.injuryProgress = frame.injuryProgress;
          this.position = {
            x: this.fallOrigin.x + Math.sin(this.heading) * frame.forward + Math.cos(this.heading) * frame.lateral,
            z: this.fallOrigin.z + Math.cos(this.heading) * frame.forward - Math.sin(this.heading) * frame.lateral,
          };
          this.elevation = frame.elevation;
        }
        if (this.fallElapsed >= duration && this.status === "falling") {
          this.status = "fallen";
          this.record("fallCompleted", "Resident is down. Replay the animation or reset to stand up.",
            ["resident-01", `${this.fallKind}-fall-zone`]);
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
      if (this.checkPatioFall(travel)) return;
      if (travel === length) {
        this.route.shift();
        this.currentSpeed = 0;
      }
    }
    if (!this.route.length && this.stairTarget) {
      this.stairRoute = (this.level === "ground" ? STAIR_ROUTE : [...STAIR_ROUTE].reverse()).map(p => ({ ...p }));
      this.record("stairClimbStarted", this.level === "ground" ? "Climbing the stairs." : "Descending the stairs.", ["stairs"]);
      return;
    }
    if (!this.route.length) {
      this.currentSpeed = 0;
      this.status = "arrived";
      this.record(
        "destinationReached",
        `Arrived at ${this.availableDestinations.find((item) => item.id === this.destination)?.label.toLowerCase()}.`,
        ["resident-01", this.destination!],
      );
    }
  }
  reset() {
    this.manualStairs = false;
    this.stairInput = 0;
    this.stairTarget = null;
    this.stairRoute = [];
    this.position = { ...(this.level === "upper" ? upperSpawn : spawn) };
    this.heading = 0;
    this.route = [];
    this.destination = null;
    this.status = "idle";
    this.fallProgress = 0;
    this.fallStartedAt = 0;
    this.fallKind = "patio";
    this.fallElapsed = 0;
    this.injuryProgress = 0;
    this.elevation = this.level === "upper" ? FLOOR_RISE : 0;
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
