# V2 combined simulation handoff

Updated 2026-09-05. Implemented at the user's request: combine the realistic house with the v1-style walking simulation so the character teammate can extend a working scene.

## Outcome

**http://localhost:5174/** now opens the photo-guided World Labs room with a walking procedural resident. The automatic routine visits three connected destinations. Manual destination commands, cart detours, passage blocking/recovery, speed, pause/reset, follow camera, geometry overlays and scenario export operate in that same room.

The room inspection workspace moved to **http://localhost:5174/environment.html**. The authored fixture is **http://localhost:5174/simulation.html?fixture=1**. No new generation, purchase, public deployment or Git push was performed for this integration.

## Character teammate handoff

Start with [the app README](../../../environment-sim/v2/README.md), then `src/character.ts`, `src/viewer.ts` and `src/contracts.ts`. Replace the resident's visual mesh/gait; preserve a feet-origin root, +Z forward, and the simulation-owned position/heading. The single loop in `main.ts` owns time. `Simulation` owns movement and events; `WalkingRoutine` issues destination requests using that same clock.

The optional `viewer.loadResident(...)` adapter accepts a GLB model plus matching idle/walk clips. No new generated character is required to run the app. The shipped character is explicitly a replaceable placeholder; the final character asset/animation integration remains the character teammate's work.

## Environment handoff

- [Generation record](generation-record.json): original photos, prompt and generation ID.
- [Vendor manifest](runtime-manifest.json): original runtime contract.
- `public/environment/tantau.json`: application world asset and transforms.
- `public/environment/tantau-simulation.json`: spawn, named destinations and cart/barrier footprints.
- `public/environment/tantau-navigation.json`: conservative collision-derived navigation grid.
- `public/environment/tantau-calibration.json`: normalization assumptions.

Both splats and collider use X rotation 180°, scale 1.905 and translation `[0,1.2954,0]`, applied once. Coordinates are right-handed Y-up, serialized quaternions `[x,y,z,w]`. Scale estimates the listing's 10-foot ceiling from dominant generated collider planes; it is not surveyed. The collider contains 165,695 triangles; the runtime files are 43,452,680 bytes (RAD) and 4,320,328 bytes (GLB).

The 0.15 m navigation grid has 520 accepted cells for a 0.28 m radius and 1.7 m height. Three destinations were selected in its connected central/rear passage area. Routes are checked against grid cells and dynamic obstacle footprints. Low geometry within 0.12 m of the floor is treated as floor noise. This is not a complete-house accessibility model or a small-hazard detector.

Rendering keeps the generated room in all three camera modes, then writes collider depth before drawing the resident/props. The appearance and movement geometry agree approximately; the generated collider is imperfect. Baked furniture remains fixed. Some camera angles are blurrier or more distorted than the source-photo view.

## Sharing and extending

Run `npm ci && npm run dev` in `environment-sim/v2/`. Durable public runtime URLs work without Mint authentication. `npm run fetch-world` creates a local asset bundle; set `VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json` in `.env.local` to use it. The refreshed ZIP includes both assets and that setting, so teammates do not need Mint credentials.

Scene helpers do not start their own loops. `loadWorld` returns splats, collider, depth, wire, surface queries and disposal. Keep one renderer/state owner when merging into another app. Exported scenario JSON includes the world manifest, active environment and simulation state. Surface anchors from the inspection page are not automatically walkable destinations.

## Checks

Ten simulation tests pass, including every pair of actual-room destinations, clearance at each movement step, cart detour, barrier/recovery, automatic routine and pause/reset. Production TypeScript/Vite compilation passes.

The actual-room browser suite checks automatic walking on load, arrival, cart detour, blocked-route recovery, pause/reset, follow camera, debug geometry, export, fixture/room switching, mobile overflow and missing-navigation recovery. A pixel comparison verifies the actual room wall hides a resident behind it and that disabling collider depth exposes the same resident. See [combined validation](evidence/combined-validation.json) and [walking screenshot](evidence/combined-walking.png). The sample-based browser suite separately checks the earlier movement fixture and rendering recovery.

Future changes to room transforms, collider or character clearance require navigation/anchor revalidation. The source photos guide appearance; generated unseen regions and approximate dimensions remain explicit limitations.
