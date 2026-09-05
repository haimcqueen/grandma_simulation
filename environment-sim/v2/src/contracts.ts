/** Simulation frame: metres, seconds, right-handed Y-up; character forward is +Z. */
import type { RoomHazardZone } from "./hazards";
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
  hazardZones?: RoomHazardZone[];
};
export type MovementProfile = { speed: number; radius: number; height: number };
export type Scenario = "clear" | "cart" | "blocked";
export type SimulationEvent = {
  type:
    | "ready"
    | "manualControlStarted"
    | "fallStarted"
    | "fallCompleted"
    | "hazardEncountered"
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
export type WorldAsset = {
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
