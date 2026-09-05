# House Lab — realistic v2 simulation

**Collaborators:** start with the [Unitree integration and reuse guide](../../docs/UNITREE-COLLABORATOR-GUIDE.md).

The v1-style movement loop now runs **inside the photo-guided Tantau room**. The default page includes the team's articulated Unitree G1 robot, three connected destinations, automatic walking, a movable scenario cart, a passage barrier, pause/reset, camera views, geometry inspection and state export. Character artwork remains replaceable by the character teammate.

See the [v2.1 handoff](../../docs/implementation/v2.1/README.md) for realistic camera/cutaway behavior, teammate merge guidance, checks and limitations. V2.1 is an update to this application, not a separate source folder.

## Run and view

```sh
npm ci
npm run dev
```

Use Node 22.12+ or 24+.

- Combined simulation: **http://127.0.0.1:5174/**
- Room inspection, source photos and anchor export: **http://127.0.0.1:5174/environment.html**
- Authored v1-style fixture: **http://127.0.0.1:5174/simulation.html?fixture=1**
- Original alignment probe: **http://127.0.0.1:5174/probe.html**

The resident automatically visits the kitchen approach, rear passage and living passage, waiting 1.5 simulation seconds between journeys. Selecting a destination takes manual control. Ending the routine lets the current journey finish; Pause freezes movement and Reset restores the spawn and ends the routine. Reset preserves the scenario and speed. The cart changes the route; the barrier blocks travel across its passage. Geometry that would overlap the resident is rejected.

**Keyboard control:** W / ↑ moves forward, S / ↓ backs up, and A/D or ←/→ turns. The first movement key stops the automatic tour and selects Follow; you can switch cameras afterward. Release to brake, choose a destination or Walk around to resume route following. Controls ignore form fields and clear on pause, reset, window blur and environment switching. The same collider-derived navigation grid and obstacle footprints constrain manual movement; unexplored or unbaked parts of the room remain inaccessible.

**Grandma posture** is the default: stooped torso, forward head, bent knees, short low steps, reduced arm swing and a 0.77 m/s target. Choose Upright for comparison or adjust the speed slider. These are authored presets, not assumptions about every older adult or a medical simulation. Posture changes preserve position and are also visible while paused. `node scripts/test-keyboard.mjs` checks posture and keyboard controls against the running app (`BASE_URL` overrides the default port 5174).

**Unitree controls now live in v2.** The body selector includes G1 grandma/upright/toddler, H1 adult and Go2 crawl/trot presets, reusing the original joint rigs, posture and gait modules. Keys **1–5** select grandma, adult, crawl, toddler and dog. **↑/↓** move forward/backward; **←/→** turn, with WASD aliases. Release to brake. **F** selects first person and **V** selects third person. Body selection returns focus to the scene so arrow keys immediately control movement. Form fields consume their own editing keys while focused.

**[ / ]** adjust posture intensity and **K** cycles the five robot appearances. These also have sidebar controls. Playback supports normal, half and quarter speed. First person uses the robot's eye position and body orientation; third person follows it in the realistic room. Body swaps preserve position, selected appearance and pause state. H1 is capped at 1.7 m to stay within the grid's existing height envelope; the toddler G1 is capped at 0.95 m. Crawl/trot retain their separate four-leg animation. The fixed navigation envelope remains 0.28 m / 1.7 m for all presets; it does not grant smaller characters access to unbaked cells or perform per-limb collision checks.

**Fall animations** include forward trip, backward slip and sideways fall for the G1/H1. They begin at the current room position, constrain root movement to this room's navigation, stop the walking routine and support pause/replay/reset. Go2 disables biped fall playback. These are authored demos, without automatic hazard detection or ragdoll physics. Custom GLB residents need a fall-pose adapter before their fall control is enabled.

**Stairs remain unfinished in the realistic environment.** The loaded room and navigation have no connected staircase or upstairs. V1's staircase/balcony coordinates must not be copied into this asset. Reconstruct/register those parts, validate their collider and floor transition, then connect traversal. Until then, only the three ground-level fall demos are offered here.

Inside and Overview keep the realistic room visible. Follow tracks the resident and tests camera clearance against the collider. Camera drag and zoom remain available. The collision/navigation overlay is for inspecting approximate geometry, not a visual hazard detector.

