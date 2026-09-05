import type { HousePoint } from "./house";

export function stairLength(points: HousePoint[]) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y, point.z - points[index].z), 0);
}

/** Distance along the connector is reversible; no room-grid projection during traversal. */
export function sampleStair(points: HousePoint[], progress: number) {
  let remaining = Math.max(0, progress);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining <= length || index === points.length - 1) {
      const t = Math.min(1, remaining / length);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z), index };
    }
    remaining -= length;
  }
  throw new Error("A stair connector needs at least two points.");
}
