import { floors, isWalkable, radius, type Rectangle, type HouseObject, type Point } from "./environment";
const cell = 0.2;
const columns = 56;
const rows = 111;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function segmentClear(a: Point, b: Point, obstacles: HouseObject[], floorRegions: Rectangle[] = floors) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.05));
  for (let i = 0; i <= steps; i++)
    if (
      !isWalkable(
        {
          x: a.x + ((b.x - a.x) * i) / steps,
          z: a.z + ((b.z - a.z) * i) / steps,
        },
        obstacles, radius, floorRegions,
      )
    )
      return false;
  return true;
}
/** A* with conservative clearance, followed by collision-checked line-of-sight pruning. */
export function planRoute(
  start: Point,
  goal: Point,
  obstacles: HouseObject[],
  floorRegions: Rectangle[] = floors,
): Point[] | null {
  if (!isWalkable(start, obstacles, radius, floorRegions) || !isWalkable(goal, obstacles, radius, floorRegions))
    return null;
  if (segmentClear(start, goal, obstacles, floorRegions)) return [{ ...goal }];
  const point = (key: number): Point => ({
    x: (key % columns) * cell,
    z: Math.floor(key / columns) * cell,
  });
  const nearest = (position: Point) => {
    const candidates: number[] = [];
    for (
      let z = Math.max(0, Math.round(position.z / cell) - 2);
      z <= Math.min(rows - 1, Math.round(position.z / cell) + 2);
      z++
    )
      for (
        let x = Math.max(0, Math.round(position.x / cell) - 2);
        x <= Math.min(columns - 1, Math.round(position.x / cell) + 2);
        x++
      )
        candidates.push(z * columns + x);
    return candidates
      .sort(
        (a, b) => distance(point(a), position) - distance(point(b), position),
      )
      .find((key) => segmentClear(position, point(key), obstacles, floorRegions));
  };
  const startKey = nearest(start),
    goalKey = nearest(goal);
  if (startKey === undefined || goalKey === undefined) return null;
  const open = new Set([startKey]);
  const previous = new Map<number, number>();
  const cost = new Map([[startKey, 0]]);
  const closed = new Set<number>();
  const walkable = new Map<number, boolean>();
  const valid = (key: number) => {
    if (!walkable.has(key))
      walkable.set(key, isWalkable(point(key), obstacles, radius, floorRegions));
    return walkable.get(key)!;
  };
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const key of open) {
      const score = cost.get(key)! + distance(point(key), point(goalKey));
      if (score < best) {
        best = score;
        current = key;
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
      const smooth: Point[] = [];
      let anchor = 0;
      while (anchor < raw.length - 1) {
        let next = raw.length - 1;
        while (
          next > anchor + 1 &&
          !segmentClear(raw[anchor], raw[next], obstacles, floorRegions)
        )
          next--;
        smooth.push(raw[next]);
        anchor = next;
      }
      return smooth;
    }
    open.delete(current);
    closed.add(current);
    const x = current % columns,
      z = Math.floor(current / columns);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nx >= columns || nz < 0 || nz >= rows) continue;
      const next = nz * columns + nx;
      if (closed.has(next) || !valid(next)) continue;
      if (dx && dz && (!valid(z * columns + nx) || !valid(nz * columns + x)))
        continue;
      const tentative = cost.get(current)! + Math.hypot(dx, dz) * cell;
      if (tentative < (cost.get(next) ?? Infinity)) {
        cost.set(next, tentative);
        previous.set(next, current);
        open.add(next);
      }
    }
  }
  return null;
}
