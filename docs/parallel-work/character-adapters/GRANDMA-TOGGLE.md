# Grandma appearance toggle and shared Unitree motion

Updated September 5, 2026 in `environment-sim/v2`. This supersedes the idle-only preview.

Open `/` or `/?house=1` and select **Use Grandma** at the bottom right. **Use Unitree** restores the robot. Switching preserves position, floor, heading, route, camera, speed, pause state, and hazard policy. Switching is disabled during a fall or stair journey. Failed loads keep the current actor.

## One motion implementation, two appearances

`src/characters/grandma.ts` loads the existing G1 adapter as a motion driver outside the rendered scene. It forwards `setMotion`, `setFall`, and `update` to `loadRobotResident`, then transfers the resulting joint orientations to the human skeleton. Gait, stoop, fall and recovery all come from the teammate's existing Unitree code; there is no separate human animation loop or duplicated gait implementation. The embedded idle clip is not played.

This is runtime pose retargeting, not replacing the robot's materials. The robot has rigid links, while grandma has a weighted skin with different proportions and bind axes. Fifteen explicit mappings cover hips, spine, head, upper/lower legs, feet, arms, forearms and hands. Calibration aligns neutral human limb directions with G1 before storing rest-pose orientation offsets. Each update converts source orientation changes into the human bone's parent frame. Unmapped spine, neck and shoulder bones inherit their mapped ancestors' motion.

Grandma is scaled once against the G1's measured posed height: approximately **1.145 m** in the current stooped preset, replacing the previous fixed 1.6 m. Scale does not oscillate during walking. Precise deformed-skin bounds settle her on the active floor after posing, including falls and upstairs placement. First person uses a head anchor. Navigation clearance, speed and simulation position stay unchanged.

The original asset is `public/characters/grandma-idle.glb`, copied from the user's `silver-sage-elderwoman-idle.glb` (2,920,148 bytes), including texture and rig. Teammates do not need a Downloads path or Mint credentials. No new generation or animation download was needed.

## Extension boundary

The shared Unitree rig/gait/fall files are unchanged. Teammates can edit those motions and the human adapter will consume their output. Adjust the mapping/calibration in `src/characters/grandma.ts` for a different human skeleton. This adapter targets the humanoid G1; it is not a generic Go2/quadruped retargeter. The separate `viewer.loadResident()` matching-clip API remains available for other assets.

Human proportions, clothing deformation and hand/foot placement differ from the robot. This does not make the human mesh geometrically identical to the robot's links or validate human-body obstacle clearance, cane contact, biomechanics or foot IK. Grounding is skin-bound based; walking on stairs uses the existing connector, not individual foot placement on treads. Further visual refinement can stay in this adapter without changing simulation behavior.

## Validation

- `npm run build`
- `node scripts/test-grandma-toggle.mjs`: both hosts, preserved state and hazard policy, WASD, first/third person, upstairs/downstairs, reset after a fall, robot restore, failed-load rollback and mobile layout.
- `node scripts/test-grandma-motion.mjs`: matched posed height, knee movement over a full gait cycle, frozen pause, rotated/elevated roots, finite geometry and floor contact through trip/backward/sideways falls and recovery.
- Side-by-side local screenshots in `.artifacts/grandma-unitree-motion.png` and `.artifacts/grandma-unitree-fall.png` were visually reviewed. These are ignored local evidence files.
