# Ottoman replacement and solid contact

The default manual walkthrough replaces the ottoman already visible on the living-room rug with the user's textured GLB. The four camera controls remain the only main UI; the previous cable, toy and demo-rug hazards remain disabled.

## Geometry and floor repair

`src/room-objects.ts` holds the model URL, fitted dimensions (0.74 × 0.54 × 0.80 m), position, source-removal bounds and contact definition. Placement is registered to the ottoman in the generated room, rather than adding another object beside it.

`world-loader.ts: removeObjectRegion` removes source splats using a local box edit and removes original furniture triangles from the collider. Matching per-fragment removal in the depth material prevents stale triangle fragments from occluding the replacement. The scan has no reliable floor beneath the original furniture, so a horizontal support patch is added within that removed footprint.

`replacement-navigation.ts` rebuilds only nearby navigation cells using floor/support rays and capsule-to-triangle clearance checks against the updated room collider. It copies the original grid, preserving unrelated cells and source descriptors. The replacement's solid footprint is then added to `Environment.objects` so walking cannot pass through it.

The visual repair is a small, feathered carpet patch with a contact shadow beneath the model. It renders in a separate floor pass before room depth and articulated objects. This ordering avoids the dark floor holes and triangle fringes caused by stale scan depth, while allowing grandma and the ottoman to occlude the repair normally. This local patch is an approximation to the rug, not recovered scan detail.

## Contact, fall and recovery

The imported ottoman is the only automatic hazard in the default walkthrough. Its detection envelope is narrowed to contact with its solid footprint plus the resident's clearance. It is solid even if automatic falls are disabled.

A contact fall finds a clear landing beside the ottoman, rather than routing a fall through its volume. Grandma recoils sideways before pitching forward onto the clear floor, rests briefly, and stands up. Keyboard input is locked during the animation and restored after recovery. Staying beside the same object does not retrigger it; leaving and returning rearms the encounter. If there is no clear landing path, solid contact blocks movement instead of forcing a fall through furniture.

The animation remains authored, with navigation/footprint collision and tested articulated-body clearance; it is not a rigid-body physics engine. Camera choice is preserved throughout.

## Reuse

- `RoomObject` / `loadRoomObject`: textured GLB fitting and placement.
- `Viewer.roomObjects`: object ownership across third person, first person, wide and map views.
- `Viewer.floorRepairs`: ordered floor repair rendering; disposed together with owned materials/textures.
- `createWalkthroughSimulation(environment, hazards)`: defaults to a clean manual session; this host explicitly supplies the single ottoman encounter.
- `RoomHazardZone.obstacle.solidId`: links contact behavior to the actual solid `EnvironmentObject`.
- `RoomFall.obstacle`: selected clear-floor movement for the contact animation.

The studio at `/simulation.html` still has its separate demo zones and controls. Other worlds do not inherit Tantau's replacement coordinates.

## Asset and checks

The browser GLB retains the user's textures and reduces the original 1.9 million triangles to about 40,000. See `environment-sim/v2/public/props/README.md` for reproducible preparation and sizes.

From `environment-sim/v2`, run `npm run build`, `npm test`, `npm run test:ottoman`, `npm run test:walkthrough`, and `npm run test:combined` (browser checks require the dev server). The ottoman browser check covers replacement ownership, the floor pass, pixel samples where gaps previously appeared, solid walking collision with falls disabled, arrow-key encounters in first and third person, fall/get-up, restored controls, and frame-by-frame body-link clearance against the ottoman's interior. Screenshots are in ignored `.artifacts/ottoman-*.png`.

Validation passed: production build, all 27 shared tests, ottoman browser check, walkthrough browser check, and combined studio browser check. The repaired-floor screenshot was visually reviewed after removing the gaps.
