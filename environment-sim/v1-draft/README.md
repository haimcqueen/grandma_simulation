# Tantau · House lab

An interactive two-floor house prototype. Select a destination, place an obstruction, and watch a fictional resident detour or report a blocked route.

## Run

Node 22.12+ (tested with Node 24.18.0).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server binds to localhost. For a production build, run `npm run build`.

## A 45-second demo

1. Choose **Kitchen** with the passage **Clear**.
2. Press **Reset resident**, select **Add cart**, and choose **Kitchen** again. The resident takes a longer route around the island.
3. Reset, select **Block route**, and choose Kitchen. The observation explains that no route exists.
4. Select Clear. The same task resumes.
5. Choose **Garden** to walk through the covered patio onto the lawn, then choose **Living room** to return indoors. You can also drive across the patio–garden boundary with WASD / arrow keys in any camera mode.

Changes work during movement. An obstruction placement is rejected if it would overlap the resident. Pause freezes simulation time and movement; reset preserves the selected scenario and speed. Destinations are also clickable rings in the scene.

The garden is an illustrative lawn beyond the patio, sharing its ground elevation. Routes and manual movement use the same walkable boundary; the surrounding backdrop is not navigable. Leave the optional patio fall trigger off for an uninterrupted walk outdoors. `node tests/garden.browser.mjs` checks garden arrival and return indoors against the running app (`BASE_URL` overrides its URL).

## Implementation contract

- `src/environment.ts`: stable object and destination IDs, authored footprints, scenario obstacles, and floor regions. Coordinates use metres and a right-handed Y-up frame; plan front is +Z. No geographic bearing is asserted.
- `src/navigation.ts`: eight-neighbour A* on a 0.2 m grid, conservative 0.28 m resident clearance, no diagonal corner cutting, and collision-checked route simplification. Furniture and walls use the same footprint data as rendering.
- `src/simulation.ts`: the sole owner of resident, task, scenario, clock, and observation state. Calls: `requestDestination`, `setScenario`, `advance`, `reset`. Changes increment the environment revision and synchronously replan active tasks. There are no asynchronous navigation results.
- `src/scene.ts`: Three.js presentation and destination picking. Character forward is +Z; heading rotates around Y. Walls are cut down in overview cameras; first-person uses full-height walls and ceilings. No splat loader is integrated.
- `src/main.ts`: controls and one fixed-step 60 Hz simulation loop, with rendering at display rate. Long frame delays are clamped; background time is not replayed.

The resident starts with the cautious older-adult preset at 0.77 m/s. Use **Character** or keys **1–6** to select the older adult robot, adult, crawling infant, toddler, dog, or grandma figurine. Arrow keys / WASD steer directly; choosing a destination returns to route following. The speed slider overrides the preset's target speed. Mobility is not inferred from appearance. Known obstacles are always available to the planner. The prototype evaluates manually configured scenarios; it does not automatically identify hazards or predict falls.

## Character movement and grandma figurine

Use the camera buttons above the scene to switch between **Wide view**, **First person**, and **Third person**. Only one view is rendered at a time. First person uses the robot's head position (a body-relative eye estimate for models without a separate head) and hides the active body to avoid looking through its mesh. Third person follows behind the selected character; the wide view retains orbit and floor-plan controls. Camera switches preserve position, task, and playback state. **V** selects first person, **F** third person, and **Esc** returns to wide view. Scroll in third person to change follow distance. These views also work with the grandma figurine and fall animations.

`node tests/cameras.browser.mjs` checks camera switching, movement, pause, character changes, and mobile layout against the running local app (`BASE_URL` overrides its URL).

`src/robot/motion.ts` contains authored movement parameters: acceleration and braking in m/s², turn rate in rad/s, distance per full left/right gait cycle in metres, stance-time fraction, knee lift, and arm swing. The cautious preset uses shorter steps, longer time with both feet supporting the body, lower foot lift, and smaller arm swings. These are tunable demonstration values, not fitted human motion data or a rule about older people.

