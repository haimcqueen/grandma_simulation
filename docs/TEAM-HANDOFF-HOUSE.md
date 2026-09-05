# Team handoff: house visuals, upstairs, stairs, and replaceable assets

Updated September 5, 2026. This records the completed environment work and the final user direction: keep the house interactive, recreate the second floor from the supplied plan, let the robot walk up/down stairs, and make visual components replaceable with realistic assets.

## Start here

The live app is **`environment-sim/v1-draft/`**. Continue in that app; `web/` and `sandbox/` are older explorations. Keep one Three.js scene and one simulation loop.

```sh
cd environment-sim/v1-draft
npm run dev
npm run build
npm test
```

The server used during verification was `http://127.0.0.1:5174`. Check the actual Vite output before assuming a port; several development servers existed in the shared workspace.

The workspace was actively shared. Robot models, figurine control, fall animation, camera modes, swarm, and garden work already existed or changed concurrently. Preserve those changes. A concurrent commit, `8e214f5` (`Add garden navigation, camera modes, and house exploration updates`), incorporated much of the shared work during this session. This agent did not create that commit. Do not interpret all files in that commit as solely this environment work, and recheck `git status` before committing anything else.

## What users can do now

- Explore the textured ground floor and the recreated second floor with the existing camera/character controls.
- Choose **Go to floor → Second floor**. The character first routes to the stair entrance, climbs the two flights, turns at the intermediate landing, and arrives upstairs. Choose **Ground floor** for the return trip. This control no longer teleports the character.
- Pause during the climb, resume, or reset to cancel the transfer. A blocked route to the stairs is rejected. New destinations, passage edits, and fall playback are unavailable during transfer.
- Visit the primary, middle, and front bedrooms or return to the upstairs landing. Upstairs routes use upstairs walls, furniture, and floor regions.
- Download a coarse GLB layout of the active floor under **About this experiment** for reuse in Chisel/Blender.
- Change visual assets via `src/visualConfig.ts`, without changing movement or navigation code. See [ASSETS.md](../environment-sim/v1-draft/ASSETS.md).

## Files and ownership

| File | Role |
| --- | --- |
| `src/environment.ts` | Ground-floor source of truth; shared types, floor regions, object footprints, destination IDs and walkability |
| `src/upperFloor.ts` | Upstairs trace: floor regions, walls, furniture, room destinations and spawn |
| `src/navigation.ts` | Existing A* and segment checks, extended to accept the active floor regions |
| `src/simulation.ts` | Sole owner of level, route, stair transfer, elevation, pause/reset and events |
| `src/stairs.ts` | Shared stair entry positions, vertical rise and 3D route |
| `src/stairView.ts` | Default stair treads and handrails, registered as a replaceable visual |
| `src/houseAppearance.ts` | Procedural finishes and reusable default architectural/furniture detailing |
| `src/environmentAssets.ts` | Stable visual slots, GLTF loading, model placement, replacement, restore, background and imported-resource disposal |
| `src/visualConfig.ts` | Asset URLs and presentation choices; currently uses built-in visuals |
| `src/exportHouse.ts` | Lazy-loaded coarse GLB structural export; no external generation calls |
| `src/scene.ts` | Component assembly, floor visibility, cameras, lighting, destination picking and existing character rendering |
| `src/main.ts` | Floor controls, presentation configuration and existing application loop |

## Layout and coordinate contract

All authored coordinates use **metres, Y up, and +Z toward the front of the plan**. This is not a surveyed geographic orientation.

The user supplied the complete floor-plan image. Its right-hand plan shows three upstairs bedrooms, the primary bathroom/toilet areas, a shared bathroom, a walk-in closet, hall and stairs. It labels upstairs as **780 sq ft**. There is **no upstairs balcony shown**; the balcony fall scene remains a separate illustrative animation set.

`upperFloor.ts` traces that supplied image using a working scale of **0.019 m/pixel**, guided by the primary-bedroom dimensions. The earlier ground-floor blockout and this upstairs trace are approximations fitted around the staircase; they are not a surveyed reconstruction, and the modeled area is not certified as 780 sq ft. Furniture placement, window details and vertical dimensions are authored.

Runtime upstairs is at **y=3.06 m**. Upper-floor mesh components and imported floor assets use local y=0 and inherit the upstairs group's offset. The resident's world elevation comes from `Simulation.elevation`; do not add the storey offset to the robot again. Ground elevation is zero except during the existing fall demonstration.

The navigation grid remains 0.2 m within the existing approximately 11 × 22 m coordinate range. `isWalkable(point, obstacles, clearance, floorRegions)`, `segmentClear(..., floorRegions)`, and `planRoute(..., floorRegions)` default to ground-floor regions for existing callers. Upper-floor calls must pass `simulation.floorRegions`.

## Stair movement contract

- `requestFloor(level)` is the user-facing movement API. It plans to `STAIR_ENTRY[currentLevel]`, then follows the authored 3D staircase route.
- `stairTarget` spans the approach and the climb. `onStairs` is true only while the 3D stair route is active; `changingFloor` includes the approach.
- Ground entry: **x=6.5, z=14.5**. Upper exit: **x=6.55, z=13.95**.
- Rise: **3.06 m**, represented by **18 illustrative 0.17 m risers**. The character slows down, rotates through the turn, raises its knees more, and changes elevation continuously.
- `level` changes only when the stair route finishes. Ordinary A* treats the stair footprint/opening as blocked; the explicit connection owns movement through it.
- Pause freezes elevation and gait. Reset cancels an in-progress transfer and returns to the start of the still-active floor. Do not drive this with wall-clock animation.
- `setLevel(level)` remains an immediate placement/reset helper for tests or future editor tooling. **The floor UI calls `requestFloor`, not `setLevel`.** Do not accidentally reintroduce teleporting by swapping these calls.
- Movement is authored animation, not contact physics. There is no per-tread foot IK, support polygon, stair balance model, or ragdoll. Feet can slide or intersect treads. The user requested actual visible stair traversal; this implements that continuous traversal while retaining the existing animation approach.

