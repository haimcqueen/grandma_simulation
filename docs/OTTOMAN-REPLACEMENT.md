# Ottoman replacement and solid contact

The default manual walkthrough replaces the ottoman already visible on the living-room rug with the user's textured GLB. The previous cable, toy and demo-rug hazards remain disabled. A compact danger card appears during falls and recovery.

## Geometry and floor repair

`src/room-objects.ts` holds the model URL, fitted dimensions (0.74 × 0.54 × 0.80 m), position, source-removal bounds and contact definition. Placement is registered to the ottoman in the generated room, rather than adding another object beside it.

`world-loader.ts: removeObjectRegion` removes source splats using a local box edit and removes original furniture triangles from the collider. Matching per-fragment removal in the depth material prevents stale triangle fragments from occluding the replacement. The scan has no reliable floor beneath the original furniture, so a horizontal support patch is added within that removed footprint.

`replacement-navigation.ts` rebuilds only nearby navigation cells using floor/support rays and capsule-to-triangle clearance checks against the updated room collider. It copies the original grid, preserving unrelated cells and source descriptors. The replacement's solid footprint is then added to `Environment.objects` so walking cannot pass through it.

The artificial carpet repair mesh has been removed. The splat eraser starts 7 cm above the object base, preserving the original photographed floor. Collider/depth removal still covers the full original bounds to remove scan fragments, and the invisible floor support remains for navigation. `Viewer.floorRepairs` stays available to other hosts but is empty in this room.

## Contact, fall and recovery

The default walkthrough includes the imported ottoman and the scanned dining-chair encounter (see `CHAIR-TRIP.md`). Its detection envelope is narrowed to contact with its solid footprint plus the resident's clearance. It is solid even if automatic falls are disabled.

A front contact tips grandma forward across the ottoman cushion, with no sideways displacement. The authored root moves up to 55 cm forward and returns to the initial contact point during recovery. Only the contacted solid is exempted from horizontal root blocking during this animation; the scanned navigation grid and other objects remain enforced. `obstacle-support.ts` grounds the posed body on the ottoman top using the world bounds of each articulated mesh, preventing links from sinking into the cushion during the fall or recovery. Top height comes from `RoomHazardZone.obstacle.baseY` (or the environment floor) plus the solid height.

Grandma rests supported on the ottoman, then withdraws and stands on the original floor. This is a forward trip across the cushion, not a somersault to a landing behind it. Keyboard input is locked during the animation and restored after recovery. Remaining at the same object does not retrigger the fall; leaving and returning rearms it.

The animation remains authored, with navigation/footprint collision and tested articulated-body clearance; it is not a rigid-body physics engine. Camera choice is preserved throughout.

## Reuse

- `RoomObject` / `loadRoomObject`: textured GLB fitting and placement.
- `Viewer.roomObjects`: object ownership across third person, first person, wide and map views.
- `Viewer.floorRepairs`: ordered floor repair rendering; disposed together with owned materials/textures.
- `createWalkthroughSimulation(environment, hazards)`: defaults to a clean manual session; this host explicitly supplies the single ottoman encounter.
- `RoomHazardZone.obstacle.solidId`: links contact behavior to the actual solid `EnvironmentObject`.
- `RoomFall.obstacle.support` / `createObstacleSupport`: reusable furniture support geometry and posed-link clearance.
- `RoomFall.obstacle.travel`: forward tipping distance, withdrawn during recovery.

The studio at `/simulation.html` still has its separate demo zones and controls. Other worlds do not inherit Tantau's replacement coordinates.

## Asset and checks

The browser GLB retains the user's textures and reduces the original 1.9 million triangles to about 40,000. See `environment-sim/v2/public/props/README.md` for reproducible preparation and sizes.

From `environment-sim/v2`, run `npm run build`, `npm test`, `npm run test:ottoman`, `npm run test:walkthrough`, and `npm run test:combined` (browser checks require the dev server). The ottoman browser check covers replacement ownership, the absence of the artificial floor patch, forward-only travel and return to contact, solid walking collision with falls disabled, arrow-key encounters in first and third person, fall/get-up, restored controls, and frame-by-frame body-link clearance against the ottoman's interior. Screenshots are in ignored `.artifacts/ottoman-*.png`.

Validated this update in an isolated snapshot: production build, all 27 shared simulation tests and the ottoman browser check passed. The floor and forward-fall screenshots were visually inspected; per-frame articulated-link clearance passed in first and third person.
