# V2 combined simulation handoff

**Collaborators:** start with the [Unitree integration and reuse guide](../../UNITREE-COLLABORATOR-GUIDE.md).

Updated 2026-09-05. Implemented at the user's request: combine the realistic house with the v1-style walking simulation so the character teammate can extend a working scene.

For the subsequent realistic camera and cutaway changes, read the [v2.1 handoff](../v2.1/README.md). The implementation remains in `environment-sim/v2/`.

## Unitree integration follow-up

The user explicitly selected v2 as the working app. Use **http://127.0.0.1:5174/**. This address now serves the realistic app, replacing the v1 server previously there; another legacy app may still occupy localhost's IPv6 address.

`posture.ts` catalogues G1 grandma/upright/toddler, H1 adult and Go2 infant-crawl/dog-trot presets. `robot-resident.ts` loads their shared v1 GLBs/joint metadata and reuses `gait`, `crawl`, `stance`, `livery` and `fall` helpers. The adapter implements `setMotion(posture, phase, hunch, skin)`, `setFall(fall)` and `update(...)`; it owns mesh pose only. Root position, heading, gait phase, fall time, skin, hunch and playback speed remain simulation-owned and exported. Body changes preserve position and pause state; incompatible biped falls are disabled for Go2. H1 height is capped at the existing grid's 1.7 m envelope; toddler G1 is capped at 0.95 m. All presets still use the same 0.28 m / 1.7 m navigation envelope. This is not full-body collision.

`falls.ts` is a room-local scenario catalogue for forward, backward and sideways falls. `Simulation.playFall` cancels route/manual travel, captures the current room position and plays a deterministic relative track. Root translations are checked against the room's navigation and dynamic obstacles; limbs can still intersect geometry. No original patio/balcony/stair location is imported. Pause, replay and reset use the same simulation clock as walking. `viewer.ts` applies articulated poses, maintains floor contact and handles eye-position first person / collider-aware third person. Custom resident replacements need `setFall` before their UI can offer fall playback.

Keyboard: arrows or WASD drive; F first person, V third person; 1–5 choose the original robot presets; [ / ] tune posture and K cycles skins. Movement keys take over from the walking routine, ignore active form fields and clear on pause/reset/blur/environment or body changes. Releasing keys brakes. Preset selection blurs the dropdown so arrows can immediately drive. Playback speed scales both manual movement and simulation time.

**Still outstanding:** reconstruct the staircase and upstairs in the realistic world, register appearance/collider transforms, validate navigation and then add floor traversal. The current generated room has no usable stair connection. V1 floor-plan coordinates and balcony fall sets are unrelated to this world. The garden and unrigged grandma figurine are also separate v1 features; this follow-up ports the Unitree bodies.

Validation on September 5: production build and all 16 simulation tests passed. The keyboard baseline, room-fall browser suite, all six Unitree body/movement presets in both camera modes, and the combined room/route/obstacle/occlusion regression passed. The room-fall check now verifies rendered pixel variation before its first-person screenshot: RAD initialization can finish before streamed appearance pages draw. First-person, H1, Go2 and fall captures were visually reviewed. Browser scripts accept `BASE_URL`; screenshots are in v2 `.artifacts/`.

## Original integration outcome

**http://127.0.0.1:5174/** opens the photo-guided World Labs room with the articulated Unitree resident. The automatic routine visits three connected destinations. Manual destination commands, cart detours, passage blocking/recovery, speed, pause/reset, follow camera, geometry overlays and scenario export operate in that same room.

The room inspection workspace moved to **http://localhost:5174/environment.html**. The authored fixture is **http://localhost:5174/simulation.html?fixture=1**. No new generation, purchase, public deployment or Git push was performed for this integration.

## Character teammate handoff

Start with [the app README](../../../environment-sim/v2/README.md), then `src/character.ts`, `src/viewer.ts` and `src/contracts.ts`. Replace the resident's visual mesh/gait; preserve a feet-origin root, +Z forward, and the simulation-owned position/heading. The single loop in `main.ts` owns time. `Simulation` owns movement and events; `WalkingRoutine` issues destination requests using that same clock.

The optional `viewer.loadResident(...)` adapter accepts a GLB model plus matching idle/walk clips. No new generated character is required to run the app. The shipped character now uses the Unitree adapter described above. The procedural resident remains the fallback if robot loading fails.

## Environment handoff