## Rendering and reusable visual assets

The default house now uses locally generated wood grain, fabric, stone and plaster maps; detailed cabinetry/worktops; softened sofa/bed shapes; and full-height architecture for first person. The garden grass work came from the concurrent garden change. These are procedural materials, **not photogrammetry or a generated photorealistic World Labs world**.

Wide/top/third-person views retain a cutaway. First-person enables the authored upper walls, windows and ceilings. During stair traversal both floors are visible and third-person frames the stairwell. Floors, walls and architecture live in shell slots; furniture lives in separate slots. Ground and upper cameras share the existing render loop.

`view.assets` exposes:

```ts
view.assets.ids();
await view.assets.replace("ground:sofa", { url: "/environment/sofa.glb" });
view.assets.restore("ground:sofa");
await view.assets.setBackground({ panoramaUrl: "/environment/garden.jpg" });
await view.assets.apply(visualConfig);
```

Slot IDs are `ground:<furniture-id>`, `upper:<furniture-id>`, `ground:shell`, `upper:shell`, and `stairs`. Examples: `ground:island`, `ground:dining-table`, `upper:bed-upper-primary`.

Furniture imports rotate, scale uniformly inside the existing horizontal footprint, center on that footprint, and rest on the floor. Shell/stair imports retain authored coordinates with optional scale/offset. **A visual replacement never rewrites collision or navigation data.** Use an unfurnished replacement shell to avoid duplicate furniture. A differently laid out house needs updated layout data and navigation checks.

Loading is asynchronous: later requests win, failed replacements preserve the current visual, restore cancels pending loads, and discarded/imported mesh resources are disposed. Independent configuration failures do not discard successful replacements. The loader is injectable, so a future rendering provider does not need access to simulation state.

Current format support is ordinary GLB/GLTF and JPG/PNG equirectangular backgrounds. Draco/KTX2 decoder setup is not configured. Generic imported shells do not automatically support camera-dependent cutaways. Gaussian splats need a Spark adapter and appropriate GPU-resource cleanup; no splat loader is integrated in the live app.

## World Labs / Mint / Tripo status

Research and implementation recommendations are in [house-design.md](./house-design.md), with primary-source links and a suggested generation prompt.

- World Labs Chisel accepts GLB/FBX structure references. Use the exported coarse house layout as guidance, then inspect the generated openings, stairs and furniture before integrating the result.
- World Labs mesh exports can use a conventional loader. Splats need a separate integration. Collider meshes do not automatically supply navigation data.
- Mint documents prompt/reference-image generation and downloadable artifacts; GLB structural input was not verified in its documented world-generation request.
- Tripo is a useful candidate for independent furniture/props to fill the visual slots.
- **No external environment generation ran. No authenticated World Labs, Mint or Tripo connector was available in this session.**

The GLB export uses local floor y=0, full-height box walls and simple object geometry. It intentionally omits the runtime appearance details, characters and scenario obstructions. It is a structural reference, not a detailed render export or a surveyed building model. Verify imported scene coordinate conventions rather than applying the robot's URDF transforms to environment assets.

## Verification and known results

- `npm run build` passed. Vite still reports the existing large-main-bundle advisory; the GLB exporter is split into a separate lazy-loaded chunk.
- The focused asset/floor suite passed **9/9**: fitting, failed replacement, disposal, competing loads, partial configuration failures, upstairs route clearance, floor isolation, continuous ascent/descent, pause, blocked approaches and reset.
- `BASE_URL=http://127.0.0.1:5174 node tests/floors.browser.mjs` passed after the asset refactor. It covers stair ascent, a mid-flight screenshot, upstairs arrival, floor-plan and first-person views, reset, valid GLB download, descent, ground-floor scenario recovery, mobile overflow and uncaught page errors.
- The existing camera browser checks also passed during the initial materials pass, before the upstairs/asset refactor.
- Latest full suite: **54/55 passed**. The existing randomized swarm test `falls cluster in tight space, not on open floor` failed its `>60%` threshold with approximately 58%. It uses unseeded randomness; an earlier full run passed all then-current 51 tests. This was not fixed or weakened. Treat this as an unresolved stochastic test result, not proof of an environment regression or proof that the swarm behavior is correct. The swarm's clearance sampler and the test's clearance predicate also differ, so inspect that contract if taking ownership of it.

Generated review artifacts are under ignored `environment-sim/v1-draft/.artifacts/`: `stair-climb.png`, `second-floor-plan.png`, `second-floor-interior.png`, `house-materials.png`, and `tantau-upper-floor-reference.glb`.

## Suggested next work

1. Bring in a real unfurnished house shell and a few realistic furnishings through the visual slots; validate each asset's scale and the match between visible and navigable geometry.
2. Refine the architectural fit against the full source plan, especially vertical dimensions and stair geometry. The current riser/run choices are illustrative.
3. Add foot-contact IK or authored stair clips if planted feet and physically plausible stair walking are required. Keep playback tied to simulation travel/time.
4. Extract additional scene assembly into reusable floor/room builders if another house layout is introduced. The asset layer is reusable now; `scene.ts` still contains house-specific assembly and camera composition.
5. Investigate the stochastic swarm test separately. Avoid changing its threshold merely to get a green run.

Preserve the existing single owner for state, one fixed-step loop, stable IDs, and the separation between an attractive visual environment and the geometry the simulation actually uses.