The simulation ramps speed, brakes at route waypoints, turns before continuing, and backs up more slowly. Actual travel drives the gait phase; turning in place also produces steps. Stopping blends the limbs into their resting posture, and pause freezes the pose as well as the position. Manual collisions stop movement and gait travel. Navigation still uses the prototype's shared 0.28 m clearance; the subject metadata's clearance and reach values are not a body collision model.

The supplied `public/robot/grandmother.glb` has its original materials and an illustrative height of 1.55 m. Select **GRANDMA FIGURINE** or press **6** to control it with the same keys, routes, pause, reset, and follow camera as the robots. Its unrigged body moves and turns as one piece; no limb animation is applied. When a robot is selected, the figurine returns to a togglable reference position beside the start. The reference is not a navigation obstacle. The supplied Tripo export is approximately 59 MB, contains one mesh, and has no skin, skeleton, or animation clips.

For a human character that walks convincingly, the next asset step is to rig and skin that mesh, then author or retarget walking, idle, start/stop, and turning clips. Those clips can be blended using the simulation's actual speed and heading, with foot-contact IK for planted feet. The current procedural robot gait has no foot-locking IK or balance physics; distance-linked phase and ground settling alone do not eliminate sliding. A static figurine cannot reproduce articulated walking until its limbs are rigged.

## Patio fall demo

The **Fall animations** panel now offers **Fall from balcony** and **Slip on patio**, a **Play / replay fall** button, and normal/half/quarter-speed playback. The selected grandma figurine can tumble as a rigid body; biped robots also brace with their arms and curl up after impact. Quadrupeds are excluded from these sequences. Pause freezes the animation, and reset returns to ordinary navigation.

The balcony is a separate illustrative set beside the house, not a surveyed feature of this ground-floor layout. The sequence walks toward its unguarded edge, follows a scripted drop from 2.8 m, lands, and holds an injured pose. The close camera frames the full height. These are authored visual outcomes; the motion is not a biomechanics model and does not calculate injuries. `src/robot/fall.ts` owns the timing and posing, and `Simulation` owns playback state and elevation.

Select a biped robot (keys **1**, **2**, or **4**), enable **Patio fall demo**, and choose **Patio** or steer into the amber patch. Entering the patch while moving triggers a 1.6-second authored stumble, bracing motion, and forward fall. The robot stays down and ignores drive/destination commands until **Reset resident**. Pause freezes the fall; changing passage obstacles does not cancel it. Reset preserves the demo setting, while selecting another character also resets a fallen robot.

The patch and trigger are explicit scenario choices, not a surface-friction simulation or a prediction of fall risk. The animation uses joint posing and ground settling, without ragdoll physics or full-body collision. The unrigged figurine and quadrupeds do not use the biped fall animation.

With Vite running, `node tests/animations.browser.mjs` checks balcony playback, slow motion, pause, replay, grandma selection, and reset. Set `BASE_URL` to use another local port. Screenshots are saved under `.artifacts/`.

## Source and accuracy

Listing research checked September 5, 2026:

