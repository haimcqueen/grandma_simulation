import { parseWorldAsset } from "./asset-manifest";
import { loadSimulationEnvironment } from "./simulation-environment";
import { isWalkable } from "./environment";
import type { House } from "./house";

export async function loadHouse(url: string): Promise<House> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("House manifest is unavailable.");
  const manifest = await response.json();
  const floors = await Promise.all(manifest.floors.map(async (floor: {id: string; label: string; worldUrl: string; environmentUrl: string}) => {
    const response = await fetch(floor.worldUrl);
    if (!response.ok) throw new Error(`World for ${floor.label} is unavailable.`);
    return { id: floor.id, label: floor.label, world: parseWorldAsset(await response.json()), environment: await loadSimulationEnvironment(floor.environmentUrl) };
  }));
  const house: House = { id: manifest.id, floors, connections: manifest.connections };
  validateHouse(house);
  return house;
}
export function validateHouse(house: House) {
  if (!house.floors.length || new Set(house.floors.map(floor => floor.id)).size !== house.floors.length || new Set(house.floors.map(floor => floor.environment.id)).size !== house.floors.length)
    throw new Error("House floors and their environments need unique IDs.");
  if (new Set(house.connections.map(link => link.id)).size !== house.connections.length)
    throw new Error("Stair connections need unique IDs.");
  for (const link of house.connections) {
    if (link.fromFloor === link.toFloor || link.points.length < 2 || !Number.isFinite(link.width) || link.width < 0.56 || !link.points.every(p => [p.x, p.y, p.z].every(Number.isFinite)))
      throw new Error("Stair connection geometry is invalid.");
    if (link.points.slice(1).some((point, index) => Math.hypot(point.x - link.points[index].x, point.z - link.points[index].z) < 0.001))
      throw new Error("Stairs need horizontal travel between each pair of points.");
    for (const [floorId, point] of [[link.fromFloor, link.points[0]], [link.toFloor, link.points.at(-1)!]] as const) {
      const floor = house.floors.find(floor => floor.id === floorId);
      if (!floor || !isWalkable(floor.environment, point, floor.environment.objects, 0.28))
        throw new Error(`Stair endpoint ${floorId} is not supported by its floor navigation.`);
      if (Math.abs(point.y - floor.environment.floorY) > 0.16) throw new Error("Stair endpoint height does not match the floor.");
    }
  }
}