**Top down**, **Overview** and **Side** render the actual World Labs room with reversible cutaways. Top down looks vertically down; Overview is an oblique dollhouse view; Side gives a lower exterior angle. Reveal interior hides the ceiling/upper surfaces above the wall-height slider. In Overview/Side, a camera-to-resident sightline also reveals obstructing near-side regions and is recomputed as the camera or resident moves, including orbit and zoom. Inside, Third person and First person restore the full room.

These are geometric cuts through splats, not semantic recognition of individual walls. The near-side cut can trim other baked surfaces in the same region; generated edges and unseen surfaces may look incomplete. The original collider/navigation remain unchanged for movement, while the visual depth occluder gets matching cuts. The slider and toggle provide manual control if the automatic reveal is too broad.

**Map** keeps the separate orthographic navigation diagram: green cells, resident, destination rings, route and dynamic obstacles. Drag pans and scroll zooms; blank regions are blocked or unverified, not a surveyed floor plan. Changing views preserves the simulation.


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
| `src/robot-resident.ts` | Default Unitree adapter, reusing v1's robot assets and joint gait |
| `src/animated-resident.ts` | Optional GLB model plus idle/walk clips from the same rig |
| `src/world-loader.ts` | Splats, transformed collider, depth/wire layers, queries and disposal |
| `src/contracts.ts` | Shared IDs, poses, environments and asset interfaces |
| `src/environment-app.ts` | Separate environment inspection and anchor export |

For the character teammate, replace `createResident()` while preserving `{ root, animate(distance, walking) }`, or call `viewer.loadResident({ modelUrl, idleUrl, walkUrl, height: 1.7, forwardRotation: 0 })`. Keep the root at the feet with forward **+Z**, Y up. The viewer owns root position and heading; the character module owns its mesh and pose. Do not start another render loop or let animation root motion move the simulation root. Optional generated-character loading is not enabled in the shipped configuration and has not been validated with the teammate's final assets.

A custom manifest may contain `{ world, environment, resident? }`; otherwise the Tantau asset uses the checked-in room configuration. The default robot and joint metadata are imported from the repository's v1 assets and bundled by Vite; no character service is required. `viewer.loadRobot()` restores the Unitree model. A load failure leaves the procedural resident visible and reports the failure in the character card. Inspect/export live state through the UI or `window.houseLab` (`simulation`, `viewer`, `routine`, `selectEnvironment`). Export contains the world asset, environment and simulation snapshot.

The robot uses the generated room's navigation and sampled floor heights, not v1's unrelated house coordinates. Its joint cycle follows actual travel and turns, reverses when backing up, and stops at obstacles. Pause freezes its pose, and the existing collider depth pass occludes it behind the room. Navigation retains the conservative 0.28 m radius / 1.7 m height envelope; this is not full-body robot collision or balance physics. V1's garden and stairs remain separate. The room-local fall adapter reuses shared articulated poses without importing their original scene coordinates.

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
npm run test:top
npm run test:cutaway
npm run test:tantau
# Also download the optional sample for these:
npm run test:browser
npm run test:environment
```

Simulation tests cover actual-room destination pairs, clearance on each step, cart detour, blocked/recovered routes, routine visits and pause/reset, plus the authored fixture. Browser checks cover default room loading and walking, arrival, obstacle changes, actual-room wall occlusion, cameras, export, switching, mobile overflow and missing-navigation recovery. Evidence is written to `.artifacts/` and summarized in [the team handoff](../../docs/implementation/v2/README.md).

Additional controls checks, against the running v2 app:

```sh
BASE_URL=http://127.0.0.1:5174 node scripts/test-keyboard.mjs
BASE_URL=http://127.0.0.1:5174 node scripts/test-room-falls.mjs
node scripts/test-unitree.mjs
```

Use the explicit IPv4 URL above: during development another older app was listening on localhost's IPv6 address. Port 5174 on 127.0.0.1 now serves v2; the earlier v1 server on that address was stopped.

Latest verification (2026-09-05): build and 16 simulation tests pass; Unitree, room-fall and combined-route browser suites pass. First-person checks wait for actual rendered appearance, since RAD metadata can initialize before streamed detail is visible.
