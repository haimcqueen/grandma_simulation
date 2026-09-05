import type { Simulation } from "./simulation";

/** A repeatable tour; its clock is the simulation clock, including pause and reset. */
export class WalkingRoutine {
  active = false;
  private destinationIndex = 0;
  private arrivedAt: number | undefined;
  constructor(private readonly simulation: Simulation) {}
  start() {
    this.active = true;
    this.arrivedAt = undefined;
    const destinations = this.simulation.environment.destinations;
    const current = destinations.findIndex((destination) =>
      Math.hypot(destination.x - this.simulation.position.x, destination.z - this.simulation.position.z) < 0.1);
    this.destinationIndex = (current + 1) % destinations.length;
    this.simulation.requestDestination(destinations[this.destinationIndex].id);
  }
  stop() { this.active = false; this.arrivedAt = undefined; }
  advance() {
    if (!this.active || this.simulation.paused || this.simulation.status !== "arrived") return;
    this.arrivedAt ??= this.simulation.time;
    if (this.simulation.time - this.arrivedAt < 1.5) return;
    this.destinationIndex = (this.destinationIndex + 1) % this.simulation.environment.destinations.length;
    this.arrivedAt = undefined;
    this.simulation.requestDestination(this.simulation.environment.destinations[this.destinationIndex].id);
  }
}
