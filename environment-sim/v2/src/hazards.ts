/** Shared detection API; every host supplies its own environment's zones. */
export { HazardTracker } from "../../v1-draft/src/hazard-tracker";
export { HAZARD_CATALOG, conditionForSubject, hazardAt, zoneKey } from "../../v1-draft/src/hazards";
export type { Condition, HazardHit, HazardZone, Severity } from "../../v1-draft/src/hazards";
import type { Condition, HazardZone } from "../../v1-draft/src/hazards";

export type HazardProfile = "auto" | "off" | Condition;
export type RoomHazardZone = HazardZone & { chairTrip?: boolean; danger?: import("./fall-danger").FallDanger; propScale?: number; obstacle?: { solidId: string; baseY?: number } };

/** Only authored floor obstacles cause automatic falls; other hazards remain alerts. */
export const hazardFallKinds: Readonly<Record<string, import("./falls").RoomFallKind>> = {
  dining_chair: "sideways",
  ottoman: "trip",
  loose_rug: "trip",
  loose_cords: "trip",
  small_objects_reachable: "sideways",
  slippery_floor: "patio",
};
