import type { Environment, Point, WorldAsset } from "./contracts";

export type HousePoint = Point & { y: number };
export type HouseFloor = { id: string; label: string; environment: Environment; world: WorldAsset };
export type StairConnection = {
  id: string;
  label: string;
  fromFloor: string;
  toFloor: string;
  points: HousePoint[];
  width: number;
};
export type House = { id: string; floors: HouseFloor[]; connections: StairConnection[] };
export type FloorJourney = {
  connection: StairConnection;
  targetFloor: string;
  destination?: string;
  phase: "approach" | "stairs";
  points: HousePoint[];
  index: number;
  elevation: number;
  progress: number;
  manual: boolean;
};
