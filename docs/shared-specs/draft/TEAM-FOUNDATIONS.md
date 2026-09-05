# House simulation — shared foundations and coding-agent brief

**Status: early discussion draft. Updated 2026-09-05.**

We are exploring a browser-based simulation of older characters moving around a house, with possible household hazards and ways to examine different scenarios. The product, audience, behavior, realism, architecture, and division of work are still being discussed. This document gives teammates and their coding agents a common starting point; it does not record team consensus on every recommendation.

**Current focus: ship an interactive simulation.** Higgsfield, video generation, dream-to-trailer features, and a movie-production pipeline are outside the current work. Earlier research can remain useful background, but should not drive the implementation unless a teammate explicitly brings it back.

## How to use this document

Paste this entire document into your coding agent, or ask it to read the entire file. Add a short assignment such as:

> Read this brief as provisional context. I am exploring [environment / pathing / hazards / integration]. Our current code is in [location, if any]. Help me investigate and build [specific outcome]. Explain assumptions and suggest alternatives where useful. Work within this assignment; the brief is not authorization to implement every workstream.

If you have no assignment yet, discuss a useful bounded contribution with your teammate. Avoid independently creating a complete competing application. If a repository already exists, inspect its instructions and actual implementation before proposing scaffolding or dependencies.

An agent should begin by identifying the relevant existing code, stating its interpretation of the assignment, and pointing out the few uncertainties that materially affect the work. Continue useful independent exploration while those are discussed. Do not demand answers to every open question before making progress.

## 1. What we are exploring

Our rough concept has three related areas:

- **House environment:** represent the space, furniture, doors, and relevant conditions.
- **Character movement and behavior:** let one or more older characters navigate and perform simple activities.
- **Hazard scenarios and identification:** represent potentially problematic conditions, observe what happens, and explain relevant events.

These are workstreams, not fixed team sizes or permanent ownership boundaries. One person may cover several; people can pair or exchange responsibilities.

We have not decided whether the main experience is a sandbox, an educational demonstration, an analysis tool, or something more playful. We have also not decided whether characters follow scripted routines, respond to user commands, or choose activities autonomously.

A useful early question is: **what can a viewer change, and what visible difference should that change make?**

## 2. Tentative technical starting point

| Component | Suggested starting role | How settled is it? |
| --- | --- | --- |
| Three.js | Shared browser scene, cameras, meshes, animation, and visual overlays | Preferred foundation to align around; discuss before adopting an incompatible runtime |
| TypeScript | Readable interfaces between workstreams | Suggested default; preserve an existing team's workable setup |
| World Labs / Marble | Generate or supply the visible house environment | Intended avenue to explore; exact input, access, assets, and workflow unverified |
| Spark | Render World Labs Gaussian splats inside Three.js | Appropriate if the selected environment uses splats; not needed for an ordinary mesh-only scene |
| Blender | Optional geometry cleanup, props, character or animation preparation | Use when it solves an asset problem; not required for every contributor |
| Navigation / collision tools | Support routes and movement constraints | Open choice; Recast and Rapier are candidates, not mandatory dependencies |
| React / React Three Fiber | Optional UI or rendering integration | Follow the chosen project; do not introduce a second scene owner or migrate frameworks without a concrete need |
| Backend / Convex | Possible persistence or generation-job coordination | Optional; local fixtures and browser state may be enough for the first simulation |

Three.js and Spark are complementary. Three.js supplies the scene and rendering infrastructure; Spark handles splat rendering within it. Neither automatically creates household semantics, character routines, or hazard logic.

World Labs assets can help with appearance and coarse collision geometry. We still need to establish which spaces are traversable, which objects have behavior, and how scenario state is represented. A realistic-looking environment is not sufficient evidence of a working simulation.

Use one compatible dependency set in the shared application. Check actual package versions and documentation when integrating; avoid mixing code copied from different Spark/Three.js versions. A small loading experiment is more informative than assuming two examples are compatible.

## 3. A few agreements that prevent integration pain

