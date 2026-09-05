import type {
  Environment,
  MovementProfile,
  Point,
  Scenario,
  SimulationEvent,
} from "./contracts";
import { isWalkable, scenarioObjects } from "./environment";
import { distance, planRoute } from "./navigation";

export class Simulation {
  readonly characterId = "resident-01";
  position: Point;
  heading = 0;
  route: Point[] = [];
  destination: string | null = null;
  scenario: Scenario = "clear";
  status: "idle" | "walking" | "arrived" | "blocked" = "idle";
  paused = false;
  time = 0;
  distance = 0;
  revision = 0;
  events: SimulationEvent[] = [];
  profile: MovementProfile = { speed: 0.9, radius: 0.28, height: 1.7 };
  constructor(readonly environment: Environment) {
    this.position = { ...environment.spawn };
    this.record("ready", "Resident ready. Choose a destination.", [
      this.characterId,
    ]);
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
    if (!this.environment.destinations.some((target) => target.id === id))
      throw new Error(`Unknown destination: ${id}`);
    this.destination = id;
    this.replan(false);
  }
  private replan(changed: boolean) {
    const target = this.environment.destinations.find(
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
    if (this.destination && this.status !== "arrived") this.replan(true);
    return true;
  }
  advance(delta: number) {
    if (!Number.isFinite(delta) || delta < 0)
      throw new Error("Simulation step must be finite and nonnegative.");
    if (this.paused) return;
    this.time += delta;
    if (this.status !== "walking") return;
    let remaining = this.profile.speed * delta;
    while (remaining > 0 && this.route.length) {
      const next = this.route[0],
        length = distance(this.position, next);
      if (length < 0.000001) {
        this.route.shift();
        continue;
      }
      const travel = Math.min(length, remaining),
        dx = next.x - this.position.x,
        dz = next.z - this.position.z;
      this.heading = Math.atan2(dx, dz);
      this.position = {
        x: this.position.x + (dx / length) * travel,
        z: this.position.z + (dz / length) * travel,
      };
      this.distance += travel;
      remaining -= travel;
      if (travel === length) this.route.shift();
    }
    if (!this.route.length) {
      this.status = "arrived";
      this.record(
        "destinationReached",
        `Arrived at ${this.environment.destinations.find((target) => target.id === this.destination)!.label.toLowerCase()}.`,
        [this.characterId, this.destination!],
      );
    }
  }
  reset() {
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
      characterId: this.characterId,
      position: this.position,
      heading: this.heading,
      destination: this.destination,
      scenario: this.scenario,
      status: this.status,
      paused: this.paused,
      time: this.time,
      distance: this.distance,
      revision: this.revision,
      profile: this.profile,
      route: this.route,
      events: this.events,
    });
  }
}
