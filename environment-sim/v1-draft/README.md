# Tantau · House lab

An interactive ground-floor house prototype. Select a destination, place an obstruction, and watch a fictional resident detour or report a blocked route.

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
5. Try Patio, the floor-plan camera, and the navigation-clearance overlay under About this experiment.

Changes work during movement. An obstruction placement is rejected if it would overlap the resident. Pause freezes simulation time and movement; reset preserves the selected scenario and speed. Destinations are also clickable rings in the scene.

## Implementation contract

- `src/environment.ts`: stable object and destination IDs, authored footprints, scenario obstacles, and floor regions. Coordinates use metres and a right-handed Y-up frame; plan front is +Z. No geographic bearing is asserted.
- `src/navigation.ts`: eight-neighbour A* on a 0.2 m grid, conservative 0.28 m resident clearance, no diagonal corner cutting, and collision-checked route simplification. Furniture and walls use the same footprint data as rendering.
- `src/simulation.ts`: the sole owner of resident, task, scenario, clock, and observation state. Calls: `requestDestination`, `setScenario`, `advance`, `reset`. Changes increment the environment revision and synchronously replan active tasks. There are no asynchronous navigation results.
- `src/scene.ts`: Three.js presentation and destination picking. Character forward is +Z; heading rotates around Y. Walls are cut down to show the interior. No splat loader is integrated.
- `src/main.ts`: controls and one fixed-step 60 Hz simulation loop, with rendering at display rate. Long frame delays are clamped; background time is not replayed.

The resident starts with the cautious older-adult preset at 0.77 m/s. Use **Character** or keys **1–6** to select the older adult robot, adult, crawling infant, toddler, dog, or grandma figurine. Arrow keys / WASD steer directly; choosing a destination returns to route following. The speed slider overrides the preset's target speed. Mobility is not inferred from appearance. Known obstacles are always available to the planner. The prototype evaluates manually configured scenarios; it does not automatically identify hazards or predict falls.

## Character movement and grandma figurine

`src/robot/motion.ts` contains authored movement parameters: acceleration and braking in m/s², turn rate in rad/s, distance per full left/right gait cycle in metres, stance-time fraction, knee lift, and arm swing. The cautious preset uses shorter steps, longer time with both feet supporting the body, lower foot lift, and smaller arm swings. These are tunable demonstration values, not fitted human motion data or a rule about older people.

The simulation ramps speed, brakes at route waypoints, turns before continuing, and backs up more slowly. Actual travel drives the gait phase; turning in place also produces steps. Stopping blends the limbs into their resting posture, and pause freezes the pose as well as the position. Manual collisions stop movement and gait travel. Navigation still uses the prototype's shared 0.28 m clearance; the subject metadata's clearance and reach values are not a body collision model.

The supplied `public/robot/grandmother.glb` has its original materials and an illustrative height of 1.55 m. Select **GRANDMA FIGURINE** or press **6** to control it with the same keys, routes, pause, reset, and follow camera as the robots. Its unrigged body moves and turns as one piece; no limb animation is applied. When a robot is selected, the figurine returns to a togglable reference position beside the start. The reference is not a navigation obstacle. The supplied Tripo export is approximately 59 MB, contains one mesh, and has no skin, skeleton, or animation clips.

For a human character that walks convincingly, the next asset step is to rig and skin that mesh, then author or retarget walking, idle, start/stop, and turning clips. Those clips can be blended using the simulation's actual speed and heading, with foot-contact IK for planted feet. The current procedural robot gait has no foot-locking IK or balance physics; distance-linked phase and ground settling alone do not eliminate sliding. A static figurine cannot reproduce articulated walking until its limbs are rigged.

## Patio fall demo

Select a biped robot (keys **1**, **2**, or **4**), enable **Patio fall demo**, and choose **Patio** or steer into the amber patch. Entering the patch while moving triggers a 1.6-second authored stumble, bracing motion, and forward fall. The robot stays down and ignores drive/destination commands until **Reset resident**. Pause freezes the fall; changing passage obstacles does not cancel it. Reset preserves the demo setting, while selecting another character also resets a fallen robot.

The patch and trigger are explicit scenario choices, not a surface-friction simulation or a prediction of fall risk. The animation uses joint posing and ground settling, without ragdoll physics or full-body collision. The unrigged figurine and quadrupeds do not use the biped fall animation.

## Source and accuracy

Listing research checked September 5, 2026:

- [Zillow listing](https://www.zillow.com/homedetails/10536-S-Tantau-Ave-Cupertino-CA-95014/19644938_zpid/): 6 bedrooms, 5 bathrooms, 2 stories, 2026 construction; 2,611 sq ft comprising a stated 1,899 sq ft main home and 712 sq ft ADU.
- [Matching listing floor plan](https://ssl.cdn-redfin.com/photo/8/bigphoto/142/ML82056142_42_1.jpg): plan total is 2,311 sq ft, conflicting with the listing total. Neither number is treated as a surveyed calibration.

This is an approximate, manually authored interpretation of the plan. Furniture, obstacle placement, some partitions, and dimensions are illustrative. ADU and garage are context geometry, with simplified partitions; the three navigable demo destinations are the main living room, kitchen, and patio. Upstairs is omitted. Plants are decorative and kept away from the demo routes. Photographs and the source floor-plan image are not bundled. Google Fonts is optional presentation; system sans-serif fallbacks work without it. Runtime simulation requires no backend, account, or remote generation.

## Proposed next integration

The authored simulation is the current experiment, not a team-wide finalized architecture. A teammate can test a World Labs sample in a separate Spark viewer and return assets, measured load times, package versions, coordinate transforms, and alignment evidence. Check floors, openings, and visible furniture against navigation geometry before adopting that visual environment. Keep editable obstacles separate and avoid a baked-in duplicate in the splats.

## Checks performed — September 5, 2026

`npm run build`: TypeScript and Vite production build passed. Vite reports the main Three.js bundle exceeds its 500 kB advisory threshold (about 149 kB gzip).

`npm test`: seven tests passed covering all destinations, longer cart detour, blocked route/recovery, mid-route changes, placement overlap rejection, pause/reset, and segment safety.

With the dev server running, `node tests/browser.mjs` uses local Google Chrome through Playwright (override `BROWSER_CHANNEL` for another installed channel). Browser checks cover WebGL rendering, blocked route, cart detour arrival, reset, cameras, pause, mobile overflow, and uncaught page errors. Screenshots are written to ignored `.artifacts/`.

No World Labs generation, deployment, or real-world accessibility validation has been performed.