These are proposed defaults worth settling early. Their precise field names can evolve.

### One spatial convention

Use meters, seconds, and a right-handed, Y-up simulation frame as a starting convention. Agree on character forward direction and rotation representation before exchanging animated assets. If using Three.js quaternions in serialized data, state the ordering explicitly, for example `[x, y, z, w]`.

Record source-to-simulation transforms at the asset boundary. Verify scale, orientation, floor height, and at least a few shared landmarks. Splats and collider exports may have different import requirements; do not assume the same corrective transform is always appropriate for both. Do not apply a transform again if a loader already handled it.

A picture that looks aligned from one camera is not enough. Use an overlay or simple reference objects to check alignment from multiple views.

### Stable identity and shared state

Give meaningful objects, characters, destinations, and zones stable IDs. References should use those IDs rather than depend on a mesh's position in an array or display name.

Keep simulation facts accessible outside rendering code. A household object may have an ID, transform, shape, label, and state; its rendered mesh is one representation of that object. This lets pathing and hazard logic work against a small fixture without needing a complete splat renderer.

Avoid three independently mutable copies of the house. Each state category should have a clear owner, and other modules should request changes or consume snapshots/events. A door movement or obstacle edit should reach navigation, hazard evaluation, and visualization consistently.

### One time source and update owner

Use one application loop to advance the simulation. Modules should accept elapsed simulation time rather than start unrelated animation loops. A fixed simulation step is a useful default, with rendering running separately at the display rate.

Support reset early. Pause and restart should not duplicate characters, event subscriptions, or timers. For comparisons, preserve scenario settings and any random seed; identical seeds alone do not guarantee deterministic behavior across every engine or asynchronous operation.

### A shared small fixture

Agree on a tiny example house or floor layout, one character spawn, and a couple of named destinations. This fixture is an integration aid, not a final visual design.

Everyone should be able to run their part against it. The environment can later improve while preserving or explicitly updating the fixture's spatial contract.

## 4. Workstream A — house and environment

**Purpose:** provide a scene that movement and scenario logic can meaningfully use.

Explore the simplest suitable representation. A generated splat house with checked proxy geometry is one option; a conventional mesh house is another. A blockout is useful during development, but the final visual and simulation layers should agree on relevant obstacles and openings.

Possible responsibilities:

- Load and present the selected house asset.
- Establish scale and coordinate transforms.
- Define floors, walls, openings, and obstacles needed by the first scenario.
- Label a small number of rooms, objects, and destinations.
- Keep movable or switchable objects separate when they need independent behavior.
- Provide a debug view of geometry and object IDs.
- Report environment changes to the other systems.

A destination should identify where the character can stand to interact, not merely the center of a solid object. A chair might need an approach location distinct from its seat.

When using a splat backdrop, consider how edits remain visually honest. Moving a proxy chair while the original chair is still visible in the splats creates contradictory evidence. Choose a clean region, use a separate prop, or propose another representation that supports the desired edit.

**Example first handoff:** a small loadable scene, coordinate notes, checked obstacle geometry, a valid spawn, and two reachable destinations. Placeholder art is acceptable when labeled.

## 5. Workstream B — movement, pathing, and routines

**Purpose:** make characters move through the agreed space and expose what happened.

Separate the intent to go somewhere from route planning, movement execution, and animation. They can be simple functions; this does not require a large framework.

Explore a waypoint graph, grid, or navigation mesh according to the actual scenario. A waypoint route can prove an initial loop; if the demo lets users move obstacles, route validity and replanning must reflect those changes. A navigation mesh is not interchangeable with a physics collider.

Possible responsibilities:

- Accept a character ID and destination ID.
- Plan a route using the shared geometry and the character's clearance.
- Move and turn the character along it.
- Switch between walking and idle animations.
- Report arrival, obstruction, cancellation, or no valid route.
- Replan or stop when relevant geometry changes.
- Add routines or multiple-character avoidance only when needed.

