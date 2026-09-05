# Fall danger indicator

The walkthrough shows a compact card during a hazard-triggered fall and recovery, in every camera view. It hides when recovery completes or the resident resets. The ottoman scenario is authored as **High** fall likelihood at contact and **Moderate** danger intensity if a fall occurs. These are separate qualitative scenario ratings, not measured probabilities or injury predictions. Existing combined catalogue severity is not reused as either metric.

- Configure an object's `hazard.danger` in `environment-sim/v2/src/room-objects.ts`, or a host's `RoomHazardZone`. Both dimensions accept `low`, `medium`, `high`, or `critical`.
- `fall-danger.ts` defines reusable data types without UI dependencies. `Simulation` captures the triggering hazard and a copy of its ratings on `RoomFall.hazard`, so walking away during the fall does not change the card.
- `createFallDangerOverlay(host)` in `fall-danger-overlay.ts` mounts the UI. Call `update(fall, status)` and `dispose()` from any host; styles are isolated in `fall-danger-overlay.css`. The main walkthrough wires this into its render loop.
- Unrated hazards display **Not rated**. Manual fall demos show **Simulated fall** without attributing the fall to nearby furniture or retaining previous ratings.
- The card has text labels alongside colored bars, a polite status announcement, no pointer interception, and a mobile layout. It does not alter collision, animation, or fall frequency.

Validation: `npm run build`, `npm test`, and `npm run test:ottoman` in `environment-sim/v2`. The browser check covers real keyboard-triggered contact, ratings through recovery in first and third person, reset, manual-fall attribution, mobile bounds, and the existing solid-object/floor checks.
