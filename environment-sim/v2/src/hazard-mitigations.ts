/** Practical environment changes, separate from the authored scenario ratings.
 * Sources: NIA, Preventing Falls at Home; CDC STEADI, Check for Safety.
 */
const general = [
  "Clear loose items from the walking path.",
  "Improve lighting so obstacles are easy to see.",
  "Rearrange furniture to leave an unobstructed route.",
] as const;
const mitigations: Readonly<Record<string, readonly string[]>> = {
  dining_chair: [
    "Tuck the chair under the table when it is not in use.",
    "Arrange chairs so their legs stay out of the walking path.",
    "Light the dining area so chair legs are easy to see.",
  ],
  ottoman: [
    "Move the ottoman out of the main walking path.",
    "Leave a clear route between the sofa, table and kitchen.",
    "Light the room so low furniture is easy to see.",
  ],
  loose_rug: ["Remove loose rugs from walking paths.", "Secure rugs with a nonslip backing.", "Keep rug edges flat."],
  loose_cords: ["Route cords along the wall.", "Secure loose wires away from walking paths.", "Keep the floor clear around outlets."],
  slippery_floor: ["Clean up spills promptly.", "Use nonslip surfaces where floors get wet.", "Keep the route well lit."],
};

/** Every encounter, including unknown/manual ones, has actionable next steps. */
export const hazardMitigations = (hazardId?: string): readonly string[] =>
  hazardId && Object.hasOwn(mitigations, hazardId) ? mitigations[hazardId] : general;
