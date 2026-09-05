import { GROUND_FALL_DURATIONS, groundFallFrame } from "../../v1-draft/src/robot/fall-motion";

/** Room-local demos. No patio, balcony or stair coordinates are imported. */
export const roomFalls = [
  { id: "trip", label: "Trip forward", description: "Lose footing, pitch forward and brace with the hands." },
  { id: "patio", label: "Slip backward", description: "Feet slide forward as the body falls backward." },
  { id: "sideways", label: "Lose balance sideways", description: "Sway sideways and land on the hip and shoulder." },
] as const;
export type RoomFallKind = typeof roomFalls[number]["id"];
export type RoomFall = { kind: RoomFallKind; elapsed: number };
export const roomFallFrame = (fall: RoomFall) => groundFallFrame(fall.kind, fall.elapsed);
export const roomFallDuration = (kind: RoomFallKind) => GROUND_FALL_DURATIONS[kind];
