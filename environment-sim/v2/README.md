# House Lab — realistic v2 simulation

The v1-style movement loop now runs **inside the photo-guided Tantau room**. The default page includes a walking placeholder, three connected destinations, automatic walking, a movable scenario cart, a passage barrier, pause/reset, camera views, geometry inspection and state export. Character artwork remains replaceable by the character teammate.

## Run and view

```sh
npm ci
npm run dev
```

Use Node 22.12+ or 24+.

- Combined simulation: **http://localhost:5174/**
- Room inspection, source photos and anchor export: **http://localhost:5174/environment.html**
- Authored v1-style fixture: **http://localhost:5174/simulation.html?fixture=1**
- Original alignment probe: **http://localhost:5174/probe.html**

The resident automatically visits the kitchen approach, rear passage and living passage, waiting 1.5 simulation seconds between journeys. Selecting a destination takes manual control. Ending the routine lets the current journey finish; Pause freezes movement and Reset restores the spawn and ends the routine. Reset preserves the scenario and speed. The cart changes the route; the barrier blocks travel across its passage. Geometry that would overlap the resident is rejected.

Inside and Overview keep the realistic room visible. Follow tracks the resident and tests camera clearance against the collider. Camera drag and zoom remain available. The collision/navigation overlay is for inspecting approximate geometry, not a visual hazard detector.

## Assets

The finished [Mint environment](https://mint.gg/chat/ph76aa258at54gvzs8ytwm5je18dtcpx) streams by default: 43.45 MB RAD appearance plus its matching 4.32 MB GLB collider. No generation credentials or browser login are needed. For local assets:

```sh
npm run fetch-world
```

Set `VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json` in `.env.local` and restart Vite. The teammate ZIP includes this setting and both assets. The optional official sample requires `npm run fetch-sample`.

`public/environment/tantau.json` defines appearance/collider transforms. `tantau-simulation.json` defines the spawn, destinations and scenario footprints and references `tantau-navigation.json`. The navigation file is loaded once as simulation data; the renderer does not own another mutable copy.

## Teammate integration

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | UI, active environment and the single application loop |
| `src/simulation.ts` | Position, heading, task, speed, pause/reset, obstacles and events |
| `src/walking-routine.ts` | Repeatable destination tour driven by simulation time |
| `src/navigation.ts`, `src/navigation-grid.ts` | A*, clearance, segment validity and sampled floor height |
| `src/simulation-environment.ts` | Loads room semantics/grid and checks spawn/destination reachability |
| `src/viewer.ts` | Shared cameras, resident pose, route/prop rendering and room occlusion |
| `src/character.ts` | Replaceable procedural resident and distance-driven gait |
| `src/animated-resident.ts` | Optional GLB model plus idle/walk clips from the same rig |
| `src/world-loader.ts` | Splats, transformed collider, depth/wire layers, queries and disposal |
| `src/contracts.ts` | Shared IDs, poses, environments and asset interfaces |
| `src/environment-app.ts` | Separate environment inspection and anchor export |

For the character teammate, replace `createResident()` while preserving `{ root, animate(distance, walking) }`, or call `viewer.loadResident({ modelUrl, idleUrl, walkUrl, height: 1.7, forwardRotation: 0 })`. Keep the root at the feet with forward **+Z**, Y up. The viewer owns root position and heading; the character module owns its mesh and pose. Do not start another render loop or let animation root motion move the simulation root. Optional generated-character loading is not enabled in the shipped configuration and has not been validated with the teammate's final assets.

A custom manifest may contain `{ world, environment, resident? }`; otherwise the Tantau asset uses the checked-in room configuration. The default contains no character download dependency. Inspect/export live state through the UI or `window.houseLab` (`simulation`, `viewer`, `routine`, `selectEnvironment`). Export contains the world asset, environment and simulation snapshot.

Rendering draws splat color first, then collider depth and the character/props. The invisible collider hides the resident behind furniture/walls without cutting holes in the room image. Spark and Three.js dependencies are pinned; environment loaders start no independent loop.

## Spatial assumptions

Meters are estimated, seconds use a fixed 1/60 simulation step, right-handed Y-up, quaternion order `[x,y,z,w]`. Both source assets use X rotation 180°, scale 1.905 and position `[0,1.2954,0]`. This normalizes an inferred 1.6-unit floor/ceiling separation against the listing's 10-foot ceiling. `metricStatus` stays `unverified`.

The navigation grid has 520 accepted cells, with destinations in its largest connected area, at 0.15 m spacing for radius 0.28 m and height 1.7 m. The bake includes cell-diagonal clearance and floor support checks, tolerating geometry within 0.12 m of the floor as noise. It does not establish whole-house accessibility or small-trip-hazard detection. Unseen rooms, dimensions and some furnishings are generated approximations; some views soften or distort. No new environment generation was needed for this integration.

Rebake with `node scripts/bake-navigation.mjs world.json collider.glb calibration.json navigation.json` after changing the source geometry or movement dimensions. Verify anchors again after recalibration. Furniture baked into the splats cannot be moved by merely moving a proxy.

## Validation

```sh
npm run build
npm test
# With the dev server running:
npm run test:combined
npm run test:tantau
# Also download the optional sample for these:
npm run test:browser
npm run test:environment
```

Ten simulation tests cover actual-room destination pairs, clearance on each step, cart detour, blocked/recovered routes, routine visits and pause/reset, plus the authored fixture. Browser checks cover default room loading and walking, arrival, obstacle changes, actual-room wall occlusion, cameras, export, switching, mobile overflow and missing-navigation recovery. Evidence is written to `.artifacts/` and summarized in [the team handoff](../../docs/implementation/v2/README.md).
