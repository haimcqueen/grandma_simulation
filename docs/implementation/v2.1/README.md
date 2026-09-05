# V2.1 handoff — realistic camera views and cutaways

Updated 2026-09-05. Status: implemented and checked locally at the user's request. This is an incremental handoff for the shared [v2 application](../../../environment-sim/v2/README.md), not a second application or a package-version change. Integrated with remote main commit `8b602c0` (Unitree controls and falls). The v2.1 changes are intended for the same main branch; no separate app folder is needed.

## What teammates get

The existing photo-guided Tantau World Labs room now supports realistic Top down, Overview and Side views. Reversible cuts reveal the interior while the existing resident, destinations, routes and scenario obstacles remain in the same simulation. Inside, Third person (the `follow` mode) and First person restore the full room. Map remains a separate navigation diagram.

| View | Appearance and behavior |
| --- | --- |
| Top down | Actual splats viewed vertically from a perspective camera; ceiling/upper surfaces cut at the selected height. Rotation disabled; scroll zooms. |
| Overview | Actual room from an oblique angle; orbit and zoom, height cut and camera-facing reveal. |
| Side | Actual room from a lower exterior angle; orbit and zoom, height cut and camera-facing reveal. |
| Inside / Third person / First person | Full room with normal collider depth occlusion; cutaways disabled. Third person tracks the resident; First person uses robot eye position and hides the resident mesh. |
| Map | Orthographic navigation cells, resident, routes, destinations and dynamic obstacles. Drag pans and scroll zooms. Blank areas are blocked or unverified. |

Changing views preserves simulation state. Reveal interior toggles the cutaway; the wall-height slider defaults to 1.8 estimated meters above the environment floor.

## Run and share

From the repository root:

```sh
cd environment-sim/v2
npm ci
npm run dev
```

Use Node 22.12+ or 24+. Open **http://127.0.0.1:5174/** on the machine running Vite. This is a local address, not a public teammate preview. Each teammate can run their checkout; the default server binds to localhost.

The checked-in world manifest streams the existing RAD appearance and matching GLB collider without Mint authentication. For a local asset copy, run `npm run fetch-world`, set `VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json` in `.env.local`, and restart Vite. No new generation or API keys are needed for these views. Use the current checkout for v2.1; this handoff does not certify that an earlier shared ZIP contains these changes.

## How automatic hiding works

The ceiling cut removes rendered surfaces above `environment.floorY + viewer.cutawayHeight`. It is a height plane, not ceiling-object recognition.

In Overview and Side, the viewer raycasts from the camera toward a point 1.05 estimated meters above the resident's floor position. It searches for an obstruction between 1.0 meters and the selected cut height above the environment floor, excluding the final 0.3 meters of the sightline. When one is found, a camera-facing region is cut above a 0.65-meter base, with a 0.25-meter inset past the hit. This is recalculated during updates, so camera orbit, zoom and resident movement affect the reveal. Top down uses only the height cut.

Spark SDF opacity edits hide the splat regions. Matching clipping and shader cuts affect the depth occluder and wire overlay, so a visually removed wall does not continue hiding the resident. The original collision geometry and navigation grid still govern movement. Turning off Reveal interior, or switching to Inside/Third person/First person, restores full-room rendering.

## Integration boundaries

| File in `environment-sim/v2/` | Ownership / merge guidance |
| --- | --- |
| `src/main.ts` | Camera buttons, cutaway controls and the existing single application loop. Merge UI changes into this owner. |
| `src/viewer.ts` | Camera presets, active scene/camera, resident sightline and per-frame cut updates. Preserve simulation roots when switching between Map and the realistic scene. |
| `src/world-loader.ts` | Returns `cutaway`, `setCutaway(heightOrNull)`, `setFrontCut(normalOrNull, point, floorY)` and diagnostic `cutawayState`, alongside splats/collider/depth/wire. Keep appearance edits and depth cuts synchronized. |
| `src/style.css` | Camera/control layout and cutaway presentation. |
| `scripts/test-cutaway.mjs` | Realistic view, orbit/zoom, cut/restoration and mobile checks. |
| `scripts/test-top-view.mjs` | Map checks; despite its historical filename, this tests the navigation diagram. |
| `scripts/test-combined.mjs` | Combined room/movement regression, including a direct depth-and-resident render comparison for wall occlusion. |

Keep one renderer and update owner. `world.cutaway` must be added to the world scene alongside the splats; loading it alone does not apply the edits. Enable local clipping on the renderer. Apply asset transforms once, at loading, and use world coordinates for cuts. Keep the pinned Three.js 0.185.1 / Spark 2.1.0 dependency set when merging this implementation.

The merged app retains the team’s articulated Unitree bodies, keyboard controls, postures, skins, playback speeds and fall demos. See the [Unitree collaborator guide](../../UNITREE-COLLABORATOR-GUIDE.md). First-person controls remain separate from orbit/map controls.

The character teammate can continue replacing the resident mesh/animation through the [v2 integration contract](../../../environment-sim/v2/README.md#teammate-integration). Preserve feet-origin, +Z forward and simulation-owned pose. The reveal currently targets the one simulation resident; it does not automatically adapt to a different character's height or multiple residents.

For another house, provide appearance, matching collider, calibrated transforms, floor height and validated navigation/destinations using the [parallel house asset guide](../../parallel-work/house-assets/house-asset-guide.md). Camera framing derives from collider bounds. Recheck the cut heights and visibility for that scene; the current thresholds were tried on Tantau and are not a universal architectural model.

## Checks actually performed

After integrating remote main `8b602c0`, production TypeScript/Vite build, all 16 simulation tests and `git diff --check` passed. The build reports a large bundled Spark chunk; performance across a range of devices has not been established.

- `npm run test:cutaway`: passed actual-room Top down/Overview/Side selection, camera orbit/zoom, zoom-driven cut recalculation, cut-height/depth-plane alignment, toggle, Inside restoration, unchanged simulation snapshot and mobile overflow checks.
- `npm run test:top`: passed Map controls and simulation-state preservation checks.
- `npm run test:combined`: passed automatic walking, arrival, cart detour, passage blocking/recovery, pause/reset, Follow, geometry overlay, export, wall occlusion, environment switching, mobile layout and missing-navigation recovery.

The merged keyboard, room-fall and Unitree browser suites also passed: first-person walking, camera shortcuts, pause/replay/reset, all six robot presets in first/third person, posture/skin controls and slow playback.

These browser suites ran with installed Chrome and the local Vite server at `http://127.0.0.1:5174/`. Run them with the server running; reports/screenshots go to `.artifacts/`. [Saved reports](evidence/) capture this handoff's successful runs. Browser assertions and sampled screenshots do not establish perfect visibility at every camera position.

## Known gaps and proposed follow-up

The cuts are geometric regions, not individually segmented walls. Tall furniture and other baked objects in a cut region may also disappear. The sightline targets the resident, not every object in the viewport. A single sightline cannot guarantee complete visibility of the resident's body or every obstruction. There is no transition smoothing or hysteresis, so reveal boundaries can switch as the sightline changes.

The environment remains a generated approximation guided by listing photos. Overhead/exterior angles can expose soft or incomplete surfaces; scale remains unverified. Cutting the source appearance does not create missing geometry or establish a surveyed floor plan. Baked furniture remains fixed, and this update adds no automatic hazard detection.

Proposed next work, not a team agreement: validate a second scene, profile collider sightline queries on target hardware, and consider authored wall regions or several visibility samples if the team needs more selective reveals. Preserve the existing appearance/navigation separation while doing so.
