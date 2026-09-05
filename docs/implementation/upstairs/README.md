# Connected upstairs handoff

Implemented locally on 2026-09-05 in `environment-sim/v2/`. This milestone connects the existing photo-guided ground-floor great room to a newly generated primary bedroom through an authored U-shaped stair and landing. Other upstairs bedrooms, bathrooms and the complete hall are not included.

Current integration base: `d1f67de`, isolated on local branch `feature/tantau-upstairs`; changes are not committed or pushed. Remote main advanced to `1d674c8` during this work with hazard/recovery features. Those changes were fetched and reviewed, not merged into this tested milestone. See the [character and integration review](../../parallel-work/character-adapters/REVIEW.md) before combining them.

## Run and share

```sh
cd environment-sim/v2
npm ci
npm run dev
```

Open **http://127.0.0.1:5174/?house=1**, or choose **Tantau · connected floors** in the environment selector. The ordinary ground-floor simulation remains at `/`. Choose **Walk upstairs**, then **Walk downstairs** for the return journey. The house starts idle; Walk around tours destinations on the active floor.

The app streams both assets from the public URLs in the manifests. Teammates need no generation key or login. Both worlds total approximately 96.66 MB including colliders; actual network transfer depends on RAD streaming and caching. For local copies:

```sh
npm run fetch-house
```

The script verifies all four downloads against checked-in SHA-256 checksums and writes ignored assets/local manifests under `public/worlds/`. Add `VITE_HOUSE_MANIFEST_URL=/worlds/house-local.json` to `.env.local`, preserving other settings, and restart Vite. Do not commit large assets or `.env.local`. The original `fetch-world` command downloads only the ground room.

## Sources and fidelity

[Photo review](../../research/world-labs/second-floor/README.md) records room assignments and confidence. [Generation record](generation-record.json) retains the one approved primary-bedroom submission; [runtime manifest](runtime-manifest.json) records its completed exports. Source image filename suffixes 23–26 are four matching MLS bedroom views, not Zillow gallery positions.

The generated bedroom preserves the source's pale oak flooring, upholstered bed, rust-colored pillows, console, white trim and tray ceiling. Unseen surfaces and doorway geometry are generated. The connector uses authored wood treads, white risers/stringers and rails; its placement and dimensions are estimates fitted to the two assets. It does not reconstruct the listing's actual stair location or full upper floor plan. Camera cutaways expose incomplete generated surfaces, particularly around exterior/window edges.

[Interior screenshot](evidence/upper-inside.png) · [Top-down screenshot](evidence/upper-top.png)

## Spatial contract

Meters and seconds; right-handed Y-up, character forward +Z, serialized quaternions `[x,y,z,w]`. Transform source assets once. `metricStatus` remains `unverified`.

| Component | Transform / ownership |
| --- | --- |
| Ground splat and collider | Scale 1.905, quaternion `[1,0,0,0]`, translation `[0,1.2954,0]`; nominal floor Y=0 |
| Primary splat and collider | Scale 0.35, quaternion `[0,0,1,0]`, translation `[1.575,4.681,-2.125]`; nominal floor Y=3.4 |
| Upper navigation | 0.1 m cells; 0.28 m clearance, 1.7 m height envelope; sampled floor heights |
| Stair | 1.1 m width; two estimated 1.7 m rises, middle landing, lower/upper approaches |
| Ground stair endpoint | `(1.725, 0, -2.575)` |
| Upper stair endpoint | `(0.325, 3.4, -2.575)` |

The bedroom's raw collider has a dominant floor around raw Y=3.66. Scale 0.35 gives an estimated main floor/ceiling separation near 3.06 m, then translation places its floor at 3.4 m. This is an appearance-based scale estimate, not surveyed dimensions or proof of exact stacking.

`public/environment/house/house.json` owns floor manifests and the stair polyline. `upper-calibration.json` records the bake bounds/clearance; `upper-navigation.json` is the baked grid; `upper-simulation.json` owns spawn, named destinations and scenario footprints. The ground house manifest adds a connector opening while the standalone ground manifest remains usable independently.