- [Zillow listing](https://www.zillow.com/homedetails/10536-S-Tantau-Ave-Cupertino-CA-95014/19644938_zpid/): 6 bedrooms, 5 bathrooms, 2 stories, 2026 construction; 2,611 sq ft comprising a stated 1,899 sq ft main home and 712 sq ft ADU.
- [Matching listing floor plan](https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_42_1.jpg): plan total is 2,311 sq ft, conflicting with the listing total. Neither number is treated as a surveyed calibration.

This is an approximate, manually authored interpretation of the plan. Furniture, obstacle placement, some partitions, and dimensions are illustrative. ADU and garage are context geometry, with simplified partitions; the ground-floor demo destinations are the main living room, kitchen, patio, and garden. The garden dimensions are illustrative, not surveyed. Plants are decorative and kept away from the demo routes. Photographs and the source floor-plan image are not bundled. Google Fonts is optional presentation; system sans-serif fallbacks work without it. Runtime simulation requires no backend, account, or remote generation.

## Proposed next integration

The authored simulation is the current experiment, not a team-wide finalized architecture. A teammate can test a World Labs sample in a separate Spark viewer and return assets, measured load times, package versions, coordinate transforms, and alignment evidence. Check floors, openings, and visible furniture against navigation geometry before adopting that visual environment. Keep editable obstacles separate and avoid a baked-in duplicate in the splats.

## Checks performed — September 5, 2026

`npm run build`: TypeScript and Vite production build passed. Vite reports the main Three.js bundle exceeds its 500 kB advisory threshold (about 149 kB gzip).

`npm test`: seven tests passed covering all destinations, longer cart detour, blocked route/recovery, mid-route changes, placement overlap rejection, pause/reset, and segment safety.

With the dev server running, `node tests/browser.mjs` uses local Google Chrome through Playwright (override `BROWSER_CHANNEL` for another installed channel). Browser checks cover WebGL rendering, blocked route, cart detour arrival, reset, cameras, pause, mobile overflow, and uncaught page errors. Screenshots are written to ignored `.artifacts/`.

No World Labs generation, deployment, or real-world accessibility validation has been performed.


## House materials, upstairs, and connecting stairs

Use **Go to floor → Second floor**. The selected character routes to the staircase, walks up two flights, turns on the intermediate landing, and arrives upstairs. Choose **Ground floor** to walk down. The default overview changes to third person so the climb is visible; first person remains available. Pause freezes the approach and climb. Reset cancels the trip and returns to the start of the current floor. A blocked approach is rejected without moving the resident. Passage changes and new destinations are disabled during a floor transfer.

The upstairs recreation follows the user-supplied full floor-plan image: three bedrooms, primary bathroom/toilet areas, a shared bathroom, walk-in closet, hall, and staircase. The plan labels the second floor as 780 sq ft; the mesh is an approximate trace, not a surveyed or area-calibrated reconstruction. Furniture and vertical dimensions are authored. There is no upstairs balcony in that reference. The existing balcony fall scene remains a separate demonstration set.

`src/upperFloor.ts` owns the upstairs floor regions, collision footprints, and destinations. `Simulation` owns the active level, stair route, and elevation. `src/stairs.ts` defines a continuous route through a U-shaped staircase with an illustrative 3.06 m storey rise and 18 risers. `src/stairView.ts` renders the corresponding treads and rails. Ordinary movement stays on the current floor's navigation regions; a floor transfer follows the explicit stair connection. Robot legs use a higher knee lift while the body moves along the stair route. This is authored animation without per-tread foot IK, balance dynamics, or support-contact physics.

`src/houseAppearance.ts` adds locally generated oak grain, fabric weave, stone and plaster surface maps, softened furniture, cabinet fronts, worktops, windows, and ceiling details. These are procedural materials, not photogrammetry or a generated photorealistic World Labs environment. Overview cameras retain the cutaway; first-person uses the enclosing architecture. No remote generation or texture download is required.

Under **About this experiment**, **Download this floor's 3D layout (.glb)** exports a coarse geometry reference in metres with full-height walls. This is intended as input to World Labs Chisel or Blender; it omits rendered surface details, characters, routes, and scenario obstructions. Upper-floor exports use local y=0 at the upper floor, whereas the interactive scene places upstairs at y=3.06. See [the design and generation notes](../../docs/house-design.md) for the workflow.

Validation: `tests/floors.test.ts` covers upstairs route clearance, floor isolation, continuous ascent/descent, mid-flight pause, blocked approaches, and reset. `node tests/floors.browser.mjs` exercises the controls, stair animation views, upstairs arrival, return downstairs, GLB download/structure, and mobile layout with the development server running.
