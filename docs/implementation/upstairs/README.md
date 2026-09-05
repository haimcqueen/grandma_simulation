# Connected upstairs handoff

Implemented locally on 2026-09-05 in `environment-sim/v2/`. This milestone connects the existing photo-guided ground-floor great room to a newly generated primary bedroom through an authored U-shaped stair and landing. An authored upper hall is included; other upstairs bedrooms and bathrooms are not. The [layout/access review](layout-access-review.md) records the subsequent correction of the stair placement and navigation.

Integrated the teammate's manual walkthrough and hazard/recovery changes from `origin/main` at `a946383` on local branch `feature/tantau-upstairs`. Commits are prepared locally for review; pushing requires the user's approval. See the [movement handoff](../movement/README.md) for the current controls and reusable scripting API.

## Run and share

```sh
cd environment-sim/v2
npm ci
npm run dev
```

Open **http://127.0.0.1:5174/?house=1** for the simple two-floor walkthrough. Use **http://127.0.0.1:5174/simulation.html?house=1** for development scenario controls, or choose **Tantau · connected floors** in the studio environment selector. The teammate's ordinary manual ground-floor walkthrough remains at `/`. Choose **Walk upstairs**, then **Walk downstairs** for the return journey. The house starts idle; Walk around tours destinations on the active floor.

The app streams both assets from the public URLs in the manifests. Teammates need no generation key or login. Both worlds total approximately 96.66 MB including colliders; actual network transfer depends on RAD streaming and caching. For local copies:

```sh
npm run fetch-house
```

The script verifies all four downloads against checked-in SHA-256 checksums and writes ignored assets/local manifests under `public/worlds/`. Add `VITE_HOUSE_MANIFEST_URL=/worlds/house-local.json` to `.env.local`, preserving other settings, and restart Vite. Do not commit large assets or `.env.local`. The original `fetch-world` command downloads only the ground room.

## Sources and fidelity

[Photo review](../../research/world-labs/second-floor/README.md) records room assignments and confidence. [Generation record](generation-record.json) retains the one approved primary-bedroom submission; [runtime manifest](runtime-manifest.json) records its completed exports. Source image filename suffixes 23–26 are four matching MLS bedroom views, not Zillow gallery positions.

The generated bedroom preserves the source's pale oak flooring, upholstered bed, rust-colored pillows, console, white trim and tray ceiling. Unseen surfaces and doorway geometry are generated. The connector uses an enclosed foyer-side recess and an upper hall informed by the floor plan, with oak treads/rails, white risers and glass panels. The previous central-room placement is superseded. Dimensions and generated-room registration remain estimates; this is not a complete reconstruction of the upper floor. Camera cutaways expose incomplete generated surfaces, particularly around exterior/window edges.

[Interior screenshot](evidence/upper-inside.png) · [Top-down screenshot](evidence/upper-top.png)

## Spatial contract

Meters and seconds; right-handed Y-up, character forward +Z, serialized quaternions `[x,y,z,w]`. Transform source assets once. `metricStatus` remains `unverified`.

| Component | Transform / ownership |
| --- | --- |
| Ground splat and collider | Scale 1.905, quaternion `[1,0,0,0]`, translation `[0,1.2954,0]`; nominal floor Y=0 |
| Primary splat and collider | Scale 0.35; current rotation/translation in `public/environment/house/upper.json`; nominal floor Y=3.4 |
| Upper navigation | 0.1 m cells; 0.28 m clearance, 1.7 m height envelope; sampled floor heights |
| Stair | 1.1 m width; two estimated 1.7 m rises, middle landing, lower/upper approaches |
| Ground stair endpoint | `(-0.525, 0, 0.575)` |
| Upper stair endpoint | `(-1.175, 3.4, -0.550833)`; upper hall then leads to the bedroom |

The bedroom's raw collider has a dominant floor around raw Y=3.66. Scale 0.35 gives an estimated main floor/ceiling separation near 3.06 m, then translation places its floor at 3.4 m. This is an appearance-based scale estimate, not surveyed dimensions or proof of exact stacking.

