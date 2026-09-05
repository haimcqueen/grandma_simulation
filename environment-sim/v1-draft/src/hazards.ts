/**
 * Household hazard catalog and hand-placed zones for this specific floor
 * plan (environment.ts). Every zone here is hand-authored against this
 * house's geometry — nothing is detected from imagery or collider meshes.
 * See PROJECT_CONTEXT.md §8: no unexplained danger scores, no inferring
 * mobility from age or appearance beyond the two named conditions below.
 */

export type Severity = "none" | "low" | "medium" | "high" | "critical";
export type Condition = "elderly" | "toddler";

export interface HazardConditionInfo {
  severity: Severity;
  reason: string;
}

export interface HazardDef {
  id: string;
  object: string;
  category: string;
  elderly: HazardConditionInfo;
  toddler: HazardConditionInfo;
}

/** Where a hazard could appear in this house, and how far its exposure reaches. */
export interface HazardZone {
  hazardId: string;
  x: number;
  z: number;
  radius: number;
  room: string;
}

export interface HazardHit {
  zone: HazardZone;
  hazard: HazardDef;
  condition: Condition;
  severity: Severity;
  reason: string;
}

/**
 * severity reflects likelihood x consequence for that condition in a home
 * setting. `reason` is written to be shown to the end user verbatim.
 */
