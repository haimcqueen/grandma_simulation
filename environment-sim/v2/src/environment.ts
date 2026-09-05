import { gridWalkable } from "./navigation-grid";
import type {
  Environment,
  EnvironmentObject,
  Footprint,
  Point,
  Scenario,
  WorldAsset,
} from "./contracts";

const object = (
  id: string,
  label: string,
  kind: EnvironmentObject["kind"],
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
): EnvironmentObject => ({ id, label, kind, x, z, width, depth, height });

/** An authored integration fixture, inspired by listing finishes. Dimensions are estimates. */
export const tantauFixture: Environment = {
  id: "tantau-great-room-fixture",
  label: "Living & kitchen",
  provenance:
    "Authored approximation · listing-inspired materials, estimated layout",
  floor: { x: 4, z: 4.5, width: 8, depth: 9 },
  floorY: 0,
  spawn: { x: 3.2, z: 2.5 },
  passage: { x: 3.2, z: 4.6 },
  destinations: [
    { id: "living", label: "Living room", x: 3.2, z: 2.5 },
    { id: "kitchen", label: "Kitchen", x: 3.2, z: 7.4 },
    { id: "dining", label: "Dining area", x: 6.6, z: 3.1 },
  ],
  objects: [
    object("west-wall", "Fireplace wall", "wall", 0, 4.5, 0.14, 9, 3.05),
    object("east-wall", "Kitchen wall", "wall", 8, 4.5, 0.14, 9, 3.05),
    object("north-wall", "Cabinet wall", "wall", 4, 9, 8, 0.14, 3.05),
    object("sofa", "Cream sofa", "sofa", 1.3, 2.4, 1.1, 2.7, 0.78),
    object("coffee-table", "Coffee table", "table", 2.8, 1.4, 1.05, 0.75, 0.36),
    object("dining-table", "Dining table", "table", 6.4, 1.8, 1.8, 0.9, 0.75),
    object(
      "island",
      "Quartz waterfall island",
      "island",
      5.2,
      6.1,
      1.45,
      2.7,
      0.94,
    ),
    object(
      "kitchen-counter",
      "Walnut kitchen counter",
      "cabinet",
      7.55,
      6.45,
      0.7,
      4.5,
      0.92,
    ),
    object(
      "cabinet-bank",
      "Tall walnut cabinets",
      "cabinet",
      5.4,
      8.55,
      4.8,
      0.7,
      2.65,
    ),
  ],
};

export function scenarioObjects(
  environment: Environment,
  scenario: Scenario,
): EnvironmentObject[] {
  if (scenario === "clear") return [];
  const blocked = scenario === "blocked";
  if (environment.scenarioFootprints) {
    const footprint =
      environment.scenarioFootprints[blocked ? "blocked" : "cart"];
    return [
      {
        ...footprint,
        id: "passage-obstruction",
        label: blocked ? "Passage barrier" : "Storage cart",
        kind: "obstruction",
        height: 0.82,
      },
    ];
  }
  return [
    object(
      "passage-obstruction",
      blocked ? "Passage barrier" : "Storage cart",
      "obstruction",
      blocked ? environment.floor.x : environment.passage.x,
      environment.passage.z,
      blocked ? environment.floor.width : 1.65,
      0.65,
      0.82,
    ),
  ];
}

export function contains(point: Point, rectangle: Footprint, margin = 0) {
  return (
    Math.abs(point.x - rectangle.x) <= rectangle.width / 2 + margin &&
    Math.abs(point.z - rectangle.z) <= rectangle.depth / 2 + margin
  );
}

export function isWalkable(
  environment: Environment,
  point: Point,
  obstacles: EnvironmentObject[],
  radius: number,
) {
  const floor = environment.floor;
  return (
    Math.abs(point.x - floor.x) <= floor.width / 2 - radius &&
    Math.abs(point.z - floor.z) <= floor.depth / 2 - radius &&
    (!environment.navigation ||
      gridWalkable(environment.navigation, point, radius)) &&
    !obstacles.some((obstacle) => contains(point, obstacle, radius))
  );
}

export const sampleWorld: WorldAsset = {
  id: "official-rustic-kitchen",
  label: "World Labs sample",
  source: "Official export sample · not the Tantau house",
  splatUrl: "/samples/kitchen.spz",
  colliderUrl: "/samples/kitchen-collider.glb",
  splatTransform: { position: [0, 0, 0], quaternion: [1, 0, 0, 0], scale: 1 },
  colliderTransform: {
    position: [0, 0, 0],
    quaternion: [1, 0, 0, 0],
    scale: 1,
  },
  metricStatus: "unverified",
  camera: { position: [0, 0, 0], target: [2, -0.25, -1] },
};
