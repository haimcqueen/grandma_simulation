# Hazard detection + Unitree integration

Updated September 5, 2026. Combines `origin/feature/hazard-detection` (`1c754b4`) with the modular Unitree work on `main` (`8b602c0`). The working application remains **`environment-sim/v2/`**, at **http://127.0.0.1:5174/**.

## What was combined

The feature branch contributed a condition-specific hazard catalogue, a reusable per-entity proximity tracker, dismissible popups, illustrative object builders and additional openings in the legacy house. Its changes targeted v1, predating the realistic world and newer floor/camera controls.

The merge preserves those contributions and the newer v1 floor, stair, camera, export and fall controls. Ground-floor hazard props follow the ground-floor scene group; ground-floor alerts are hidden upstairs and during floor changes.

V2 now consumes the same catalogue, tracker and object builders. Three authored demo zones are registered against **v2's own navigation grid**:

| Zone | Coordinates (x, z), metres | Exposure radius | Find it |
| --- | --- | --- | --- |
| Loose rug | 1.125, 1.325 | 0.55 m | Walk toward Rear passage |
| Loose cable | 1.275, -0.2 | 0.50 m | Walk toward Kitchen approach |
| Small objects | 1.725, -2.275 | 0.60 m | Arrive at Kitchen approach |

The props and zones are placed examples, not objects detected from the room images. Catalogue severity/reasons are inherited scenario data, not a validated risk model. The full catalogue remains available to collaborators; only these three floor-level examples are configured in the realistic room. The legacy house's 31 zones are not transplanted into unrelated coordinates.

## User behavior

- Arrow keys/WASD, route following, body selection, first/third person and fall playback continue to work.
- The **Hazards** profile can match the selected body or explicitly use an older-adult/toddler scenario. **Off** disables proximity alerts. Adult/upright/dog presets have no automatic condition mapping.
- A popup identifies the selected hazard and its authored rating/reason. It does not pause travel or force a fall.
- Dismiss suppresses the current zone until exit/re-entry. Changing the profile re-evaluates the same location immediately, including while paused.
- **Show demo hazard objects** controls appearance only. Detection remains active when props are hidden.
- Reset and explicit fall playback clear pending alerts. Changing environments creates a tracker with the new environment's zones; an unconfigured environment gets an empty zone list.
- Snapshot/export includes the hazard profile, pending hit, encounter events and environment zone definitions.

The realistic world still has no connected staircase/upstairs. The merge does not turn v1's staircase into geometry in the generated world.

## Module contract for collaborators

| Module | Responsibility |
| --- | --- |
| `v1-draft/src/hazards.ts` | Shared catalogue, condition mapping, severity/proximity lookup and legacy zones |
| `v1-draft/src/hazard-tracker.ts` | Independent per-entity entry/exit, pending alert, dismissal and reset |
| `v1-draft/src/hazard-props.ts` | Cosmetic, reusable object builders |
| `v2/src/hazards.ts` | Shared API exports, `HazardProfile` and `RoomHazardZone` types |
| `v2/public/environment/tantau-simulation.json` | The realistic room's `hazardZones` and prop scales |
| `v2/src/simulation.ts` | Drives tracker from actual movement, manages profile and encounter events |
| `v2/src/hazard-view.ts` | Places cosmetic props at the room's sampled floor height, with independent disposal/visibility |
| `v2/src/main.ts` | Popup, profile selection and visibility checkbox |

Use the tracker without importing a renderer or simulation:

```ts
import { HazardTracker } from "./hazards";

const tracker = new HazardTracker({ zones: environment.hazardZones ?? [] });
tracker.onEnter = (entityId, hit) => showPopup(entityId, hit);
tracker.onExit = (entityId) => hidePopup(entityId);

// Drive once per movement step, using the host's coordinate frame and chosen condition.
tracker.update("resident-01", { x, z }, "toddler");
tracker.dismiss("resident-01"); // Suppress until re-entry/profile change.
tracker.reset("resident-01");   // Forget the entity on reset/removal.
```

Always provide your own zone array. The underlying tracker's omitted default belongs to the legacy house. A zone is `{ hazardId, x, z, radius, room }`; v2 optionally adds `propScale`. IDs must exist in the catalogue and coordinates/radius/scale must be finite, with positive radius/scale. V2 validates these definitions when loading the environment. Place and inspect props against the correct room's floor/collider before enabling new zones.

The integration fixes two tracker edge cases: profile changes now participate in the zone key, and switching directly between zones emits exit before enter. Existing multi-entity state and dismissal semantics remain independent. Route steps are sampled at at most 0.15 m so long simulation steps do not jump over the configured demo zones. Proximity is horizontal and radial, without line-of-sight or per-limb contact checks; choose exposure radii accordingly.

Prop builders are cosmetic and do not become navigation obstacles. Stove/pot builders were changed to use zone-relative coordinates instead of hardcoded legacy positions, enabling reuse. Altering a prop or hiding it never changes the hazard catalogue or walkability grid.

## Validation

From `environment-sim/v2/`:

```sh
npm run build
npm test
# With the realistic app running:
npm run test:hazards
npm run test:combined
npm run test:unitree
```

All 23 v2 tests pass, including catalogue selection, tracker lifecycle, profile changes, per-entity independence, malformed definitions, actual-room zone placement, long-step route encounters, pause/reset/falls and empty-zone environments. The hazard browser suite covers arrow entry in first person, route encounters, dismissal, profile changes, independent prop visibility, fall/reset, environment switching and mobile layout. Combined route/obstacle/occlusion checks also pass. Browser evidence is in ignored `.artifacts/`, including `real-room-hazards.png`.

The legacy v1 build, 32 focused fall/floor/manual/gait tests and full stair/fall browser check pass after conflict resolution. A full v1 run passed 57/58 tests; the previously known randomized swarm clustering threshold failed (57% versus the required >60%). That unrelated stochastic test was not weakened.

See the [Unitree collaborator guide](UNITREE-COLLABORATOR-GUIDE.md) for body/keyboard APIs and setup, and the [v2 implementation handoff](implementation/v2/README.md) for rendering and navigation assumptions.