Keep character parameters explicit: speed, body clearance, turning behavior, and any other modeled ability. Do not derive a person's mobility from appearance or age alone. These are configurable fictional scenario parameters unless supported by a specific validated model.

A simple capsule or placeholder character is fine for early integration. Match the eventual walk animation to movement speed sufficiently to avoid obvious sliding.

**Example first handoff:** a character travels between the agreed destinations, stays out of walls, and reports a useful failure when no route exists.

## 6. Workstream C — hazards and scenarios

**Purpose:** make scenario assumptions explicit and produce understandable observations.

There are two different problems we may explore:

1. **Known scenario evaluation:** we place or label a condition and examine a character's interaction with it.
2. **Automatic identification:** an AI or geometry-based system proposes a potential hazard from an unfamiliar environment.

Either can be valuable, but label which one has actually been built. A manually marked zone is not automatic visual detection. An AI suggestion is not verified ground truth.

Possible first scenarios include an obstructed passage, a closed route, a marked slippery zone, or characters meeting in a narrow space. These are examples to discuss, not a required checklist.

Keep these stages distinct:

- **Condition:** an obstacle exists or a zone has a scenario label.
- **Exposure:** a character approaches, crosses, or is blocked by it.
- **Outcome:** the simulated task changes, fails, or triggers a deliberately modeled response.

Crossing a labeled zone does not by itself establish a real person's fall probability. Describe the prototype's results as observations under explicit simulation assumptions. A visual fall animation can illustrate a scripted scenario; it should not be presented as a validated biomechanical prediction.

Useful findings contain the relevant object/character IDs, time, rule or observation, and a short explanation. Avoid unexplained numerical danger scores. If a score is useful for a demo, label its meaning and assumptions and expose the underlying evidence.

Decide separately what the evaluator knows and what the character knows. A character may not have perceived a hazard that is visible in a developer overlay. Hazard findings should influence movement only through an intentional behavior policy; otherwise the simulation may make everyone avoid all danger automatically.

**Example first handoff:** one scenario can be enabled and reset, produces a reproducible event, and highlights why the event occurred.

## 7. Suggested integration vocabulary

Use this to discuss boundaries, not as a mandatory API to implement verbatim.

| Concept | Suggested information |
| --- | --- |
| Environment snapshot | Revision, object IDs/states, navigation geometry, destinations |
| Character state | ID, pose, movement profile, current task and route status |
| Route request | Character, destination, relevant environment revision |
| Scenario definition | Initial state, changes to apply, observation rules |
| Simulation event | Type, simulation time, affected IDs, supporting details |
| Finding | Observation, source/rule, affected IDs, explanation, uncertainty where applicable |

Illustrative operations:

```text
loadEnvironment(assetOrFixture)
requestDestination(characterId, destinationId)
applyEnvironmentChange(change)
advanceSimulation(timeStep)
evaluateScenario(snapshot, recentEvents)
resetScenario(scenarioId)
```

Illustrative events: `destinationReached`, `routeBlocked`, `environmentChanged`, and `hazardExposureStarted`.

Prefer a few explicit calls and events over a generic event framework. If an interface needs to change, show a small before/after example and coordinate the callers as part of the change. Avoid silently renaming shared fields in only one workstream.

When geometry changes, mark affected navigation data stale and prevent a character following an invalid route while a replacement is computed. Associate asynchronous results with the environment revision they used so late results do not overwrite current state.

## 8. An example shared milestone

This is a candidate integration exercise, not the decided product:

1. A character walks from the living room toward the kitchen.
2. A user places an obstacle in the passage.
3. The visible scene and obstacle geometry update together.
4. Movement detours, stops, or reports no route, depending on the layout.
5. An overlay explains the event using the character and obstacle involved.
6. Reset restores the original scenario and allows a clean comparison.

This gives all workstreams a small shared target without requiring a complete house, advanced animation, or automated hazard recognition. Suggest a better milestone if it more clearly serves the emerging idea.

