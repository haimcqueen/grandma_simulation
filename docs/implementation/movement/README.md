# Flexible movement handoff

Implementation dated September 5, 2026. Builds on the connected two-floor environment in `environment-sim/v2/`.

## Interaction

Open **http://127.0.0.1:5174/?house=1**. Click a visible floor to walk to that point. Drag still orbits. Shift-click appends waypoints to Path Studio. Use Map when selecting exact floor points; furniture, walls and unverified grid regions are not valid targets.

Path Studio accepts editable JSON, adds waits, loops, imports/exports and stops movement at the current position. A blocked command stops the program and offers Retry after clearing the obstruction. Picking a point on the other visible floor programs the stair transfer followed by the point request.

WASD/arrows take over from the current path. Diagonal movement slides along a clear axis when the full step is blocked, retaining the existing clearance checks. Walk toward a supported stair endpoint to enter it without a floor button. On the stairs, W moves forward, S backs along the connector, and releasing the key stops. Stop here also leaves the resident supported on the stairs. Turning/lateral movement on the narrow connector is constrained to its checked centerline; this is not unrestricted stair physics. Backtracking to the starting endpoint returns control on the original floor.

The room grids remain conservative. These changes remove the fixed-destination/programming restriction; they do not declare every generated surface walkable. Expanding spatial coverage requires revisiting the collider bake and verifying floor support, not disabling collision tests.

## Reusable program API

`src/movement/program.ts` has no DOM, renderer or timer dependency. `MovementProgram` consumes a Simulation and calls its public point/destination/floor operations. Drive `advance()` once after the existing simulation step. Do not add a second loop.

```ts
const program = new MovementProgram(simulation, () => otherRoutine.stop());
program.run([
  { type: "walk", floor: "ground", point: { x: 1.275, z: 2.225 } },
  { type: "wait", seconds: 2 },
  { type: "destination", floor: "upper", id: "primary" },
  { type: "wait", seconds: 3 },
  { type: "destination", floor: "ground", id: "living" },
]);
// In the host's existing fixed step:
simulation.advance(dt);
program.advance();
```

The app exposes `window.houseLab.movement.run(steps, { loop: false })`, `.cancel()`, `.retry()` and `.snapshot()`. The on-takeover callback stops the legacy WalkingRoutine. UI/manual commands cancel the program before taking ownership. `Simulation.requestPoint({x,z})` supports a single arbitrary target and `stopMovement()` cancels current motion without teleporting. Named destinations still work.

Step types:

| Type | Fields | Meaning |
| --- | --- | --- |
| `walk` | `point: {x,z}`, optional `floor` | Reach this point using the active floor's geometry |
| `destination` | `id`, optional `floor` | Reach a named semantic anchor |
| `floor` | `floor` | Traverse a direct stair connection to that floor |
| `wait` | `seconds` | Wait using simulation time; pause freezes it |

Programs are JSON data, not evaluated JavaScript. Validation accepts 1–256 steps and finite coordinates/waits. Floor and destination references are checked before movement begins; actual reachability is checked as each step starts. A new script cannot start midway through a stair transfer or fall; finish/backtrack first. Reset cancels the program. Import/export files contain the command list, not large world assets.

## Ownership for parallel agents

- Environment contributor: floor grids, assets, transforms, connection endpoints.
- Movement contributor: `movement/program.ts`, `stair-motion.ts`, point requests and manual movement behavior.
- UI contributor: `movement/studio.ts` is optional and separate from the executor.
- Character contributor: consumes the same position/elevation/heading and actual travel; never moves the actor root independently.
- Integration owner: keeps `main.ts` as the one loop and coordinates changes to `simulation.ts`/`viewer.ts` with hazard work. Do not fork a competing v2 folder.

`stair-motion.ts` samples reversible distance along the connector. Floor transfer state records progress/manual ownership; W/S changes progress while the original room grid is bypassed only for the authored supported connector. Generic path commands continue to use A* and checked segments.

## Validation

Unit checks cover arbitrary targets, obstacle replanning, cross-floor programs, paused waits, retries/manual cancellation, staircase entry/reversal, wall sliding, malformed input and bounded zero-wait loops. Browser checks exercise real canvas clicks, Shift-click waypoints, wait editing, Stop here, WASD takeover on stairs, reversal and mobile layout.

Run `npm run test:movement`, `npm run test:house`, and `npm test`. With Vite running, use `npm run test:movement:browser` and `npm run test:house:browser`. Integration with current remote hazard/recovery work is tracked in the final commit/handoff update.
