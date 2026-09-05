# Map connections and collision audit

Updated 2026-09-05. Review locally at http://127.0.0.1:5174/?house=1.

## Map change

Map previously displayed only accepted floor cells and explicitly hid the 3D stairs. `src/house-map.ts` now projects the actual manifest connection onto the active floor, draws both flights and the landing, marks the entrance, and labels it Stairs up or Stairs down. Map framing includes that footprint. The existing Walk upstairs/downstairs button starts the journey; the footprint is an annotation, not an additional walking surface. Labels rebuild and dispose on floor changes. Top down and Side remain the realistic views.

## Why walking is restrictive

The current implementation uses the World Labs GLB collider to bake a grid, then uses that grid for both planned routes and WASD collision. A Gaussian splat is a visual representation; World Labs exports a separate coarse collider for physics: https://docs.worldlabs.ai/marble/export/specs. The desired behavior is collision aligned with the visible scene. Raw visual splats do not supply an unambiguous solid boundary or reliable floor support by themselves.

The house grid has 7.5 cm cells. Its 28 cm body radius is expanded to 33.3 cm to conservatively cover every point inside an accepted cell. Floor candidates must be within 16 cm of the nominal floor with a sufficiently horizontal normal. Eight surrounding support samples must agree within 12 cm. These checks can exclude visible passages when generated geometry is uneven or incomplete. Continuous positions in WASD still inherit these cell exclusions.

The baker now accepts an optional fifth path for a diagnostic JSON file containing per-cell rejection categories and the first blocking triangle contact for body collisions. It uses the existing decision process; it does not alter accepted cells.

```sh
cd environment-sim/v2
npx tsx scripts/bake-navigation.mjs public/environment/house/ground.json public/worlds/house-ground-collider.glb public/environment/house/ground-calibration.json .artifacts/ground-audit-grid.json .artifacts/ground-collision-audit.json
```

Observed counts across the entire bake rectangle (including space outside the room):

| First decision | Cells |
| --- | ---: |
| No accepted floor height/normal | 37,612 |
| Surrounding support or height difference rejected | 2,656 |
| Body collision after support passed | 355 |
| Reserved stair controller footprint | 1,996 |
| Accepted walking cell | 2,261 |

These are ordered rejection categories, not independent causes or a measurement of architectural floor area. Around `(0,-3)` and `(0,-4)`, the center floor exists but surrounding support fails. Near `(-1,-3)`, the nominal-floor test fails. `(1,-5)` is accepted but is in a disconnected patch. Simply reducing grid spacing or switching to a navigation mesh would not repair missing support.

## Next collision work

Recommended: introduce continuous capsule sweeps and support queries against checked geometry for manual motion; retain pathfinding for destination requests. Use the same collision/support interface when validating planned route segments so the two modes agree. Repair specific inaccurate collider surfaces against the rendered asset and source images, rather than declaring every rejected cell walkable. This is a proposed follow-up, not implemented in this map change. Grid-based movement remains in use.

No world regeneration, scale change, collision relaxation, or changes to the teammate's standalone ottoman calibration were made. The diagnostic rebake matches the existing house navigation file exactly. Build and the house walkthrough browser check passed, including upstairs/downstairs map labels, floor transfer, hall walking, WASD, and mobile layout.
