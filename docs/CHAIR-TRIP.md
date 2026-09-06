# Dining chair trip

The default walkthrough now has a contact encounter at the nearest dining chair already present in the scan. Walk grandma toward its leg/back from the open room. She catches a foot, reaches one arm toward the chair, makes a failed recovery step, braces, lands on her side, then gets up. The lower-left hazard card identifies **Dining chair · Trip and fall**, follows the catch/landing stages and shows **High** likelihood and **High** intensity as authored scenario ratings.

This is a walking trip involving the chair, not a seated fall or an invitation to climb onto it. It adds no duplicate chair mesh and does not change the scanned room. Coordinates and ratings are configured in `v2/src/room-hazards.ts`; this registration is limited to the Tantau room. The chair remains part of the scanned collision geometry.

`chair-trip.ts` contains the reusable 3.6-second choreography and root-motion curve. The movement is asymmetric: left-arm reach, counterbalancing right arm, a planted-leg attempt, collapse and a small impact settle. It ends at the existing sideways pose for continuous get-up animation. `RoomFall.chair` selects this track without changing the manual fall variants or ottoman support behavior.

The simulation requires movement into the encounter while facing the chair. It samples the entire proposed retreat curve against navigation and solids before starting, preferring a small diagonal retreat and falling back to a straight retreat. No clear landing path means no forced animation. Input is locked until recovery; the normal hazard re-entry suppression applies.

The animation is authored, not a physics-based prediction. Furniture positions come from the approximate scan. `npm run test:chair` checks actual arrow-key contact, reaching/catch stages, floor landing, hazard identity and ratings, lower-left placement, recovery, first/third camera persistence, and no trigger while moving away. `npm run test:ottoman` remains the solid-cushion regression check.
