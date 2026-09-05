import type {
  NavigationGrid,
  Point,
  Footprint,
  Environment,
} from "./contracts";

export function gridIndex(grid: NavigationGrid, point: Point) {
  const x = Math.floor((point.x - grid.origin.x) / grid.cell),
    z = Math.floor((point.z - grid.origin.z) / grid.cell);
  return x < 0 || z < 0 || x >= grid.columns || z >= grid.rows
    ? -1
    : z * grid.columns + x;
}
export function gridWalkable(
  grid: NavigationGrid,
  point: Point,
  radius: number,
) {
  return (
    radius <= grid.clearance && grid.walkable[gridIndex(grid, point)] === 1
  );
}
export function floorHeightAt(environment: Environment, point: Point) {
  if (!environment.navigation) return environment.floorY;
  const grid = environment.navigation;
  return grid.floorHeights[gridIndex(grid, point)] ?? environment.floorY;
}
export function segmentIntersectsRectangle(
  a: Point,
  b: Point,
  object: Footprint,
  margin = 0,
) {
  let enter = 0,
    exit = 1;
  for (const [axis, size] of [
    ["x", "width"],
    ["z", "depth"],
  ] as const) {
    const minimum = object[axis] - object[size] / 2 - margin,
      maximum = object[axis] + object[size] / 2 + margin,
      delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-12) {
      if (a[axis] < minimum || a[axis] > maximum) return false;
    } else {
      const first = (minimum - a[axis]) / delta,
        second = (maximum - a[axis]) / delta;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (enter > exit) return false;
    }
  }
  return enter <= exit;
}
export function gridSegmentClear(grid: NavigationGrid, a: Point, b: Point) {
  const minX = Math.max(
    0,
    Math.floor((Math.min(a.x, b.x) - grid.origin.x) / grid.cell),
  );
  const maxX = Math.min(
    grid.columns - 1,
    Math.floor((Math.max(a.x, b.x) - grid.origin.x) / grid.cell),
  );
  const minZ = Math.max(
    0,
    Math.floor((Math.min(a.z, b.z) - grid.origin.z) / grid.cell),
  );
  const maxZ = Math.min(
    grid.rows - 1,
    Math.floor((Math.max(a.z, b.z) - grid.origin.z) / grid.cell),
  );
  for (let z = minZ; z <= maxZ; z++)
    for (let x = minX; x <= maxX; x++) {
      if (
        !grid.walkable[z * grid.columns + x] &&
        segmentIntersectsRectangle(a, b, {
          x: grid.origin.x + (x + 0.5) * grid.cell,
          z: grid.origin.z + (z + 0.5) * grid.cell,
          width: grid.cell,
          depth: grid.cell,
        })
      )
        return false;
    }
  return true;
}