Integrate a rough end-to-end version early. A polished isolated subsystem is less useful until its inputs and outputs have met the other workstreams.

## 9. How coding agents should collaborate

- Follow the teammate's actual assignment and repository instructions. This brief supplies context, not blanket permission for purchases, uploads, deployment, or external communication.
- Keep changes focused enough for another teammate to review and run.
- Reuse shared infrastructure when it exists. Coordinate changes to dependency versions, the application entry point, shared types, or the simulation loop.
- Make reasonable local implementation choices without repeatedly asking permission. Surface decisions that would create incompatible assumptions for other contributors.
- Explore alternatives with a bounded experiment and explain the result. Do not introduce a large dependency merely because it appears in this brief.
- Preserve teammates' work. Avoid unrelated formatting, restructuring, or replacement of their implementation.
- Use placeholders when an upstream artifact is unavailable, with the same agreed boundary and an explicit label. Do not quietly substitute mocked output for claimed working behavior.
- Test the meaningful behavior you changed. Include a happy path and the important failure case; avoid claiming system-wide validation from an isolated unit test.
- Keep API credentials server-side if remote generation is integrated. Persist generation request IDs; a timeout should not silently cause another paid submission.

A useful handoff is short and concrete:

```text
Implemented:
How to run or view:
Inputs expected / outputs provided:
Assumptions and provisional decisions:
Checks actually performed:
Known gaps:
Shared change or next integration needed:
```

## 10. Questions we can leave open for now

- Who is the intended audience, and what should they learn or be able to change?
- Are we modeling a fictional house, a generated house, or a captured real location?
- Is the core experience visual storytelling, scenario comparison, or hazard discovery?
- What does “simulate” mean for the first demo: scripted routines, goal-directed agents, or physical interaction?
- What should count as a hazard, and what evidence supports that label?
- How much control does the user have over furniture, characters, and routines?
- Do we need multiple characters, stairs, or multiple floors at all?
- Which single scenario would make the value clear?
- Does the pivot change the best competition track? Creative 3D & VFX was the earlier preference; the new simulation direction may warrant reconsideration.

Answer only the questions that affect the next useful step. Record a tentative assumption when needed, and make it easy to revise.

## 11. Keep evolving decisions easy to find

Maintain a small shared record with three labels: **proposed**, **trying**, and **agreed**. A suggestion in an agent response is not automatically a team decision.

For a consequential decision, record what was chosen, why, who needs to know, and what evidence would make us revisit it. Put current agreements in the shared brief or project spec; keep dated experiments and results in logs. Historical research and abandoned ideas should not masquerade as current requirements.

This file is portable team context. It should not require every teammate to have the preparation repository, a specific coding agent, or the same shell tooling. Once a shared application repository exists, keep the canonical implementation contracts and accepted product spec there and link them from this brief.

## 12. Reference entry points

These links are for targeted reading when needed, not a requirement to read every manual. Product APIs, access, and versions change; verify the selected workflow before depending on it.

- [Three.js documentation](https://threejs.org/docs/)
- [Spark getting started](https://sparkjs.dev/docs/)
- [World Labs interactive examples](https://docs.worldlabs.ai/api/interactive-world-examples)
- [World Labs export formats](https://docs.worldlabs.ai/marble/export/specs)
- [World Labs SPZ scale and coordinate metadata](https://docs.worldlabs.ai/api/rendering-spz)
- [Recast Navigation for JavaScript](https://github.com/isaac-mason/recast-navigation-js)
- [Rapier scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/)
- [Blender manual](https://docs.blender.org/manual/en/latest/)

Competition rules belong to the organizers. Consult the [event listing](https://luma.com/b101ml40) and [organizer resources](https://app.notion.com/p/fdotinc/Spatial-Intelligence-Hackathon-Resources-3ce7344e43da80e1a310d424f0b4c3bd). In the preparation workspace, `competition-info/current/` holds the sourced brief and unresolved questions. This document does not establish a team-size limit, open-source requirement, required sponsor stack, or formal judging rubric.