World-space `cutouts` are explicit authored doorway/stair openings. They cut splats and visual depth and filter ray queries. They do not rebake the floor grid: conservative room navigation remains intact, and the explicit stair path/landing geometry owns travel and support through the connector. If you change a cutout, recheck support and clearance; expanding one is not automatically permission to walk there.

## State, rendering and integration

- `src/house.ts` defines floors, connections and transfer state; `house-loader.ts` loads floor data and checks identity, valid geometry, endpoint support and elevation.
- `src/simulation.ts` owns one resident and clock. `requestFloor("upper", "primary")` plans a room route to the stair endpoint, traverses the 3D polyline, changes the active environment and continues to the destination. Reverse traversal uses the same points. Scenario state is retained independently per floor.
- `src/stair-environment.ts` builds the visible connector from the same points. Movement follows a continuous ramp over treads; individual foot placement, balance and per-limb collision are not simulated. Stair speed is capped at 0.65 m/s.
- `src/viewer.ts` owns both worlds, one Spark renderer, cameras and resident elevation. Floor-scoped edits prevent one floor's ceiling cut removing the other. Floor selection changes visibility, not resident location. Both floors appear during stair traversal.
- `src/main.ts` owns the existing fixed-step loop and controls. Character integrations still provide a feet-rooted +Z-forward resident; the viewer owns root position, including elevation. No second animation loop or actor is introduced.

Ground, Upstairs and Both views retain realistic assets. Top down/Side/Overview support reversible camera cuts; Inside/First person/Third person restore full room surfaces. Map shows the active floor's navigation grid only, not a surveyed multi-floor diagram or detailed stair map.

Pause freezes a transfer. Reset cancels it and returns to the **current** floor spawn (the source floor until the transfer completes), preserving scenario and speed. Manual drive, falls, obstacle edits and body changes cannot interrupt a transfer. A blocked approach or destination landing rejects the floor request and records `routeBlocked`; no teleport fallback is used.

## Expanding this milestone

For each additional scene, supply a world manifest, independently checked transform, navigation grid, meaningful destination IDs and supported connection endpoint. Reuse the existing [parallel asset guide](../../parallel-work/house-assets/house-asset-guide.md) ; the upstairs manifests provide a concrete example.

Several rooms on the same elevation should eventually share one floor environment/grid, with several visual assets, rather than masquerading as separate vertical floors. The current `HouseFloor` has one world and the UI explicitly targets `ground`/`upper`; extend that contract and callers together when adding more rooms. Multi-hop floor routing is not implemented: each transfer requires a direct connection.

Do not align new rooms from one screenshot alone. Inspect collider/appearance from multiple cameras, select reachable endpoints, reconcile openings and repeat the actual asset clearance check. The source floor-plan image can guide approximate relationships but does not automatically constrain a Mint generation.

## Validation performed

- Production build passed; the existing large Spark/Three bundle warning remains.
- 16 existing simulation tests and five house tests passed, including every shipped destination pair, continuous ascent/descent, independent scenario state, blocked approach, pause/reset and invalid endpoint rejection.
- `npm run test:stairs`: 189 sampled capsule positions along the authored route against both transformed generated colliders, excluding explicit cutouts; no contacts. This is a sampled static clearance check, not whole-body physics validation.
- `npm run test:house:browser`: actual remote bedroom and ground assets, return journey, floor-scoped ceiling heights, camera modes, floor visibility, obstruction, export, mobile layout and fixture switching.
- Existing cutaway and combined browser suites passed, including orbit/zoom, restored surfaces and actual-room character occlusion. Keyboard/fall regressions also passed during integration.
- All four assets downloaded successfully; byte counts and SHA-256 recorded in `public/environment/house/checksums.json`.

Run `npm run build`, `npm test`, `npm run test:house`; with Vite running, run `npm run test:house:browser`. Download assets with `npm run fetch-house` before `npm run test:stairs`. Re-bake navigation and validate endpoints whenever transforms or geometry change.

Local screenshots and export fixtures are under ignored `.artifacts/upstairs/`. Only selected evidence images and small configuration/provenance files belong in Git. No additional upstairs generation is in flight.
