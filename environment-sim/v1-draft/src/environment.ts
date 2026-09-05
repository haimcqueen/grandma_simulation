/** Metres, seconds, Y-up. Plan front is +Z; no surveyed orientation is implied. */
export type Point = { x: number; z: number };
export type Rectangle = Point & { width: number; depth: number };
export type HouseObject = Rectangle & {
  id: string;
  kind: "wall" | "furniture";
  height: number;
  color: number;
};
export type Scenario = "clear" | "cart" | "blocked";
export const radius = 0.28;
export const spawn: Point = { x: 5.7, z: 9.4 };
export const destinations = [
  {
    id: "living",
    label: "Living room",
    x: 5.7,
    z: 9.4,
    description: "Return to the lounge",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    x: 6.1,
    z: 14.1,
    description: "Walk around the island",
  },
  {
    id: "patio",
    label: "Patio",
    x: 7.8,
    z: 5.6,
    description: "Step out into the garden",
  },
] as const;
export type DestinationId = (typeof destinations)[number]["id"];
export const floors = [
  {
    id: "adu",
    label: "ATTACHED ADU",
    x: 2.2,
    z: 6.5,
    width: 4.4,
    depth: 13,
    color: 0xd8c9b5,
  },
  {
    id: "great-room",
    label: "LIVING / DINING",
    x: 7.7,
    z: 11,
    width: 6.6,
    depth: 8,
    color: 0xe0ccb0,
  },
  {
    id: "patio",
    label: "COVERED PATIO",
    x: 7.7,
    z: 5.5,
    width: 6.6,
    depth: 3,
    color: 0xd7d7c7,
  },
  {
    id: "garage",
    label: "GARAGE",
    x: 2.9,
    z: 18,
    width: 5.8,
    depth: 6,
    color: 0xc3c7c4,
  },
  {
    id: "stairs",
    label: "STAIRS",
    x: 2.9,
    z: 14,
    width: 5.8,
    depth: 2,
    color: 0xd8c9b5,
  },
  {
    id: "foyer",
    label: "ENTRY",
    x: 6.55,
    z: 18.5,
    width: 1.5,
    depth: 7,
    color: 0xe0ccb0,
  },
  {
    id: "bathroom",
    label: "BATH",
    x: 9.15,
    z: 16.5,
    width: 3.7,
    depth: 3,
    color: 0xcad8d4,
  },
  {
    id: "bedroom",
    label: "BEDROOM",
    x: 9.15,
    z: 20,
    width: 3.7,
    depth: 4,
    color: 0xd8c9b5,
  },
];
const wall = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
): HouseObject => ({
  id,
  x,
  z,
  width,
  depth,
  kind: "wall",
  height: 0.85,
  color: 0xf6f2e9,
});
const furniture = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  color: number,
): HouseObject => ({
  id,
  x,
  z,
  width,
  depth,
  height,
  color,
  kind: "furniture",
});
export const objects: HouseObject[] = [
  wall("adu-west", 0, 6.5, 0.16, 13),
  wall("adu-north", 2.2, 0, 4.4, 0.16),
  wall("adu-east", 4.4, 6.5, 0.16, 13),
  wall("adu-bedroom-divider", 2.2, 3.6, 4.4, 0.14),
  wall("adu-kitchen-divider", 2.2, 8.4, 4.4, 0.14),
  wall("adu-south", 2.2, 13, 4.4, 0.16),
  wall("main-east", 11, 11, 0.16, 8),
  wall("patio-left", 5.3, 7, 1.8, 0.16),
  wall("patio-right", 9.7, 7, 2.6, 0.16),
  wall("main-south-left", 5.1, 15, 1.4, 0.16),
  wall("main-south-right", 9.15, 15, 3.7, 0.16),
  wall("garage-west", 0, 18, 0.16, 6),
  wall("garage-front", 2.9, 21, 5.8, 0.16),
  wall("garage-back", 2.9, 15, 5.8, 0.16),
  wall("garage-east", 5.8, 18, 0.16, 6),
  wall("foyer-front", 6.55, 22, 1.5, 0.16),
  wall("bedroom-front", 9.15, 22, 3.7, 0.16),
  wall("bedroom-east", 11, 20, 0.16, 4),
  wall("bedroom-divider", 9.15, 18, 3.7, 0.16),
  wall("bedroom-entry-left", 7.3, 21, 0.16, 2),
  wall("bedroom-entry-right", 7.3, 18.5, 0.16, 1),
  wall("bath-east", 11, 16.5, 0.16, 3),
  wall("bath-west", 7.3, 16, 0.16, 2),
  furniture("island", 8.15, 12.15, 1.5, 2.7, 0.94, 0xa38262),
  furniture("east-counter", 10.65, 12.4, 0.7, 4.3, 0.92, 0xb49b7c),
  furniture("south-counter", 9.2, 14.65, 2.9, 0.7, 0.92, 0xb49b7c),
  furniture("sofa", 4.95, 9, 0.85, 2.7, 0.65, 0x7e9790),
  furniture("coffee-table", 6.5, 8.8, 0.8, 1, 0.4, 0x82684c),
  furniture("dining-table", 9.6, 8.5, 1.7, 0.8, 0.76, 0xad8a5d),
  furniture("bed-main", 9.2, 20, 1.6, 2.1, 0.48, 0xebe6db),
  furniture("bed-adu-north", 2, 1.8, 1.5, 2, 0.48, 0xebe6db),
  furniture("bed-adu-south", 2, 10.5, 1.5, 2, 0.48, 0xebe6db),
  furniture("adu-counter", 2.2, 7.9, 4, 0.65, 0.9, 0xb49b7c),
  furniture("bath-tub", 9.8, 16.5, 1.8, 0.8, 0.48, 0xf7faf8),
  furniture("stair-volume", 3.7, 14, 3.6, 1.7, 0.2, 0xafa490),
];
export function scenarioObjects(scenario: Scenario): HouseObject[] {
  if (scenario === "clear") return [];
  return [
    furniture(
      "passage-obstruction",
      scenario === "cart" ? 5.75 : 7.7,
      11,
      scenario === "cart" ? 2.5 : 6.6,
      0.65,
      0.8,
      0xc9784e,
    ),
  ];
}
export function contains(point: Point, rectangle: Rectangle, margin = 0) {
  return (
    Math.abs(point.x - rectangle.x) <= rectangle.width / 2 + margin &&
    Math.abs(point.z - rectangle.z) <= rectangle.depth / 2 + margin
  );
}
export function isWalkable(
  point: Point,
  obstacles: HouseObject[],
  clearance = radius,
) {
  // Nine footprint samples prevent a body clipping the edge of the union of floors.
  for (const [dx, dz] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707],
  ]) {
    if (
      !floors.some((floor) =>
        contains(
          { x: point.x + dx * clearance, z: point.z + dz * clearance },
          floor,
        ),
      )
    )
      return false;
  }
  return !obstacles.some((obstacle) => contains(point, obstacle, clearance));
}
