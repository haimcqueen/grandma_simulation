/** Authored scenario ratings, independent of the renderer and collision system. */
export type DangerLevel = "low" | "medium" | "high" | "critical";
export type FallDanger = { likelihood: DangerLevel; intensity: DangerLevel };
export type FallHazard = { id: string; label: string; danger?: FallDanger };