export const HAZARD_CATALOG: HazardDef[] = [
  {
    id: "ottoman", object: "Ottoman in the walking path", category: "falls_mobility",
    elderly: { severity: "medium", reason: "Authored demo: a foot catches the low furniture." },
    toddler: { severity: "low", reason: "Low furniture in the walking path." },
  },
  {
    id: "loose_rug", object: "Loose rug, runner, or curled rug edge", category: "falls_mobility",
    elderly: { severity: "high", reason: "Trip hazard; falls in older adults carry high injury risk (hip fractures)." },
    toddler: { severity: "medium", reason: "Can trip during play or running, but fall height/impact risk is lower." },
  },
  {
    id: "loose_cords", object: "Cords or cables crossing a walkway", category: "falls_mobility",
    elderly: { severity: "high", reason: "Hard to see and easy to catch a foot or mobility aid on." },
    toddler: { severity: "medium", reason: "Trip risk, plus toddlers may chew or pull on cords." },
  },
  {
    id: "slippery_floor", object: "Slippery floor surface (hardwood, tile, freshly mopped)", category: "falls_mobility",
    elderly: { severity: "high", reason: "Reduced balance and reaction time increase fall risk on slick surfaces." },
    toddler: { severity: "medium", reason: "Toddlers fall often regardless, but slippery floors increase frequency/severity." },
  },
  {
    id: "stairs_no_rail", object: "Stairs without handrails or with poor lighting", category: "falls_mobility",
    elderly: { severity: "critical", reason: "No support during descent/ascent; among the highest-risk fall locations." },
    toddler: { severity: "critical", reason: "Falls down stairs are a leading injury cause for young children without gates." },
  },
  {
    id: "uneven_threshold", object: "Uneven thresholds or transitions between rooms", category: "falls_mobility",
    elderly: { severity: "medium", reason: "Easy to catch a foot, especially with reduced mobility or an aid." },
    toddler: { severity: "low", reason: "Minor trip risk during early walking stages." },
  },
  {
    id: "low_sharp_furniture", object: "Low furniture with sharp/hard corners", category: "falls_mobility",
    elderly: { severity: "medium", reason: "Shin/knee-height impact hazard if balance is lost nearby." },
    toddler: { severity: "high", reason: "Head-height for a toddler; common source of head injuries." },
  },
  {
    id: "missing_grab_bars", object: "Bathtub/shower without grab bars or non-slip mat", category: "falls_mobility",
    elderly: { severity: "critical", reason: "Wet, hard surfaces plus no support; a leading location for serious falls." },
    toddler: { severity: "none", reason: "Not a toddler-specific concern (assumes supervised bathing)." },
  },
  {
    id: "missing_baby_gate", object: "Missing baby gate at stairs or room boundary", category: "falls_mobility",
    elderly: { severity: "none", reason: "Not relevant to this condition." },
    toddler: { severity: "critical", reason: "Primary safeguard against unsupervised stair falls." },
  },
  {
    id: "climbable_tipover_furniture", object: "Unanchored bookshelf, dresser, or TV stand", category: "falls_mobility",
    elderly: { severity: "low", reason: "Could be used (unsafely) as a handhold, but tip-over risk is lower." },
    toddler: { severity: "critical", reason: "Climbing can cause furniture/TV tip-over; well-documented injury/fatality risk." },
  },
  {
    id: "high_shelf_reach", object: "High cabinet or shelf requiring reaching/stretching", category: "reach_grip",
    elderly: { severity: "high", reason: "Overreaching or using an unstable step stool risks a fall." },
    toddler: { severity: "medium", reason: "May climb furniture to reach, risking a fall." },
  },
  {
    id: "round_doorknob", object: "Round doorknob (vs. lever handle)", category: "reach_grip",
    elderly: { severity: "medium", reason: "Difficult to grip/turn with arthritis or reduced hand strength." },
    toddler: { severity: "none", reason: "Not a toddler-specific hazard (though may limit their access, which can be desirable)." },
  },
  {
    id: "heavy_door", object: "Heavy door (exterior or fire-rated)", category: "reach_grip",
    elderly: { severity: "medium", reason: "Difficult to open/control, risk of losing balance while pushing/pulling." },
    toddler: { severity: "low", reason: "May struggle to open, generally low risk." },
  },
  {
    id: "low_unlocked_cabinet_hazmat", object: "Low, unlocked cabinet with cleaning supplies or medications", category: "reach_grip",
    elderly: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
    toddler: { severity: "critical", reason: "Leading cause of accidental poisoning in young children." },
  },
  {
    id: "unsecured_drawers", object: "Unsecured drawers (full pull-out or pinch risk)", category: "reach_grip",
    elderly: { severity: "low", reason: "Minor risk if a drawer is pulled fully out unexpectedly." },
    toddler: { severity: "medium", reason: "Pinch injuries and full pull-out tip risk on lightweight units." },
  },
  {
    id: "stove_knobs_reachable", object: "Stove knobs within toddler reach", category: "kitchen",
    elderly: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
    toddler: { severity: "critical", reason: "Can turn on burners; burn/fire risk." },
  },
  {
    id: "pot_handles_outward", object: "Pot/pan handles turned outward on the stove", category: "kitchen",
    elderly: { severity: "low", reason: "Minor bump/spill risk while moving through the kitchen." },
    toddler: { severity: "critical", reason: "Toddlers can grab and pull hot contents onto themselves." },
  },
  {
    id: "hot_items_counter_edge", object: "Hot liquids or appliances near counter edge", category: "kitchen",
    elderly: { severity: "medium", reason: "Spill/burn risk if balance is unsteady while reaching." },
    toddler: { severity: "high", reason: "Within reach or pull-down range; scald risk." },
  },
  {
    id: "heavy_cookware_storage", object: "Heavy cookware stored very low or very high", category: "kitchen",
    elderly: { severity: "medium", reason: "Strain or drop risk when lifting from awkward heights." },
    toddler: { severity: "low", reason: "Low storage may be accessible and heavy to pull down." },
  },
  {
    id: "uncovered_outlets", object: "Uncovered electrical outlets", category: "electrical_small_parts",
    elderly: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
    toddler: { severity: "high", reason: "Shock/electrocution risk from exploring with objects or fingers." },
  },
  {
    id: "small_objects_reachable", object: "Small objects within toddler reach", category: "electrical_small_parts",
    elderly: { severity: "low", reason: "Minor trip hazard if underfoot." },
    toddler: { severity: "high", reason: "Choking hazard." },
  },
  {
    id: "blind_cords", object: "Blind/curtain cords with a loop", category: "electrical_small_parts",
    elderly: { severity: "low", reason: "Minor entanglement/trip risk." },
    toddler: { severity: "high", reason: "Strangulation risk; well-documented hazard for young children." },
  },
  {
    id: "frayed_cords", object: "Frayed cords or overloaded outlets", category: "electrical_small_parts",
    elderly: { severity: "medium", reason: "Fire risk affects all occupants; may also be a trip hazard." },
    toddler: { severity: "medium", reason: "Fire risk affects all occupants; also explorable/chewable hazard." },
  },
  {
    id: "dim_hallway_stairs", object: "Dim hallway, staircase, or missing nightlight", category: "lighting_visibility",
    elderly: { severity: "high", reason: "Reduced night vision significantly raises nighttime fall risk." },
    toddler: { severity: "low", reason: "General navigation difficulty, lower injury severity typically." },
  },
  {
    id: "poor_stair_contrast", object: "Poor color contrast on stair edges", category: "lighting_visibility",
    elderly: { severity: "medium", reason: "Harder to judge step edges with reduced visual acuity/contrast sensitivity." },
    toddler: { severity: "low", reason: "Minor factor compared to overall stair-access risk (see missing_baby_gate)." },
  },
  {
    id: "glare_reflective_floor", object: "Glare from windows or reflective flooring", category: "lighting_visibility",
    elderly: { severity: "medium", reason: "Can obscure floor hazards or depth perception." },
    toddler: { severity: "none", reason: "Not a meaningful condition-specific hazard." },
  },
  {
    id: "unlocked_toilet_lid", object: "Unlocked toilet lid", category: "water_bathroom",
    elderly: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
    toddler: { severity: "high", reason: "Drowning risk for young children, especially toddlers." },
  },
  {
    id: "water_heater_too_hot", object: "Water heater set above safe scald threshold", category: "water_bathroom",
    elderly: { severity: "medium", reason: "Thinner skin increases scald severity; slower reaction to hot water." },
    toddler: { severity: "high", reason: "Thin skin and slower self-rescue increase scald severity." },
  },
  {
    id: "unstable_step_stool", object: "Unstable step stool or chair used for reaching", category: "furniture_tipover",
    elderly: { severity: "high", reason: "Common cause of falls when used to reach high storage." },
    toddler: { severity: "high", reason: "Often used to reach counters/cabinets; tip/fall risk." },
  },
  {
    id: "unstable_recliner", object: "Unstable or reclining chair", category: "furniture_tipover",
    elderly: { severity: "medium", reason: "Risk of misjudging seat position or chair movement while sitting/standing." },
    toddler: { severity: "medium", reason: "Risk of tipping while climbing on or playing near it." },
  },
  {
    id: "obstructed_doorway", object: "Doorway obstructed or too narrow for mobility aid", category: "doors_exits",
    elderly: { severity: "high", reason: "Prevents safe passage with a walker, cane, or wheelchair." },
    toddler: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
  },
  {
    id: "accessible_exterior_door", object: "Exterior/screen door a toddler could open unsupervised", category: "doors_exits",
    elderly: { severity: "none", reason: "Not a condition-specific hazard for this profile." },
    toddler: { severity: "high", reason: "Risk of unsupervised access to outdoor hazards (streets, pools)." },
  },
];

