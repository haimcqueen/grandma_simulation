# Flexible movement handoff

Implementation dated September 5, 2026. Builds on the connected two-floor environment in `environment-sim/v2/`.

## Interaction

Open **http://127.0.0.1:5174/?house=1** for the two-floor walkthrough. The development scenario controls remain at **http://127.0.0.1:5174/simulation.html?house=1**. The ordinary manual ground-room view remains at `/`.

Click a visible floor to walk; drag to orbit. Map helps inspect reachable space. The Path Studio panel and Edit path link were removed at the user's request: teammates author programs through the API below. There is no Shift-click editor or import/export path UI. The studio's existing scenario export still includes the movement snapshot.

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

Programs are JSON data, not evaluated JavaScript. Validation accepts 1–256 steps and finite coordinates/waits. Floor and destination references are checked before movement begins; actual reachability is checked as each step starts. A new script cannot start midway through a stair transfer or fall; finish/backtrack first. Reset cancels the program. Agents can store the command list in JSON and pass it to `run()`; it contains no world assets.

## Ownership for parallel agents

- Environment contributor: floor grids, assets, transforms, connection endpoints.
- Movement contributor: `movement/program.ts`, `stair-motion.ts`, point requests and manual movement behavior.
- UI contributor: `movement/pointer.ts` handles click walking on both pages, separately from the executor.
- Character contributor: consumes the same position/elevation/heading and actual travel; never moves the actor root independently.
- Integration owner: keeps one loop per page (`main.ts` walkthrough, `studio.ts` authoring studio) and coordinates changes to `simulation.ts`/`viewer.ts` with hazard work. Do not fork a competing v2 folder.

`stair-motion.ts` samples reversible distance along the connector. Floor transfer state records progress/manual ownership; W/S changes progress while the original room grid is bypassed only for the authored supported connector. Generic path commands continue to use A* and checked segments.

## Validation

Unit checks cover arbitrary targets, obstacle replanning, cross-floor programs, paused waits, retries/manual cancellation, staircase entry/reversal, wall sliding, malformed input and bounded zero-wait loops. Browser checks exercise canvas clicks, API-authored sequences, stopping, WASD takeover on stairs, reversal and mobile layout. The house walkthrough also checks clicking the authored hall floor and free lateral movement there.

Run `npm run test:movement`, `npm run test:house`, and `npm test`. With Vite running, use `npm run test:movement:browser` and `npm run test:house:browser`. The latest remote manual walkthrough and hazard/recovery changes were merged locally from `a78d2e9`. The detector now follows the active floor, transfer motion suppresses automatic falls, and hazard recovery resumes arbitrary point targets as well as named destinations. The default walkthrough keeps hazards and markers disabled on both floors. These changes remain on the feature branch pending push approval.

## Review and acceptance

The local feature branch is `feature/tantau-upstairs`. It includes an implementation commit and merge commits for the teammate's walkthrough/hazards and subsequent posture tuning to preserve the teammate's history. No force push or remote publication is part of this handoff.

Recommended two-minute review:

1. Open the connected walkthrough, move with WASD and try First person/Wide/Top down.
2. Choose Walk upstairs; press W to take control, release to stop, then S to backtrack. Resume W to reach the bedroom, then return downstairs.
3. Upstairs, click the hall floor, then use WASD to move and turn freely. Only the flights use constrained stair travel.
4. From the browser console or a teammate's host, call `window.houseLab.movement.run()` with the example above (named destinations are available in the studio; the clean walkthrough intentionally omits destination annotations).

No grandma mesh replacement was bundled into this change. That remains a separate adapter task; the downloaded model has only an idle clip. The spatial navigation region is still conservative, and stairs constrain manual travel to a checked connector. Additional upstairs rooms and foot-contact physics remain future work.

## Recorded integration checks

See [validation.json](validation.json) for the dated current results and [the layout/access review](../upstairs/layout-access-review.md) for the new enclosure, hallway and finer navigation bake. Earlier validation of the removed Path Studio UI is superseded. The teammate's posture, hazard and recovery modules are preserved. Local commits await approval before pushing.
