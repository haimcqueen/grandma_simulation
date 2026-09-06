import type { RoomHazardZone } from "./hazards";

/** Contacts with furniture already in the scan; no duplicate decorative meshes. */
export const tantauChairHazards: RoomHazardZone[] = [{
  hazardId: "dining_chair", room: "Dining chair · Trip and fall",
  x: 1.83, z: -0.18, radius: 0.6, chairTrip: true,
  danger: { likelihood: "high", intensity: "high" },
}];