const catalogById = new Map(HAZARD_CATALOG.map((h) => [h.id, h]));

/**
 * Hand-placed against this house's floor plan (environment.ts). Positions
 * are metres in the same right-handed, Y-up, plan-front-is-+Z coordinate
 * system as the rest of the scene. Radii are illustrative exposure ranges,
 * not measured envelopes.
 */
export const HAZARD_ZONES: HazardZone[] = [
  // Kitchen — placed at the island's counter edges and the real stove
  // (the burner rings already rendered on the east counter in scene.ts), so
  // the walk-up matches what's visually there.
  { hazardId: "hot_items_counter_edge", x: 7.5, z: 11.3, radius: 1.1, room: "Kitchen" },
  { hazardId: "low_unlocked_cabinet_hazmat", x: 8.15, z: 13.2, radius: 1.0, room: "Kitchen" },
  { hazardId: "small_objects_reachable", x: 6.8, z: 12.6, radius: 1.1, room: "Kitchen" },
  { hazardId: "heavy_cookware_storage", x: 8.15, z: 11.0, radius: 1.0, room: "Kitchen" },
  { hazardId: "uncovered_outlets", x: 10.0, z: 12.0, radius: 0.8, room: "Kitchen" },
  { hazardId: "stove_knobs_reachable", x: 10.3, z: 12.4, radius: 1.0, room: "Kitchen" },
  { hazardId: "pot_handles_outward", x: 10.4, z: 12.3, radius: 0.9, room: "Kitchen" },
  { hazardId: "unsecured_drawers", x: 9.2, z: 14.3, radius: 0.8, room: "Kitchen" },

  // Living / dining
  { hazardId: "loose_rug", x: 6.5, z: 8.8, radius: 0.9, room: "Living room" },
  { hazardId: "low_sharp_furniture", x: 6.9, z: 9.3, radius: 0.55, room: "Living room" },
  { hazardId: "loose_cords", x: 4.9, z: 7.6, radius: 0.9, room: "Living room" },
  { hazardId: "unstable_recliner", x: 4.6, z: 10.6, radius: 0.9, room: "Living room" },
  { hazardId: "climbable_tipover_furniture", x: 10.3, z: 9.4, radius: 1.0, room: "Living room" },
  { hazardId: "glare_reflective_floor", x: 7.5, z: 7.3, radius: 1.3, room: "Living room" },
  { hazardId: "high_shelf_reach", x: 10.2, z: 7.6, radius: 1.0, room: "Living room" },
  { hazardId: "blind_cords", x: 9.8, z: 7.2, radius: 0.8, room: "Living room" },

  // Bathroom
  { hazardId: "missing_grab_bars", x: 9.8, z: 16.5, radius: 1.0, room: "Bathroom" },
  { hazardId: "slippery_floor", x: 8.0, z: 16.8, radius: 1.2, room: "Bathroom" },
  { hazardId: "unlocked_toilet_lid", x: 10.3, z: 15.6, radius: 0.7, room: "Bathroom" },

  // Stairs / hallway
  { hazardId: "stairs_no_rail", x: 3.7, z: 14.0, radius: 1.8, room: "Stairs" },
  { hazardId: "missing_baby_gate", x: 3.7, z: 13.2, radius: 1.0, room: "Stairs" },
  { hazardId: "poor_stair_contrast", x: 3.7, z: 14.6, radius: 1.5, room: "Stairs" },
  { hazardId: "dim_hallway_stairs", x: 2.0, z: 14.5, radius: 2.0, room: "Hallway" },

  // Garage
  { hazardId: "water_heater_too_hot", x: 1.0, z: 19.5, radius: 1.0, room: "Garage" },
  { hazardId: "frayed_cords", x: 4.7, z: 19.5, radius: 1.2, room: "Garage" },
  { hazardId: "heavy_door", x: 2.9, z: 20.9, radius: 1.0, room: "Garage" },
  { hazardId: "unstable_step_stool", x: 1.2, z: 17.0, radius: 0.9, room: "Garage" },

  // Bedroom — right in the one doorway gap that reaches it (environment.ts
  // bedroom-entry-left/right), so the knob is on the actual door.
  { hazardId: "round_doorknob", x: 7.34, z: 19.5, radius: 0.7, room: "Bedroom" },

  // Doors and exits
  { hazardId: "obstructed_doorway", x: 4.1, z: 11.5, radius: 0.9, room: "ADU entrance" },
  { hazardId: "accessible_exterior_door", x: 7.3, z: 7.0, radius: 1.0, room: "Patio door" },

  // Entry
  { hazardId: "uneven_threshold", x: 6.55, z: 21.0, radius: 1.0, room: "Entry" },
];

