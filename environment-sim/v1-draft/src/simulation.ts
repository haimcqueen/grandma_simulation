import {
  destinations,
  objects,
  scenarioObjects,
  spawn,
  isWalkable,
  type Point,
  type DestinationId,
  type Scenario,
} from "./environment";
import { planRoute } from "./navigation";
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
  status: "idle" | "walking" | "arrived" | "blocked" = "idle";
  paused = false;
  speed = 0.9;
  time = 0;
  distance = 0;
  revision = 0;
  events: SimulationEvent[] = [];
  get obstacles() {
    return [...objects, ...scenarioObjects(this.scenario)];
  }
  constructor() {
    this.record("ready", "Resident ready in the living room.", ["resident-01"]);
  }
  private record(type: string, message: string, ids: string[]) {
    this.events.unshift({ time: this.time, type, message, ids });
    this.events = this.events.slice(0, 30);
  }
  requestDestination(id: DestinationId) {
    this.destination = id;
    this.replan(false);
  }
  private replan(changed: boolean) {
    const target = destinations.find((item) => item.id === this.destination);
    if (!target) return;
    const route = planRoute(this.position, target, this.obstacles);
    this.route = route ?? [];
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
    if (this.destination && this.status !== "arrived") this.replan(true);
    return true;
  }
  advance(delta: number) {
    if (this.paused) return;
    this.time += delta;
    if (this.status !== "walking") return;
    let remaining = this.speed * delta;
    while (remaining > 0 && this.route.length) {
      const next = this.route[0],
        dx = next.x - this.position.x,
        dz = next.z - this.position.z,
        length = Math.hypot(dx, dz);
      if (length < 0.00001) {
        this.route.shift();
        continue;
      }
      this.heading = Math.atan2(dx, dz);
      const travel = Math.min(length, remaining);
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
    this.paused = false;
    this.time = 0;
    this.distance = 0;
    this.events = [];
    this.revision++;
    this.record(
      "reset",
      "Resident reset; scenario and walking speed preserved.",
      ["resident-01"],
    );
  }
}
