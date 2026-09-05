# Stair placement and navigation review

Updated 2026-09-05. Implemented in `environment-sim/v2/` on `feature/tantau-upstairs`. This revision uses the existing two generated rooms. **Do not submit another world/splat generation without discussing it with the user first.** Local changes are prepared for review; pushing still requires approval.

## What the listing actually shows

The [matching MLS floor plan](https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_42_1.jpg) places the U stair in a side recess between the garage/foyer and great room. It does not stand beside the island in the middle of the living space. The upstairs landing connects to a hall; the primary bedroom is farther toward the rear. The main upper hall is labeled approximately 3 ft 5 in by 15 ft 8 in. Marketing dimensions are approximate.

The [ground stair photo](https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_19_1.jpg) shows white enclosing walls, oak treads and handrails, white risers with warm under-tread lighting, neighboring doors and the living-room fireplace beside the recess. The [upper landing photo](https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_20_1.jpg) shows oak flooring, glass balustrades, a tall stairwell window and an adjacent bedroom doorway. These are MLS filename suffixes, not Zillow gallery positions. See the [source review](../../research/world-labs/second-floor/README.md).

The previous implementation fitted a stair to a reachable kitchen-side endpoint. It crossed the open room and incorrectly delivered the resident directly into the primary bedroom. That arrangement is superseded.

## Implemented correction

- Moved the stair to the generated foyer-side branch, beside the fireplace side of the room, outside the central living/island circulation.
- Added an enclosing stairwell, landing window, white risers, oak treads/rails, glass panels and warm emissive tread strips. These are authored meshes informed by photos, not a newly generated scan. Emissive strips are a visual material effect, not simulated lighting fixtures.
- Repositioned and rotated the existing primary bedroom toward the rear. A roughly 4.2 m authored hall now separates it from the stair arrival. The hall floor and walls participate in navigation baking; WASD and click walking there use ordinary floor navigation, not the stair centerline.
- Replaced the broad cut through the living room with a rotated opening aligned to the stair recess. The same oriented bounds filter splats, visual depth, ray queries and bake collision checks. The bedroom doorway has an explicit opening with authored floor support through its threshold.
- Architectural walls follow floor selection and camera cutaways. Top-down/side framing includes the hall. Camera-facing walls reveal the structure; interior views restore the enclosure.
- Reserved the ground flight footprint in the house-specific navigation grid so ordinary floor walking cannot pass through the stairs. The controller takes over at the supported approach; descent uses the same connector in reverse.
- Removed the Path Studio panel and Edit path link. Kept WASD, click walking, floor buttons, and `MovementProgram` for agents. See the [movement API](../movement/README.md).

The listing's complete upstairs bedrooms/baths and garage are not reconstructed. The two generative assets do not perfectly match the plan. The corrected topology and photo-informed architecture improve the layout, but they are still an estimated assembly, not a measured digital twin.

## Why the room can feel too small

Appearance, collision and navigation are different layers. A visually open splat surface can be blocked by the generated collision mesh or excluded by navigation sampling. Enlarging the camera view or changing the splat scale alone does not repair that.

The previous 15 cm grid inflated the 28 cm body radius by another 10.6 cm to guarantee clearance everywhere within each cell. The revised 7.5 cm grid needs only 5.3 cm extra. Body radius, height envelope, floor support checks and collision tests are retained.

Measured on the original ground room before the house-specific stair reservation:

| Measure | Previous | Revised |
| --- | ---: | ---: |
| Grid spacing | 0.15 m | 0.075 m |
| Accepted cells | 520 | 2,392 |
| Accepted area, including disconnected patches | 11.70 m² | 13.455 m² |
| Area connected to spawn by adjacent cells | 10.4625 m² | 11.773125 m² |

This recovers about **12.5% more connected area** without shrinking the resident. The connected-area statistic is a grid diagnostic, not architectural floor area or a promise that every arbitrary straight segment is traversable. The house-specific grid also excludes the stair volume.

Remaining exclusions are real limitations of the current collision/support representation. For example, a visually floor-like sample near `(-1,-3)` has collider height about 0.173 m; the current accepted nominal-floor deviation is 0.16 m. Other nearby samples are sloped furniture surfaces or separate floor patches. A trial allowing 0.30 m deviation recovered only about 0.10 m² extra and was **not adopted**. Broadly relaxing collision or accepting elevated surfaces would not establish valid access.

Scale remains estimated from a nominal 10 ft ceiling. No evidence in this review justified a uniform rescale, which would also change the character/doorway relationship. Before considering regeneration, inspect specific disputed passages in Map and geometry view, compare the collider with the source photo, then make a bounded proxy repair only where the visible floor and obstacle boundaries support it. Do not silently make furniture or missing floors traversable.

## Files and regeneration of navigation

`public/environment/house/house.json` owns the floor links, stair points and enclosure frame (`stairwell`). Its local +X enters the stair recess and +Z points toward the rear; `yaw` rotates that frame into simulation coordinates. This yaw is approximately -150 degrees. Ground entry is `(-0.525, 0, 0.575)`; the upper landing is `(-1.175, 3.4, -0.550833)`. Other positions should be read from the manifest, not duplicated in consumer code.

`src/stair-structure.ts` supplies shared mesh walls/floors to the renderer and navigation baker. `src/stair-environment.ts` adds visible treads/rails. Changing only a mesh or only a route is insufficient: change the manifest, rebake and check the journey.

The house-specific environment ID is `tantau-ground-with-stair-navigation`; the standalone environment keeps `tantau-great-room-navigation`. Consumers should read IDs and anchors from `loadHouse()` instead of hard-coding them.

The house's ground descriptor/grid are separate from standalone `tantau-simulation.json`/`tantau-navigation.json`. This preserves the ordinary single-room app without a phantom stair restriction. Upper navigation includes the authored hall and the transformed bedroom collider. `WorldCutout.yaw`, when provided, rotates min/max bounds about their center; all consumers use the same convention.

From `environment-sim/v2`, after `npm run fetch-house`:

```sh
npx tsx scripts/bake-navigation.mjs public/environment/tantau.json public/worlds/house-ground-collider.glb public/environment/tantau-calibration.json public/environment/tantau-navigation.json
npx tsx scripts/bake-navigation.mjs public/environment/house/ground.json public/worlds/house-ground-collider.glb public/environment/house/ground-calibration.json public/environment/house/ground-navigation.json
npx tsx scripts/bake-navigation.mjs public/environment/house/upper.json public/worlds/house-upper-collider.glb public/environment/house/upper-calibration.json public/environment/house/upper-navigation.json
npm run test:stairs
npm run test:house
npm run test:movement
```

If using ignored local manifests, rerun `npm run fetch-house` after pulling these changes to refresh transforms/openings/links as well as asset copies. The asset URLs and checksums themselves have not changed. Runtime playback requires no Mint credentials.

## Review

Open **http://127.0.0.1:5174/?house=1**. Inspect Top down and Side, walk upstairs, click a point in the hall, move with WASD, enter the bedroom and return downstairs. The full scenario controls remain at `/simulation.html?house=1`. Blocking the island passage should no longer block the separate foyer stair approach.

[Reviewed ground view](evidence/layout-ground-reviewed.png) · [Reviewed side view](evidence/layout-side-reviewed.png) · [Authored stair entrance](evidence/layout-entry-reviewed.png). These show the current approximation, including the visual difference between authored architecture and the generated rooms.

See [validation.json](../movement/validation.json) for checks actually run. Stair clearance samples the generated colliders and authored enclosure with a body capsule; it permits normal tread-height contact but does not validate foot placement, balance or building-code compliance.
