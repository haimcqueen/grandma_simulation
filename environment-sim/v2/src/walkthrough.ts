import type { House } from "./house";
import type { Environment } from "./contracts";
import type { RoomHazardZone } from "./hazards";
import { Simulation } from "./simulation";

/** A manual-only room session. Source environment data remains reusable by other hosts. */
export function createWalkthroughSimulation(environment: Environment, hazards: RoomHazardZone[] = []) {
  const simulation = new Simulation({ ...environment, hazardZones: hazards, destinations: [] });
  simulation.autoHazardFalls = hazards.length > 0;
  simulation.setHazardProfile(hazards.length ? "auto" : "off");
  simulation.setManual();
  return simulation;
}

export const walkthroughViews = [
  { id: "first", label: "First person", shortcut: "F" },
  { id: "follow", label: "Third person", shortcut: "V" },
  { id: "overview", label: "Wide", shortcut: "B" },
  { id: "map", label: "Map", shortcut: "M" },
] as const;
export type WalkthroughView = typeof walkthroughViews[number]["id"];

/** Clear demonstration annotations on every floor, preserving the source house. */
export function createHouseWalkthrough(source: House) {
  const house: House = { ...source, floors: source.floors.map(floor => ({
    ...floor, environment: { ...floor.environment, hazardZones: [], destinations: [] },
  })) };
  const simulation = createWalkthroughSimulation(house.floors[0].environment);
  simulation.configureHouse(house, house.floors[0].id);
  return { house, simulation };
}