const severityRank: Record<Severity, number> = {
  none: 0, low: 1, medium: 2, high: 3, critical: 4,
};

/** Which named condition, if any, a subject's hazard exposure should read against. */
export function conditionForSubject(subjectId: string): Condition | null {
  if (subjectId === "grandma" || subjectId === "grandma-figurine") return "elderly";
  if (subjectId === "baby" || subjectId === "toddler") return "toddler";
  return null;
}

export function zoneKey(zone: HazardZone): string {
  return `${zone.hazardId}@${zone.x},${zone.z}`;
}

/**
 * The most severe hazard (for `condition`) whose zone contains `point`, or
 * null if none applies. Ties broken by proximity. A hazard with severity
 * "none" for this condition never matches.
 */
export function hazardAt(
  point: { x: number; z: number },
  condition: Condition | null,
  zones: HazardZone[] = HAZARD_ZONES,
): HazardHit | null {
  if (!condition) return null;
  let best: HazardHit | null = null;
  let bestDistanceSquared = Infinity;
  for (const zone of zones) {
    const dx = point.x - zone.x;
    const dz = point.z - zone.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared > zone.radius * zone.radius) continue;
    const hazard = catalogById.get(zone.hazardId);
    if (!hazard) continue;
    const info = hazard[condition];
    if (info.severity === "none") continue;
    const rank = severityRank[info.severity];
    const bestRank = best ? severityRank[best.severity] : -1;
    if (rank > bestRank || (rank === bestRank && distanceSquared < bestDistanceSquared)) {
      best = { zone, hazard, condition, severity: info.severity, reason: info.reason };
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}
