import type {
  Environment,
  MovementProfile,
  Point,
  Scenario,
  SimulationEvent,
} from "./contracts";
import { stairLength, sampleStair } from "./stair-motion";
import type { House, FloorJourney } from "./house";
import { floorHeightAt } from "./navigation-grid";
import { isWalkable, scenarioObjects } from "./environment";
import { distance, planRoute, segmentClear } from "./navigation";
import { postures, type Posture } from "./posture";
import { roomFalls, roomFallFrame, roomFallTotalDuration, type RoomFall, type RoomFallKind } from "./falls";
import { HazardTracker, conditionForSubject, hazardAt, hazardFallKinds, zoneKey, type HazardProfile } from "./hazards";

export class Simulation {
  house?: House;
  floorId = "ground";
  floorJourney: FloorJourney | null = null;
  private stairInput = 0;
  pointTarget: Point | null = null;
  private floorScenarios = new Map<string, Scenario>();
  get elevation() { return this.floorJourney?.phase === "stairs" ? this.floorJourney.elevation : floorHeightAt(this.environment, this.position); }
  readonly characterId = "resident-01";
  position: Point;
  heading = 0;
  route: Point[] = [];
  destination: string | null = null;
  scenario: Scenario = "clear";
  status: "idle" | "walking" | "arrived" | "blocked" | "falling" | "fallen" | "recovering" = "idle";
  fall: RoomFall | null = null;
  private fallOrigin: Point;
  paused = false;
  manual = false;
  posture: Posture = "grandma";
  hunch = 1;
  skin = "factory";
  playbackSpeed = 1;
  hazardProfile: HazardProfile = "auto";
  autoHazardFalls = true;
  private triggeredZones = new Set<string>();
  private resumeAfterFall: { manual: boolean; destination: string | null; point: Point | null } | null = null;
  private readonly hazardTrackers = new Map<string, HazardTracker>();
  private get hazardTracker() {
    let tracker = this.hazardTrackers.get(this.environment.id);
    if (!tracker) {
      tracker = new HazardTracker({ zones: this.environment.hazardZones ?? [] });
      tracker.onEnter = (_id, hit) => this.record("hazardEncountered",
        `${hit.zone.room}: ${hit.hazard.object} · ${hit.severity} (${hit.condition} scenario).`, [this.characterId, this.floorId, hit.zone.hazardId]);
      this.hazardTrackers.set(this.environment.id, tracker);
    }
    return tracker;
  }
  get pendingHazard() { return this.fall || this.floorJourney ? null : this.hazardTracker.pendingFor(this.characterId); }
  currentSpeed = 0;
  gaitPhase = 0;
  time = 0;
  distance = 0;
  revision = 0;
  events: SimulationEvent[] = [];
  profile: MovementProfile = { speed: postures.grandma.speed, radius: 0.28, height: 1.7 };
  constructor(public environment: Environment) {
    this.position = { ...environment.spawn };
    this.fallOrigin = { ...this.position };
    this.record("ready", "Resident ready. Choose a destination.", [
      this.characterId,
    ]);
  }
  configureHouse(house: House, floorId: string) {
    const floor = house.floors.find(item => item.id === floorId);
    if (!floor || floor.environment.id !== this.environment.id) throw new Error("House floor does not match the active environment.");
    this.house = house;
    this.floorId = floorId;
  }
  requestFloor(targetFloor: string, destination?: string) {
    if (!this.house || this.fall || this.floorJourney) return false;
    const target = this.house.floors.find(floor => floor.id === targetFloor);
    if (!target || (destination && !target.environment.destinations.some(item => item.id === destination))) return false;
    if (targetFloor === this.floorId) { if (destination) this.requestDestination(destination); return true; }
    const connection = this.house.connections.find(link =>
      (link.fromFloor === this.floorId && link.toFloor === targetFloor) ||
      (link.toFloor === this.floorId && link.fromFloor === targetFloor));
    if (!connection) return false;
    const points = connection.fromFloor === this.floorId ? connection.points : [...connection.points].reverse();
    const targetScenario = this.floorScenarios.get(targetFloor) ?? "clear";
    if (!isWalkable(target.environment, points.at(-1)!, [...target.environment.objects, ...scenarioObjects(target.environment, targetScenario)], this.profile.radius)) {
      this.record("routeBlocked", "The destination landing is obstructed.", [this.characterId, connection.id, targetFloor]);
      return false;
    }
    const route = planRoute(this.environment, this.position, points[0], this.obstacles, this.profile.radius);
    if (!route) {
      this.record("routeBlocked", "The route to the stairs is blocked. Clear the passage and try again.", [this.characterId, connection.id]);
      return false;
    }
    this.manual = false; this.currentSpeed = 0; this.destination = null; this.pointTarget = null;
    this.floorJourney = { connection, targetFloor, destination, phase: "approach", points, index: 1, elevation: this.elevation, progress: 0, manual: false };
    this.route = route; this.status = "walking";
    this.record("floorRequested", `Walking to the stairs for ${target.label}.`, [this.characterId, connection.id, targetFloor]);
    return true;
  }
  private advanceStairs(delta: number) {
    const journey = this.floorJourney!;
    const input = journey.manual ? this.stairInput : 1;
    const length = stairLength(journey.points);
    const previous = journey.progress;
    journey.progress = Math.max(0, Math.min(length, previous + input * Math.min(this.profile.speed, 0.65) * (input < 0 ? 0.5 : 1) * delta));
    const pose = sampleStair(journey.points, journey.progress);
    this.position = { x: pose.x, z: pose.z };
    journey.elevation = pose.y; journey.index = pose.index;
    this.heading = pose.heading;
    const travel = journey.progress - previous;
    this.currentSpeed = delta > 0 ? travel / delta : 0;
    this.distance += Math.abs(travel);
    this.gaitPhase += travel / postures[this.posture].motion.strideLength;
    this.status = Math.abs(travel) > 1e-8 ? "walking" : "idle";
    const returned = journey.progress === 0 && input < 0;
    if (returned || journey.progress === length) {
      this.floorScenarios.set(this.floorId, this.scenario);
      this.hazardTracker.reset(this.characterId);
      if (!returned) this.floorId = journey.targetFloor;
      this.environment = this.house!.floors.find(floor => floor.id === this.floorId)!.environment;
      this.scenario = this.floorScenarios.get(this.floorId) ?? "clear";
      this.floorJourney = null; this.route = []; this.status = "idle"; this.currentSpeed = 0; this.stairInput = 0; this.revision++;
      this.manual = journey.manual;
      this.record("floorReached", `Reached ${this.environment.label}.`, [this.characterId, this.floorId, journey.connection.id]);
      if (!returned && !journey.manual && journey.destination) this.requestDestination(journey.destination);
    }
  }
  /** Stop where you are. On stairs, retain support and allow W/S to continue or reverse. */
  stopMovement() {
    if (this.fall) { this.resumeAfterFall = null; this.route = []; this.destination = null; this.pointTarget = null; return; }
    if (this.floorJourney?.phase === "stairs") this.floorJourney.manual = true;
    else this.floorJourney = null;
    this.route = []; this.destination = null; this.pointTarget = null;
    this.manual = true; this.stairInput = 0; this.currentSpeed = 0; this.status = "idle";
  }
  requestPoint(point: Point) {
    if (this.fall || this.floorJourney?.phase === "stairs" || ![point.x, point.z].every(Number.isFinite)) return false;
    const route = planRoute(this.environment, this.position, point, this.obstacles, this.profile.radius);
    if (!route) {
      this.record("routeBlocked", "That point is outside reachable walking space.", [this.characterId]);
      return false;
    }
    this.floorJourney = null; this.manual = false; this.currentSpeed = 0;
    this.destination = null; this.pointTarget = { ...point }; this.route = route; this.status = "walking";
    this.record("routeStarted", `Walking to (${point.x.toFixed(2)}, ${point.z.toFixed(2)}).`, [this.characterId]);
    return true;
  }
  get obstacles() {
    return [
      ...this.environment.objects,
      ...scenarioObjects(this.environment, this.scenario),
    ];
  }
  private record(
    type: SimulationEvent["type"],
    message: string,
    ids: string[],
  ) {
    this.events = [
      { type, time: this.time, revision: this.revision, ids, message },
      ...this.events,
    ].slice(0, 40);
  }
  requestDestination(id: string) {
    if (this.fall || this.floorJourney?.phase === "stairs") return;
    if (!this.environment.destinations.some((target) => target.id === id))
      throw new Error(`Unknown destination: ${id}`);
    this.manual = false;
    this.currentSpeed = 0;
    this.floorJourney = null;
    this.pointTarget = null;
    this.destination = id;
    this.replan(false);
  }
  setPosture(posture: Posture) {
    if (this.fall || this.floorJourney) return;
    this.posture = posture;
    this.profile.speed = postures[posture].speed;
    this.currentSpeed = 0;
    this.updateHazards();
  }
  setHazardProfile(profile: HazardProfile) {
    this.hazardProfile = profile;
    this.updateHazards();
  }
  dismissHazard() { this.hazardTracker.dismiss(this.characterId); }
  private updateHazards(moved = false) {
    if (this.fall || this.floorJourney) return;
    const condition = this.hazardProfile === "auto" ? conditionForSubject(this.posture)
      : this.hazardProfile === "off" ? null : this.hazardProfile;
    this.hazardTracker.update(this.characterId, this.position, condition);
    for (const zone of this.environment.hazardZones ?? []) {
      if (distance(this.position, zone) > zone.radius + 0.2) this.triggeredZones.delete(`${this.floorId}:${zoneKey(zone)}`);
    }
    const hit = moved && this.autoHazardFalls && this.posture === "grandma"
      ? hazardAt(this.position, condition, this.environment.hazardZones ?? []) : null;
    const kind = hit && hazardFallKinds[hit.zone.hazardId];
    if (hit && kind && !this.triggeredZones.has(`${this.floorId}:${zoneKey(hit.zone)}`)) {
      this.triggeredZones.add(`${this.floorId}:${zoneKey(hit.zone)}`);
      const resume = { manual: this.manual, destination: this.destination, point: this.pointTarget && { ...this.pointTarget } };
      if (!this.playFall(kind)) return;
      this.fall!.autoRecover = true;
      this.resumeAfterFall = resume;
    }
  }
  setManual() {
    if (this.fall || this.paused) return;
    if (this.floorJourney?.phase === "stairs") {
      this.floorJourney.manual = true; this.floorJourney.destination = undefined;
      this.manual = true; return;
    }
    if (this.floorJourney?.manual) return;
    this.floorJourney = null;
    this.pointTarget = null;
    if (this.manual) return;
    this.manual = true;
    this.route = [];
    this.destination = null;
    this.currentSpeed = 0;
    this.status = "idle";
    this.record("manualControlStarted", "Keyboard control. W/S move; A/D turn.", [this.characterId]);
  }
  stopManualMotion() {
    this.stairInput = 0;
    this.currentSpeed = 0;
    if (this.manual) this.status = "idle";
  }
  drive(forward: number, turn: number, delta: number) {
    if (this.fall || this.paused || (!this.manual && !this.floorJourney?.manual) || ![forward, turn, delta].every(Number.isFinite) || delta <= 0) return;
    if (this.floorJourney?.manual) {
      this.stairInput = Math.max(-1, Math.min(1, forward)); return;
    }
    // Enter a connector only while moving toward its supported endpoint.
    if (forward > 0 && this.house) {
      for (const link of this.house.connections) {
        if (link.fromFloor !== this.floorId && link.toFloor !== this.floorId) continue;
        const points = link.fromFloor === this.floorId ? link.points : [...link.points].reverse();
        const dx = points[1].x - points[0].x, dz = points[1].z - points[0].z;
        const facing = (Math.sin(this.heading) * dx + Math.cos(this.heading) * dz) / Math.hypot(dx, dz);
        if (distance(this.position, points[0]) < 0.18 && facing > 0.7 && this.requestFloor(link.fromFloor === this.floorId ? link.toFloor : link.fromFloor)) {
          this.floorJourney!.manual = true; this.stairInput = forward; return;
        }
      }
    }
    delta *= this.playbackSpeed;
    forward = Math.max(-1, Math.min(1, forward));
    turn = Math.max(-1, Math.min(1, turn));
    const motion = postures[this.posture].motion;
    const obstacles = this.obstacles;
    for (let remaining = delta; remaining > 0.0000001;) {
      const step = Math.min(remaining, 1 / 60);
      remaining -= step;
      const rotation = turn * motion.turnRate * step;
      this.heading += rotation;
      const target = forward * this.profile.speed * (forward < 0 ? 0.5 : 1);
      const rate = Math.abs(target) > Math.abs(this.currentSpeed) ? motion.acceleration : motion.deceleration;
      const change = Math.max(-rate * step, Math.min(rate * step, target - this.currentSpeed));
      this.currentSpeed += change;
      const travel = this.currentSpeed * step;
      const next = {
        x: this.position.x + Math.sin(this.heading) * travel,
        z: this.position.z + Math.cos(this.heading) * travel,
      };
      let actual = 0;
      if (segmentClear(this.environment, this.position, next, obstacles, this.profile.radius)) {
        actual = distance(this.position, next);
        this.position = next;
      } else {
        const candidates = [{ x: next.x, z: this.position.z }, { x: this.position.x, z: next.z }]
          .filter(point => segmentClear(this.environment, this.position, point, obstacles, this.profile.radius))
          .sort((a, b) => distance(this.position, b) - distance(this.position, a));
        if (candidates[0]) { actual = distance(this.position, candidates[0]); this.position = candidates[0]; }
        if (actual < 1e-8) this.currentSpeed = 0;
      }
      this.distance += actual;
      this.gaitPhase += actual * Math.sign(travel) / motion.strideLength + Math.abs(rotation) * 0.3;
      this.status = actual > 0.000001 || Math.abs(rotation) > 0.000001 ? "walking" : "idle";
      this.updateHazards(actual > 0.000001);
      if (this.fall) return;
    }
  }
  private replan(changed: boolean) {
    const target = this.pointTarget ? { ...this.pointTarget, id: "walk-point", label: "selected point" } : this.environment.destinations.find(
      (target) => target.id === this.destination,
    );
    if (!target) return;
    const route = planRoute(
      this.environment,
      this.position,
      target,
      this.obstacles,
      this.profile.radius,
    );
    this.route = route ?? [];
    this.status = route ? "walking" : "blocked";
    this.record(
      route ? (changed ? "routeReplanned" : "routeStarted") : "routeBlocked",
      route
        ? `${changed ? "Route updated" : "Walking"} to ${target.label.toLowerCase()}.`
        : `No route to ${target.label.toLowerCase()} with ${this.profile.radius.toFixed(2)} m body clearance. Clear the passage to continue.`,
      [
        this.characterId,
        target.id,
        ...(this.scenario === "clear" ? [] : ["passage-obstruction"]),
      ],
    );
  }
  setScenario(scenario: Scenario) {
    if (this.fall || this.floorJourney) return false;
    if (scenario === this.scenario) return true;
    if (
      !isWalkable(
        this.environment,
        this.position,
        [
          ...this.environment.objects,
          ...scenarioObjects(this.environment, scenario),
        ],
        this.profile.radius,
      )
    ) {
      this.record(
        "changeRejected",
        "The resident occupies this space. Move them clear or reset before placing the obstruction.",
        [this.characterId, "passage-obstruction"],
      );
      return false;
    }
    this.scenario = scenario;
    this.revision++;
    this.route = [];
    this.record(
      "environmentChanged",
      {
        clear: "Passage cleared.",
        cart: "Storage cart placed. Routes now account for its footprint.",
        blocked: "Barrier closes the passage.",
      }[scenario],
      ["passage-obstruction"],
    );
    if ((this.destination || this.pointTarget) && this.status !== "arrived") this.replan(true);
    return true;
  }
  advance(delta: number) {
    if (!Number.isFinite(delta) || delta < 0)
      throw new Error("Simulation step must be finite and nonnegative.");
    if (this.paused) return;
    delta *= this.playbackSpeed;
    this.time += delta;
    if (this.floorJourney?.phase === "stairs") { this.advanceStairs(delta); return; }
    if (this.fall) {
      this.fall.elapsed = Math.min(this.fall.elapsed + delta, roomFallTotalDuration(this.fall));
      const frame = roomFallFrame(this.fall);
      const next = {
        x: this.fallOrigin.x + Math.sin(this.heading) * frame.forward + Math.cos(this.heading) * frame.lateral,
        z: this.fallOrigin.z + Math.cos(this.heading) * frame.forward - Math.sin(this.heading) * frame.lateral,
      };
      // Constrain root travel to this room's grid; articulated limbs are not collision bodies.
      if (segmentClear(this.environment, this.position, next, this.obstacles, this.profile.radius)) this.position = next;
      if (frame.progress === 1 && this.status === "falling") {
        this.status = "fallen";
        this.record("fallCompleted", this.fall.autoRecover ? "Landed. Preparing to stand up." : "Fall demo complete. Replay or reset to walk again.", [this.characterId]);
      }
      if (frame.recovery > 0 && this.status !== "recovering") {
        this.status = "recovering";
        this.record("recoveryStarted", "Bracing, kneeling, then standing up.", [this.characterId]);
      }
      if (frame.recovery === 1) {
        this.fall = null;
        this.status = "idle";
        this.gaitPhase = 0;
        const resume = this.resumeAfterFall;
        this.resumeAfterFall = null;
        this.manual = resume?.manual ?? false;
        this.record("recoveryCompleted", "Back on her feet. Movement restored.", [this.characterId]);
        if (resume?.destination) this.requestDestination(resume.destination);
        else if (resume?.point) this.requestPoint(resume.point);
      }
      return;
    }
    if (this.floorJourney?.manual && this.stairInput <= 0) { this.currentSpeed = 0; return; }
    if (this.manual || this.status !== "walking") { this.updateHazards(); return; }
    let remaining = this.profile.speed * delta;
    while (remaining > 0 && this.route.length) {
      const next = this.route[0],
        length = distance(this.position, next);
      if (length < 0.000001) {
        this.route.shift();
        continue;
      }
      const travel = Math.min(length, remaining, 0.15),
        dx = next.x - this.position.x,
        dz = next.z - this.position.z;
      this.heading = Math.atan2(dx, dz);
      this.position = {
        x: this.position.x + (dx / length) * travel,
        z: this.position.z + (dz / length) * travel,
      };
      this.distance += travel;
      this.gaitPhase += travel / postures[this.posture].motion.strideLength;
      this.updateHazards(travel > 0);
      if (this.fall) return;
      remaining -= travel;
      if (travel === length) this.route.shift();
    }
    if (!this.route.length && this.floorJourney) {
      this.floorJourney.phase = "stairs";
      this.floorJourney.elevation = this.floorJourney.points[0].y;
      this.record("stairsStarted", "Following the authored stair connection.", [this.characterId, this.floorJourney.connection.id]);
      return;
    }
    if (!this.route.length) {
      this.status = "arrived";
      this.record(
        "destinationReached",
        `Arrived at ${this.pointTarget ? "selected point" : this.environment.destinations.find((target) => target.id === this.destination)!.label.toLowerCase()}.`,
        [this.characterId, this.destination ?? "walk-point"],
      );
    }
  }
  playFall(kind: RoomFallKind) {
    if (this.floorJourney || postures[this.posture].crawl) return false;
    const scenario = roomFalls.find(fall => fall.id === kind);
    if (!scenario) return false;
    this.hazardTracker.reset(this.characterId);
    if (this.fall) this.position = { ...this.fallOrigin };
    this.resumeAfterFall = null;
    this.fallOrigin = { ...this.position };
    this.pointTarget = null;
    this.fall = { kind, elapsed: 0 };
    this.manual = false;
    this.currentSpeed = 0;
    this.route = [];
    this.destination = null;
    this.paused = false;
    this.status = "falling";
    this.record("fallStarted", `${scenario.label} · authored movement demo.`, [this.characterId]);
    return true;
  }
  reset() {
    this.pointTarget = null; this.stairInput = 0;
    this.floorJourney = null;
    this.triggeredZones.clear();
    this.resumeAfterFall = null;
    this.hazardTracker.reset(this.characterId);
    this.fall = null;
    this.manual = false;
    this.currentSpeed = 0;
    this.gaitPhase = 0;
    this.position = { ...this.environment.spawn };
    this.heading = 0;
    this.route = [];
    this.destination = null;
    this.status = "idle";
    this.paused = false;
    this.time = 0;
    this.distance = 0;
    this.events = [];
    this.revision++;
    this.record(
      "reset",
      "Resident reset. Scenario and walking speed preserved for comparison.",
      [this.characterId],
    );
  }
  snapshot() {
    return structuredClone({
      environmentId: this.environment.id,
      floorId: this.floorId,
      elevation: this.elevation,
      floorJourney: this.floorJourney,
      characterId: this.characterId,
      position: this.position,
      heading: this.heading,
      destination: this.destination,
      pointTarget: this.pointTarget,
      scenario: this.scenario,
      status: this.status,
      fall: this.fall,
      paused: this.paused,
      manual: this.manual,
      posture: this.posture,
      hunch: this.hunch,
      skin: this.skin,
      playbackSpeed: this.playbackSpeed,
      hazardProfile: this.hazardProfile,
      autoHazardFalls: this.autoHazardFalls,
      pendingHazard: this.pendingHazard,
      currentSpeed: this.currentSpeed,
      gaitPhase: this.gaitPhase,
      time: this.time,
      distance: this.distance,
      revision: this.revision,
      profile: this.profile,
      route: this.route,
      events: this.events,
    });
  }
}
