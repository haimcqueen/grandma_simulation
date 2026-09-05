import type { Environment } from "./contracts";
import { isWalkable } from "./environment";
import { planRoute } from "./navigation";
import { HAZARD_CATALOG } from "./hazards";

/** Load semantic anchors and navigation independently of the visual world asset. */
export async function loadSimulationEnvironment(url: string): Promise<Environment> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Room movement configuration is unavailable.");
  const descriptor = await response.json();
  const navigationResponse = await fetch(descriptor.navigationUrl);
  if (!navigationResponse.ok) throw new Error("Room navigation data is unavailable.");
  const { navigationUrl: _, ...environment } = descriptor;
  environment.navigation = await navigationResponse.json();
  validateSimulationEnvironment(environment);
  return environment;
}

export function validateSimulationEnvironment(environment: Environment) {
  for (const zone of environment.hazardZones ?? []) {
    if (!HAZARD_CATALOG.some(hazard => hazard.id === zone.hazardId) ||
        ![zone.x, zone.z, zone.radius, zone.propScale ?? 1].every(Number.isFinite) ||
        zone.radius <= 0 || (zone.propScale ?? 1) <= 0 || !zone.room?.trim())
      throw new Error("A room hazard zone has an invalid definition.");
  }
  const grid = environment.navigation;
  if (!grid || grid.walkable.length !== grid.columns * grid.rows ||
      grid.floorHeights.length !== grid.walkable.length || grid.clearance < 0.28 || grid.height < 1.7) {
    throw new Error("Navigation data does not support the resident's movement profile.");
  }
  if (!isWalkable(environment, environment.spawn, environment.objects, 0.28))
    throw new Error("The resident spawn is not walkable.");
  if (!environment.destinations.length || environment.destinations.some((destination) =>
    !planRoute(environment, environment.spawn, destination, environment.objects, 0.28)))
    throw new Error("A room destination is unreachable from the spawn.");
}
