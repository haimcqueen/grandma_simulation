# Fall danger indicator

The walkthrough shows a prominent 520px card during a hazard-triggered fall and recovery, in every camera view. It hides when recovery completes or the resident resets. The ottoman scenario is authored as **High** fall likelihood at contact and **Moderate** danger intensity if a fall occurs. These are separate qualitative scenario ratings, not measured probabilities or injury predictions. Existing combined catalogue severity is not reused as either metric.

- Configure an object's `hazard.danger` in `environment-sim/v2/src/room-objects.ts`, or a host's `RoomHazardZone`. Both dimensions accept `low`, `medium`, `high`, or `critical`.
- `fall-danger.ts` defines reusable data types without UI dependencies. `Simulation` captures the triggering hazard and a copy of its ratings on `RoomFall.hazard`, so walking away during the fall does not change the card.
- `createFallDangerOverlay(host)` in `fall-danger-overlay.ts` mounts the UI. Call `update(fall, status)` and `dispose()` from any host; styles are isolated in `fall-danger-overlay.css`. The main walkthrough wires this into its render loop.
- Unrated hazards display **Not rated**. Manual fall demos show **Simulated fall** without attributing the fall to nearby furniture or retaining previous ratings.
- The card has larger text and colored bars, a prominent warning edge, polite heading announcements and a full-width mobile layout. Short screens can scroll the card; source links are keyboard-accessible. It does not alter collision, animation, or fall frequency.

Validation: `npm run build`, `npm test`, and `npm run test:ottoman` in `environment-sim/v2`. The browser check covers real keyboard-triggered contact, ratings through recovery in first and third person, reset, manual-fall attribution, mobile bounds, and the existing solid-object/floor checks.

Every displayed card includes three visible mitigation steps from `hazard-mitigations.ts`. Chair and ottoman advice is tailored to furniture placement and lighting; rugs, cords and slippery floors have their own actions. Unknown and manual falls receive general walkway/lighting recommendations. Keep this registry separate from scenario ratings. Advice is adapted from [NIA home fall prevention](https://www.nia.nih.gov/health/falls-and-falls-prevention/preventing-falls-home-room-room) and [CDC STEADI Check for Safety](https://www.cdc.gov/steadi/pdf/patient/customizable/checkforsafety-brochure-final-customizable-508.pdf), linked directly in the card.
