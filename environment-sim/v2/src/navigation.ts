import {
  gridSegmentClear,
  segmentIntersectsRectangle,
} from "./navigation-grid";
import type { Environment, EnvironmentObject, Point } from "./contracts";
import { isWalkable } from "./environment";
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function segmentClear(
  environment: Environment,
  a: Point,
  b: Point,
  objects: EnvironmentObject[],
  radius: number,
) {
  if (
    !isWalkable(environment, a, objects, radius) ||
    !isWalkable(environment, b, objects, radius)
  )
    return false;
  if (environment.navigation && !gridSegmentClear(environment.navigation, a, b))
    return false;
  return !objects.some((object) =>
    segmentIntersectsRectangle(a, b, object, radius),
  );
}

/** Bounded A*, with every connection and simplified segment checked against body clearance. */
export function planRoute(
  environment: Environment,
  start: Point,
  goal: Point,
  objects: EnvironmentObject[],
  radius: number,
): Point[] | null {
  const clear = (a: Point, b: Point) =>
    segmentClear(environment, a, b, objects, radius);
  if (
    !isWalkable(environment, start, objects, radius) ||
    !isWalkable(environment, goal, objects, radius)
  )
    return null;
  if (clear(start, goal)) return [{ ...goal }];
  const cell = environment.navigation?.cell ?? 0.2,
    floor = environment.floor;
  const minimumX = environment.navigation
      ? environment.navigation.origin.x + cell / 2
      : floor.x - floor.width / 2,
    minimumZ = environment.navigation
      ? environment.navigation.origin.z + cell / 2
      : floor.z - floor.depth / 2;
  const columns =
      environment.navigation?.columns ?? Math.ceil(floor.width / cell) + 1,
    rows = environment.navigation?.rows ?? Math.ceil(floor.depth / cell) + 1;
  const point = (key: number): Point => ({
    x: minimumX + (key % columns) * cell,
    z: minimumZ + Math.floor(key / columns) * cell,
  });
  const nearest = (position: Point) => {
    const x = Math.round((position.x - minimumX) / cell),
      z = Math.round((position.z - minimumZ) / cell);
    const candidates: number[] = [];
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        if (x + dx >= 0 && x + dx < columns && z + dz >= 0 && z + dz < rows)
          candidates.push((z + dz) * columns + x + dx);
      }
    return candidates
      .sort(
        (a, b) => distance(position, point(a)) - distance(position, point(b)),
      )
      .find((key) => clear(position, point(key)));
  };
  const startKey = nearest(start),
    goalKey = nearest(goal);
  if (startKey === undefined || goalKey === undefined) return null;
  const open = new Set([startKey]),
    closed = new Set<number>();
  const costs = new Map([[startKey, 0]]),
    previous = new Map<number, number>();
  while (open.size) {
    let current = -1,
      score = Infinity;
    for (const key of open) {
      const candidate = costs.get(key)! + distance(point(key), point(goalKey));
      if (candidate < score) {
        current = key;
        score = candidate;
      }
    }
    if (current === goalKey) {
      const raw: Point[] = [{ ...goal }, point(current)];
      while (previous.has(current)) {
        current = previous.get(current)!;
        raw.push(point(current));
      }
      raw.push({ ...start });
      raw.reverse();
      const result: Point[] = [];
      for (let anchor = 0; anchor < raw.length - 1; ) {
        let next = raw.length - 1;
        while (next > anchor + 1 && !clear(raw[anchor], raw[next])) next--;
        result.push(raw[next]);
        anchor = next;
      }
      return result;
    }
    open.delete(current);
    closed.add(current);
    const x = current % columns,
      z = Math.floor(current / columns);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          nz = z + dz,
          next = nz * columns + nx;
        if (
          (!dx && !dz) ||
          nx < 0 ||
          nx >= columns ||
          nz < 0 ||
          nz >= rows ||
          closed.has(next) ||
          !clear(point(current), point(next))
        )
          continue;
        const cost = costs.get(current)! + Math.hypot(dx, dz) * cell;
        if (cost < (costs.get(next) ?? Infinity)) {
          costs.set(next, cost);
          previous.set(next, current);
          open.add(next);
        }
      }
  }
  return null;
}