- [Generation record](generation-record.json): original photos, prompt and generation ID.
- [Vendor manifest](runtime-manifest.json): original runtime contract.
- `public/environment/tantau.json`: application world asset and transforms.
- `public/environment/tantau-simulation.json`: spawn, named destinations and cart/barrier footprints.
- `public/environment/tantau-navigation.json`: conservative collision-derived navigation grid.
- `public/environment/tantau-calibration.json`: normalization assumptions.

Both splats and collider use X rotation 180°, scale 1.905 and translation `[0,1.2954,0]`, applied once. Coordinates are right-handed Y-up, serialized quaternions `[x,y,z,w]`. Scale estimates the listing's 10-foot ceiling from dominant generated collider planes; it is not surveyed. The collider contains 165,695 triangles; the runtime files are 43,452,680 bytes (RAD) and 4,320,328 bytes (GLB).

The 0.15 m navigation grid has 520 accepted cells for a 0.28 m radius and 1.7 m height. Three destinations were selected in its connected central/rear passage area. Routes are checked against grid cells and dynamic obstacle footprints. Low geometry within 0.12 m of the floor is treated as floor noise. This is not a complete-house accessibility model or a small-hazard detector.

Rendering keeps the generated room in realistic camera modes (Map is a separate navigation diagram), then writes collider depth before drawing the resident/props. The appearance and movement geometry agree approximately; the generated collider is imperfect. Baked furniture remains fixed. Some camera angles are blurrier or more distorted than the source-photo view.

## Sharing and extending

Run `npm ci && npm run dev` in `environment-sim/v2/`. Durable public runtime URLs work without Mint authentication. `npm run fetch-world` creates a local asset bundle; set `VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json` in `.env.local` to use it. The refreshed ZIP includes both assets and that setting, so teammates do not need Mint credentials.

Scene helpers do not start their own loops. `loadWorld` returns splats, collider, depth, wire, surface queries and disposal. Keep one renderer/state owner when merging into another app. Exported scenario JSON includes the world manifest, active environment and simulation state. Surface anchors from the inspection page are not automatically walkable destinations.

## Realistic cutaway views

Top down, Overview and Side render the original RAD room with Spark SDF edits. A world-space height cut removes ceiling and upper surfaces. Overview/Side additionally check the camera-to-resident sightline against the collider, ignoring already-height-clipped surfaces and low furnishings. An obstructing near-side region is lowered to reveal the resident. The sightline updates with camera orbit, zoom and resident movement. The same regional cut is applied to the invisible depth occluder; physical navigation uses the original collider/grid.

Reveal interior and wall height are user controls. Inside/Third person/First person disable both cuts and restore full-room occlusion. Map is the separate orthographic navigation diagram added earlier. View switching preserves movement state.

These are regional cuts, not individual-wall semantics. Other baked surfaces can be trimmed in a cut region. Splats inferred from interior photographs can have soft, incomplete surfaces when viewed from outside or above. We retain real asset appearance rather than substituting a floor diagram for the realistic views.

`world-loader.ts` owns the shared cut geometry and depth-shader uniforms. `viewer.ts` selects cameras and updates the sightline; no extra animation loop or generation job was added. [Spark editing documentation](https://sparkjs.dev/docs/splat-editing/) describes the SDF opacity mechanism; local behavior was checked against the installed 2.1.0 package.

`npm run test:top` checks Map controls and state preservation; `npm run test:cutaway` checks actual-room camera modes, orbit/zoom, cut height, depth-plane alignment, toggle/restoration and mobile layout.

## Checks

Ten simulation tests pass, including every pair of actual-room destinations, clearance at each movement step, cart detour, barrier/recovery, automatic routine and pause/reset. Production TypeScript/Vite compilation passes.

The actual-room browser suite checks automatic walking on load, arrival, cart detour, blocked-route recovery, pause/reset, follow camera, debug geometry, export, fixture/room switching, mobile overflow and missing-navigation recovery. A pixel comparison verifies the actual room wall hides a resident behind it and that disabling collider depth exposes the same resident. See [combined validation](evidence/combined-validation.json) and [walking screenshot](evidence/combined-walking.png). The sample-based browser suite separately checks the earlier movement fixture and rendering recovery.

Future changes to room transforms, collider or character clearance require navigation/anchor revalidation. The source photos guide appearance; generated unseen regions and approximate dimensions remain explicit limitations.
