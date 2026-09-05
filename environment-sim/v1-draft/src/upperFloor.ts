import type { HouseObject, Rectangle } from "./environment";

/** Traced from the supplied Cubicasa listing plan. Approximate, metres, +Z to plan front.
 * Each level is presented separately; this is not a surveyed stacked alignment.
 * Image coordinates below refer to the supplied 1190 x 1448 reference.
 */
const point = (u: number, v: number) => ({ x: 3 + (u - 738) * 0.019, z: 6 + (v - 350) * 0.019 });
function rect(left: number, top: number, right: number, bottom: number): Rectangle {
  return { ...point((left + right) / 2, (top + bottom) / 2), width: (right - left) * 0.019, depth: (bottom - top) * 0.019 };
}
export const upperFloors = [
  { id: "primary-bedroom", label: "PRIMARY BEDROOM", ...rect(768, 355, 970, 567), color: 0xd8c9b5 },
  { id: "upper-bedroom-west", label: "BEDROOM", ...rect(768, 567, 912, 740), color: 0xd8c9b5 },
  { id: "upper-hall", label: "HALL", ...rect(912, 567, 970, 900), color: 0xd8c9b5 },
  { id: "upper-landing", label: "STAIR LANDING", ...rect(738, 743, 912, 850), color: 0xd8c9b5 },
  { id: "upper-closet-south", label: "CLOSET", ...rect(794, 850, 912, 900), color: 0xd8c9b5 },
  { id: "upper-bedroom-south", label: "BEDROOM", ...rect(794, 900, 970, 1068), color: 0xd8c9b5 },
  { id: "upper-bay", label: "BAY WINDOW", ...rect(830, 1068, 936, 1090), color: 0xd8c9b5 },
  { id: "primary-bath", label: "PRIMARY BATH", ...rect(970, 407, 1044, 595), color: 0xcad8d4 },
  { id: "walk-in-closet", label: "W.I.C.", ...rect(970, 595, 1044, 668), color: 0xd8c9b5 },
  { id: "upper-bath", label: "BATH", ...rect(970, 668, 1044, 800), color: 0xcad8d4 },
];
const wall = (id: string, u1: number, v1: number, u2: number, v2: number): HouseObject => ({
  id, kind: "wall", ...rect(u1, v1, u2, v2), height: 0.85, color: 0xeee9df,
});
const furniture = (id: string, u1: number, v1: number, u2: number, v2: number, height: number): HouseObject => ({
  id, kind: "furniture", ...rect(u1, v1, u2, v2), height, color: 0xc8b79f,
});
export const upperObjects: HouseObject[] = [
  wall("upper-north", 762, 349, 976, 357),
  wall("upper-west", 762, 349, 770, 743),
  wall("primary-east-north", 966, 355, 974, 470),
  wall("primary-east-south", 966, 524, 974, 595),
  wall("primary-divider", 768, 562, 912, 570),
  wall("west-bedroom-east-north", 908, 566, 916, 677),
  wall("west-bedroom-east-south", 908, 730, 916, 744),
  wall("west-bedroom-south", 768, 737, 912, 745),
  wall("bath-outer-north", 970, 403, 1048, 411),
  wall("bath-outer-east", 1040, 407, 1048, 803),
  wall("primary-toilet-divider", 994, 454, 1044, 461),
  wall("closet-north", 970, 590, 1044, 598),
  wall("closet-south", 970, 664, 1044, 672),
  wall("closet-door-north", 966, 595, 974, 605),
  wall("closet-door-south", 966, 658, 974, 680),
  wall("bath-door-south", 966, 735, 974, 802),
  wall("bath-south", 970, 796, 1044, 804),
  wall("hall-east-south", 966, 800, 974, 1068),
  wall("landing-west", 732, 738, 740, 851),
  wall("landing-north", 736, 738, 768, 746),
  wall("landing-south", 736, 846, 912, 854),
  wall("south-closet-west", 788, 850, 796, 1068),
  wall("south-bedroom-entry-left", 794, 896, 914, 904),
  wall("south-bedroom-entry-right", 964, 896, 974, 904),
  wall("bay-left-wing", 794, 1064, 832, 1072),
  wall("bay-right-wing", 934, 1064, 974, 1072),
  wall("bay-left", 826, 1068, 834, 1094),
  wall("bay-right", 932, 1068, 940, 1094),
  wall("bay-front", 830, 1086, 936, 1094),
  // The stair opening is blocked on this flat navigation layer, with a visible guardrail.
  furniture("upper-stair-opening", 744, 752, 870, 836, 0.12),
  furniture("bed-upper-primary", 789, 378, 874, 489, 0.48),
  furniture("bed-upper-west", 787, 586, 860, 696, 0.48),
  furniture("bed-upper-south", 810, 933, 888, 1044, 0.48),
  furniture("primary-vanity-counter", 1017, 469, 1040, 539, 0.88),
  furniture("primary-shower", 978, 549, 1037, 585, 0.06),
  furniture("primary-toilet", 1017, 416, 1038, 450, 0.42),
  furniture("upper-bath-tub", 979, 678, 1038, 707, 0.5),
  furniture("upper-vanity-counter", 1016, 753, 1038, 790, 0.88),
];
export const upperSpawn = point(940, 827);
export const upperDestinations = [
  { id: "primary", label: "Primary bedroom", ...point(930, 515), description: "Explore the primary suite" },
  { id: "bedroom-west", label: "Middle bedroom", ...point(884, 625), description: "Bedroom beside the landing" },
  { id: "bedroom-south", label: "Front bedroom", ...point(938, 1000), description: "Bedroom with the bay window" },
  { id: "landing", label: "Stair landing", ...upperSpawn, description: "Return to the upstairs hall" },
] as const;
