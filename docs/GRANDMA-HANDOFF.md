# Grandma / Unitree teammate handoff

Updated 2026-09-05. Application: `environment-sim/v2`. Detailed adapter notes: [shared motion and mapping](parallel-work/character-adapters/GRANDMA-TOGGLE.md).

## Run after pulling main

From the repository root:

```sh
cd environment-sim/v2
npm ci
npm run dev
```

Use Node 22.12+ or 24+. Open **http://127.0.0.1:5174/?house=1** for the two-floor walkthrough or **http://127.0.0.1:5174/** for the single-room ottoman demo. Choose **Use Grandma** at the bottom right; choose **Use Unitree** to switch back. WASD/arrow keys and cameras work with either appearance. House mode also has click walking, Walk upstairs/downstairs, Top down, Side and a stair map. The studio remains at `/simulation.html` and retains its own character controls.

The grandma GLB is committed at `public/characters/grandma-idle.glb`; its texture and skeleton are embedded. Unitree assets are already in `environment-sim/v1-draft/public/robot` and imported by v2. Clone the whole repository, not just the v2 directory. No personal Downloads path, API key or Mint authentication is required to play. House assets stream from the existing manifests; optional local copies use `npm run fetch-house` (see [house asset handoff](implementation/upstairs/README.md)).

## What changed

- Added the human/robot toggle to both walkthrough hosts. It preserves simulation position, floor, heading, route, speed, pause and hazard settings. During falls or stair transfers the toggle is disabled; failed downloads retain the current model and allow retry.
- Replaced the oversized idle preview with a human skeleton driven by the existing G1 adapter. The human's initial stooped height matches G1 at approximately 1.145 m. There is no independent walking/fall animation implementation or human AnimationMixer.
- Added a human head anchor for first person, pose-aware floor grounding, and support on furniture during the latest teammate's forward ottoman fall. Furniture support checks the deformed human vertices over the supplied support footprint; it does not use the hidden robot's world position.
- Included teammate changes through `ee81cd3`: forward-only ottoman falls/recovery, support geometry and removal of the artificial carpet patch. Their Unitree motion modules remain intact.

## Reuse and division of work

| File | Purpose / safe extension point |
| --- | --- |
| `src/characters/grandma.ts` | Human-to-G1 joint map, neutral alignment, scaling, grounding and furniture support |
| `src/robot-resident.ts` | Shared source of gait, posture, fall and recovery poses; human adapter forwards motion inputs here |
| `src/viewer.ts` | `loadGrandma(posture?)`, `loadRobot(posture)`, one visible actor and camera integration |
| `src/main.ts` | Walkthrough toggle, loading/error state and swap guard |
| `public/characters/grandma-idle.glb` | Original downloaded human skin/rig; embedded idle clip is unused |

Other hosts can call `await viewer.loadGrandma("grandma")` and `await viewer.loadRobot("grandma")`. The viewer owns position, elevation and heading; adapters own mesh pose and dispose their resources. Keep the existing simulation update loop. Lower-level consumers can import `loadGrandmaResident`, forward `setMotion`, `setFall` and `update`, place `root`, and call `dispose` on replacement. The driver is not added to the rendered scene.

Character teammates can refine the human mapping or weights in the focused adapter without changing house geometry. Shared robot motion changes automatically feed the human adapter. Environment teammates should continue using house manifests and movement APIs; do not duplicate the application or move assets into private workspace docs. Coordinate changes to shared `main.ts` and `viewer.ts` before merging. The G1 mapping is not a general H1/Go2 or arbitrary-skeleton converter.

## Checks and limits

With the dev server running:

```sh
npm run build
npm test
node scripts/test-grandma-motion.mjs
node scripts/test-grandma-toggle.mjs
npm run test:ottoman
```

Run graphics browser checks sequentially. Motion checks cover posed height, knee motion, pause, rotated/elevated roots, three fall/recovery sequences, and human vertex support over furniture. Toggle checks cover both hosts, state preservation, WASD, cameras, both stair directions, fall/reset, failure rollback and mobile overflow. The ottoman check covers the teammate's robot contact/recovery behavior.

This is runtime pose retargeting, not identical robot/human geometry. Clothing, proportions and hand/foot placement can differ. Grounding/support is an authored approximation, not foot IK, triangle-level swept collision, a cane controller, ragdoll physics or validated biomechanics. Existing grid-access limitations remain; no new world generation or navigation expansion is part of this handoff. The original [adapter review](parallel-work/character-adapters/REVIEW.md) is historical; its idle-only recommendations are superseded by this implementation.
