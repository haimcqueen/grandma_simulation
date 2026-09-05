import type { FloorLevel, Point } from "./environment";

/** Authored U-shaped staircase fitted to the traced upstairs stair opening.
 * 18 risers × 0.17 m. Not a measured stair survey or balance simulation.
 */
export const FLOOR_RISE = 3.06;
export const STAIR_ENTRY: Record<FloorLevel, Point> = {
  ground: { x: 6.5, z: 14.5 },
  upper: { x: 6.55, z: 13.95 },
};
export type StairPoint = Point & { y: number };
export const STAIR_ROUTE: StairPoint[] = [
  { ...STAIR_ENTRY.ground, y: 0 },
  { x: 5.508, z: 14.5, y: 0 },
  { x: 3.7, z: 14.5, y: FLOOR_RISE / 2 },
  { x: 3.42, z: 14.5, y: FLOOR_RISE / 2 },
  { x: 3.42, z: 13.95, y: FLOOR_RISE / 2 },
  { x: 3.7, z: 13.95, y: FLOOR_RISE / 2 },
  { x: 5.508, z: 13.95, y: FLOOR_RISE },
  { ...STAIR_ENTRY.upper, y: FLOOR_RISE },
];