`public/environment/house/house.json` owns floor manifests and the stair polyline. `upper-calibration.json` records the bake bounds/clearance; `upper-navigation.json` is the baked grid; `upper-simulation.json` owns spawn, named destinations and scenario footprints. The ground house manifest adds a connector opening while the standalone ground manifest remains usable independently.

World-space `cutouts` are explicit authored openings, with optional yaw about their center. They cut splats and visual depth and filter ray queries. House navigation is rebaked against these openings plus shared authored walls/floors. The ground grid reserves the flight volume for the stair controller; the upper hall uses normal floor navigation. Keep these layers aligned when changing the layout.

## State, rendering and integration

- `src/house.ts` defines floors, connections and transfer state; `house-loader.ts` loads floor data and checks identity, valid geometry, endpoint support and elevation.
- `src/simulation.ts` owns one resident and clock. `requestFloor("upper", "primary")` plans a room route to the stair endpoint, traverses the 3D polyline, changes the active environment and continues to the destination. Reverse traversal uses the same points. Scenario state is retained independently per floor.
- `src/stair-environment.ts` builds the visible connector from the same points. Movement follows a continuous ramp over treads; individual foot placement, balance and per-limb collision are not simulated. Stair speed is capped at 0.65 m/s.
- `src/viewer.ts` owns both worlds, one Spark renderer, cameras and resident elevation. Floor-scoped edits prevent one floor's ceiling cut removing the other. Floor selection changes visibility, not resident location. Both floors appear during stair traversal.
- `src/main.ts` owns the simple walkthrough loop; `src/studio.ts` owns the development studio loop. Each page runs one loop. Character integrations still provide a feet-rooted +Z-forward resident; the viewer owns root position, including elevation. No second animation loop or actor is introduced.

Ground, Upstairs and Both views retain realistic assets. Top down/Side/Overview support reversible camera cuts; Inside/First person/Third person restore full room surfaces. Map shows the active floor's navigation grid only, not a surveyed multi-floor diagram or detailed stair map.

Pause freezes a transfer. Reset cancels it and returns to the **current** floor spawn (the source floor until the transfer completes), preserving scenario and speed. Manual drive can take over, stop and backtrack; falls, obstacle edits and body changes are guarded during a transfer. A blocked approach or destination landing rejects the floor request and records `routeBlocked`; no teleport fallback is used.

## Expanding this milestone

For each additional scene, supply a world manifest, independently checked transform, navigation grid, meaningful destination IDs and supported connection endpoint. Reuse the existing [parallel asset guide](../../parallel-work/house-assets/house-asset-guide.md) ; the upstairs manifests provide a concrete example.

Several rooms on the same elevation should eventually share one floor environment/grid, with several visual assets, rather than masquerading as separate vertical floors. The current `HouseFloor` has one world and the UI explicitly targets `ground`/`upper`; extend that contract and callers together when adding more rooms. Multi-hop floor routing is not implemented: each transfer requires a direct connection.

Do not align new rooms from one screenshot alone. Inspect collider/appearance from multiple cameras, select reachable endpoints, reconcile openings and repeat the actual asset clearance check. The source floor-plan image can guide approximate relationships but does not automatically constrain a Mint generation.

## Validation performed

Current checks and results are recorded in [movement/validation.json](../movement/validation.json). The [layout/access review](layout-access-review.md) explains the geometry checks, finer navigation and remaining limitations. Earlier evidence images and 189-sample stair results describe the superseded placement; the revised connector is checked at 196 sampled positions, including authored enclosure geometry.

Run `npm run build`, `npm test`, `npm run test:house` and `npm run test:movement`. With Vite running, run `npm run test:house:browser`, `npm run test:house:walkthrough` and `npm run test:movement:browser`. Download assets with `npm run fetch-house` before `npm run test:stairs`. Re-bake navigation and validate endpoints whenever transforms or geometry change.

Large assets and exploratory screenshots stay under ignored directories. No new splat was generated for the layout revision, and no generation is in flight.
