/** Simulation frame: metres, seconds, right-handed Y-up; character forward is +Z. */
export type Point = { x: number; z: number };
export type Footprint = Point & { width: number; depth: number };
export type EnvironmentObject = Footprint & {
  id: string;
  label: string;
  kind: "wall" | "sofa" | "table" | "island" | "cabinet" | "obstruction";
  height: number;
};
export type Destination = Point & { id: string; label: string };
export type NavigationGrid = {
  origin: Point;
  cell: number;
  columns: number;
  rows: number;
  clearance: number;
  height: number;
  walkable: number[];
  floorHeights: number[];
};
export type Environment = {
  id: string;
  label: string;
  provenance: string;
  floor: Footprint;
  floorY: number;
  objects: EnvironmentObject[];
  spawn: Point;
  destinations: Destination[];
  passage: Point;
  navigation?: NavigationGrid;
  scenarioFootprints?: { cart: Footprint; blocked: Footprint };
};
export type MovementProfile = { speed: number; radius: number; height: number };
export type Scenario = "clear" | "cart" | "blocked";
export type SimulationEvent = {
  type:
    | "floorRequested"
    | "stairsStarted"
    | "floorReached"
    | "ready"
    | "manualControlStarted"
    | "fallStarted"
    | "fallCompleted"
    | "routeStarted"
    | "routeReplanned"
    | "routeBlocked"
    | "destinationReached"
    | "environmentChanged"
    | "changeRejected"
    | "reset";
  time: number;
  revision: number;
  ids: string[];
  message: string;
};
/** Apply at the asset boundary only. Quaternion ordering is x,y,z,w. */
export type AssetTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
};
export type WorldCutout = { min: [number, number, number]; max: [number, number, number] };
export type WorldAsset = {
  /** Authored openings in simulation world coordinates, applied to appearance and depth. */
  cutouts?: WorldCutout[];
  id: string;
  label: string;
  source: string;
  splatUrl: string;
  colliderUrl: string;
  splatTransform: AssetTransform;
  colliderTransform: AssetTransform;
  metricStatus: "unverified" | "calibrated";
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
};
