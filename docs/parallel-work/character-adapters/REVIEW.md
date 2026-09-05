# Grandma / Unitree adapter review

**Proposed**, reviewed September 5, 2026. No grandma integration or shared character API changes have been implemented by this review. This is separate from the [connected upstairs milestone](../../implementation/upstairs/README.md).

## Inspected asset

Local file: `~/Downloads/silver-sage-elderwoman-idle.glb` (2,920,148 bytes). Its GLB metadata contains one mesh, a 24-joint skin, one embedded image and one animation named `Armature|Idle|baselayer` lasting approximately 4.03 seconds. It has no external buffer/image URIs. Joint names include Hips, Head, LeftUpLeg, LeftLeg and LeftFoot. The armature has a 0.01 source scale; do not apply another centimetre conversion blindly.

This is a rigged idle character, distinct from the unrigged figurine mentioned in older team docs. No walking, stair, fall or get-up animation is bundled. Metadata inspection establishes structure, not a validated visual appearance, gait or retargeting result. Before paying for any generation, look for a matching walk export from the original rigging batch. Otherwise obtain or retarget a suitable clip, then verify bone binding and foot/root motion.

## Existing code worth preserving

The team's `robot-resident.ts` is already an adapter that starts no render loop or camera and accepts asset URLs. Its posture, gait, fall/recovery and joint code are reusable. Keep those modules owned by the character contributor; the environment should consume the adapter.

`viewer.loadResident(...)` and `viewer.loadRobot(...)` already offer two loading paths. The GLB loader expects model, idle and walk inputs, normalizes height and returns a feet-rooted actor. Keep one actor and simulation clock. A body replacement must preserve floor, position, heading, task, speed and pause state.

The existing GLB loader needs attention before using it as the shared contract:

1. It chooses the first clip without checking names/bone bindings. Supplying the same idle file as the walk URL would technically load but display idle while moving. Do not call that a finished walking character.
2. Its comment says the simulation owns horizontal motion, but the loader does not remove animated root/hips translation. Inspect clips and normalize root travel so animation cannot drift independently of navigation.
3. Its fixed `speed / 1.1` walk timing does not use measured stride or actual stair speed. Drive phase from distance or explicit actual speed, including stair ascent/descent.
4. Missing clips/invalid bounds throw after loading without disposing all assets; texture disposal is also incomplete. Handle failed swaps without leaking resources or losing the current actor.

These are review findings, not changes made to the teammate's loader.

## Proposed small shared boundary

Add a `src/characters/` directory for a character contract, registry, GLB adapter and matching-clip manifest. Retain the existing Unitree implementation behind a thin adapter; avoid moving its files during active collaboration. Make one small viewer/UI integration change after the adapters are independently tested.

Suggested interface: feet-rooted `root`, `metadata`, `update(frame)` and `dispose()`, with explicit capabilities such as walk, fall, recovery and stair animation. `frame` comes from the existing loop and contains simulation time/delta, actual travel, motion state and pause. An optional eye anchor lets first person work without the viewer knowing about robot internals.

Separate **appearance/model** from **movement/scenario profile**. A Grandma/Unitree selector should not silently change age assumptions, hazard policy, route clearance or walking speed. Unitree-specific skins/joints remain capability-specific UI. Unsupported fall or recovery controls must be disabled for a GLB until that adapter supplies them. During a fall or stair transfer, defer model swaps to a stable state unless the new adapter explicitly supports the current phase.

## Remote integration review

**Update:** the subsequent movement work integrates remote main through `797b1f7`, preserves its clean walkthrough/studio split, and resolves the floor-detector, transfer/fall ownership and prop-visibility items below. These findings remain as review history. Character capability handling remains proposed.

Fetched `origin/main` at `1d674c8`. It now includes hazard zones, automatic grandma falls and get-up recovery. Our local upstairs work is based on `d1f67de` and isolated on `feature/tantau-upstairs`. No remote code was overwritten or merged by this review.

Before merging:

- **Floor-specific detection:** remote `Simulation` constructs its `HazardTracker` once from the original environment's zones. Upstairs retains the same Simulation while changing environment. Reset/rebind the tracker on floor changes and scope triggered-zone state by floor, or downstairs zones can produce upstairs alerts at matching X/Z coordinates.
- **Transfer/fall ownership:** remote `updateHazards()` calls `playFall()` and then assumes `this.fall` exists. Our `playFall()` rejects an active floor journey. A textual merge without adapting that call can dereference null on the approach. Check the return value and define one policy: initially suppress automatic falls for the complete transfer, while ordinary floor travel retains the existing hazard behavior.
- **Visible props:** remote `RoomHazardView` already accepts environment data and sampled floor height. Reuse it, but apply the selected-floor visibility rule so ground props do not float through the upstairs-only view. Refresh it when the active floor changes.
- **Capability-aware recovery:** remote automatic falls key off the `grandma` posture, not whether the selected renderer can animate a fall/get-up. Gate that outcome through adapter capabilities before adding the grandma GLB. Preserve explicit profile selection separately from appearance.

The overlap is concentrated in `main.ts`, `viewer.ts`, `simulation.ts`, `contracts.ts`, package scripts and app docs. Avoid having multiple agents refactor these simultaneously. Merge the environment milestone and hazard lifecycle fixes as one focused integration change; add the character adapter afterward in a separate change.

## Suggested parallel work

- Environment contributor: owns house manifests, calibration, navigation and stair geometry; publishes endpoint/elevation contracts.
- Character contributor: owns model/animation manifests and adapter behavior; tests against a tiny floor plus stepped-height fixture without changing house assets.
- Hazard contributor: owns catalog, detector and outcome policy; accepts active-floor snapshots and adapter capabilities without controlling mesh placement.
- One integration owner: edits viewer/main/shared interfaces and runs the combined suites. Each contributor can work on a feature branch; do not copy a competing v2 app folder.

Required integration checks: floor change refreshes detector/props; no fall can corrupt a stair journey; grandma idle/walk are distinct; swapping Grandma/G1/H1/Go2 preserves simulation state; unsupported recovery remains disabled; pause/reset and both stair directions work with every supported adapter. No messages have been sent to teammates; this document is ready to share.
