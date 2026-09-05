# Tantau house design and generation notes

The interactive app lives in `environment-sim/v1-draft`. The second-floor trace comes from the full floor plan supplied in this conversation on September 5, 2026. That image labels the second floor as 780 sq ft and shows three bedrooms, primary bathroom/toilet areas, a shared bathroom, walk-in closet, hall, and stairs. It does not show an upstairs balcony.

The existing ground floor is an earlier approximate interpretation of the same plan. The upstairs trace uses 0.019 m per reference-image pixel as a working scale, guided by the primary bedroom dimensions. Images, room labels, and the stated floor area are not enough for surveyed geometry. The two floors are fitted around the staircase for the simulation; furniture placement, wall heights, and stair dimensions are illustrative. The staircase rises 3.06 m across 18 authored risers. Continuous movement uses a controlled stair route and increased knee lift, without foot-contact IK or balance physics.

## Reusing this house with generation services

Recommended workflow for this interactive project:

1. In the app, choose the floor to export and open **About this experiment → Download this floor's 3D layout (.glb)**. The export is a coarse structural reference, with full-height walls and separate named objects. It is not an export of the detailed runtime appearance. Each export has local floor height y=0, metre units, Y up, and plan front +Z.
2. Import it in World Labs Marble's Chisel 3D-input workflow. Chisel accepts GLB and FBX, up to 100 MB. This provides a structural guide instead of asking a single floor-plan image to invent a navigable house. [World Labs input guidelines](https://docs.worldlabs.ai/marble/create/prompt-guides)
3. Generate a small test area first, ideally the living room and kitchen. Inspect doorways, wall placement, stairs, and furniture from several positions. Generation may reinterpret geometry; the output is not guaranteed to preserve the supplied plan exactly.
4. Export a textured mesh for ordinary Three.js loading, or splats plus a collider for a Spark integration. World Labs documents both high-quality meshes and simpler collider meshes; they serve different purposes. [World Labs mesh exports](https://docs.worldlabs.ai/marble/export/mesh)
5. Align the result to the current scene and validate scale, floor heights, openings, and navigation. Keep movable obstacles and characters separate. A generated collider is not automatically a navigation mesh, and baked-in furniture cannot be treated as independently movable.

Suggested prompt:

> A realistic contemporary California home interior based on the supplied architectural structure. Preserve the room arrangement, passage openings, kitchen island position, and staircase location. Warm white painted plaster, pale natural oak floorboards with subtle grain, oak cabinetry, honed limestone worktops, muted sage linen upholstery, charcoal metal window frames, and soft daylight. Real construction details: baseboards, door reveals, cabinet seams, believable wall thickness, and flush thresholds. Human-scale eye-level interior, uncluttered circulation, no people or robots. Enclosed rooms with ceilings, not a miniature or dollhouse presentation. Do not add furniture in the circulation paths.

Mint supports prompt/reference-image world generation and downloadable artifact manifests. Its documented world-generation request exposes image inputs; GLB structural input was not verified in that interface. [Mint generation](https://mcp.mint.gg/docs/tools/start_world_generation), [Mint artifact handoff](https://mcp.mint.gg/docs/tools/get_asset_artifact_manifest).

Tripo's image-to-model API supports textures, PBR materials, and GLB output. For this project, use it to produce individual furnishings that can keep separate collision footprints and behaviors. That is an implementation recommendation, not a guarantee about the fidelity of generated architecture. [Tripo developer documentation](https://developers.tripo3d.com/en/docs/generation-image-to-model/standard).

No World Labs, Mint, or Tripo environment generation was run in this session. The current appearance is locally authored and interactive. These services were researched, but no authenticated connection to them was available among the session tools.
