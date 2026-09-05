# Manual room walkthrough

Updated September 5, 2026. The default app at **http://127.0.0.1:5174/** is now a full-screen room with grandma and four camera controls. This supersedes the earlier default studio experience.

## Current behavior

- Grandma uses the reusable `GRANDMA_STANCE` in `src/posture.ts`: deeper knees (0.62 rad), hip flexion (0.30 rad), stronger waist stoop (0.52 rad, the G1 joint limit), forward head and rounded shoulders. Ankle compensation keeps resting soles level.
- Grandma starts still. Arrow keys or WASD move and turn her; releasing movement brakes to a stop.
- First person, Third person, Wide and Map are the only visible controls. Camera selection persists while moving. Shortcuts: F, V, B and M respectively; R returns grandma to the spawn.
- Wide uses the existing room cutaway. Map uses the orthographic navigation map with pan/zoom.
- No right sidebar, automatic tour, body selector, floor props, destination rings, hazard alerts or hazard falls are loaded into this session.
- Room appearance, navigation, collision clearance, sampled floor heights, articulated grandma gait and camera occlusion use the existing shared modules.
- Loading failures show a retry control, rather than switching to the old fixture.

## Files and reuse

| File | Responsibility |
| --- | --- |
| `environment-sim/v2/src/main.ts` | Minimal browser shell, room loading, keyboard/view bindings and the fixed simulation loop |
| `environment-sim/v2/src/walkthrough.ts` | `createWalkthroughSimulation(environment)` and the four view definitions; no renderer or DOM dependency |
| `environment-sim/v2/src/walkthrough.css` | Full-screen canvas and responsive camera controls |
| `environment-sim/v2/src/viewer.ts` | Shared room/robot rendering, collision-aware follow camera, first person, cutaway and map |
| `environment-sim/v2/src/studio.ts` | Previous development studio, independently served by `simulation.html` |

`createWalkthroughSimulation` copies the environment wrapper and supplies empty hazard/destination arrays. It disables automatic hazard falls and starts manual control without changing the source environment, navigation grid or reusable hazard modules. This removes props and triggers together; it does not merely hide their meshes.

The source asset can still be replaced through `VITE_WORLD_MANIFEST_URL`. A bundled `environment` is validated before the walkthrough removes demonstration annotations. The Tantau manifest uses its existing navigation descriptor. Grandma uses the shared Unitree G1 asset adapter. The default page imports no studio markup, stylesheet or walking routine.

The combined studio browser check also passes on its new entry point.

The earlier studio remains available at **http://127.0.0.1:5174/simulation.html** for collaborator development. It is not linked from the walkthrough. Existing feature browser scripts now default to that page; `BASE_URL` overrides the full page URL. Its hazard/fall experiments remain isolated from the default experience.

## Verification

From `environment-sim/v2/`:

```sh
npm run build
npm test
# With npm run dev running:
npm run test:walkthrough
```

Build and all 27 shared simulation/hazard tests pass. The walkthrough browser check verifies a stationary start, no sidebar/props/markers, keyboard movement and braking in all four views, persistent view selection, movement across a former hazard area without falling, room collision, mobile layout, loading failure and retry. Desktop camera screenshots and mobile screenshots are saved under ignored `.artifacts/walkthrough-*.png` and were visually reviewed.
