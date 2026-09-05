import type { EnvironmentVisualConfig } from "./environmentAssets";

/** Swap presentation here without changing floor plans, pathing, or characters.
 * Put GLBs and panoramas under public/environment/ and use paths beginning /environment/.
 * Available IDs include ground:shell, upper:shell, stairs, ground:sofa,
 * ground:island, ground:dining-table, and upper:bed-upper-primary.
 */
export const visualConfig: EnvironmentVisualConfig = {
  background: { color: "#edece6" },
  assets: {},
};
