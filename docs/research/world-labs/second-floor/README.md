# Upstairs photo review and proposed generation

Reviewed 2026-09-05. This records the initial photo review. The subsequently approved primary-bedroom generation and connected milestone are documented in the [upstairs handoff](../../../implementation/upstairs/README.md). See [photo-review.json](photo-review.json) for direct image links, confidence notes and the proposed first-run prompt.

Zillow lists 43 photos and two stories, but direct browser/gallery access was denied. Reviewed the same MLS ML82056142 photos served by Redfin, including the explicitly labeled second-floor plan. File numbers here refer to image filenames, not gallery positions. Upstairs assignments are visual inferences unless the image itself establishes the floor.

## Proposed order

1. Generate the primary bedroom from files 23–26: four matching views give the best coverage. Keep its ensuite doorway, but defer bathroom generation. Check the result before expanding.
2. Generate the landing/hall using file 20, with file 19 only as stair-material/connection context. The full hall is not photographed; use the traced v1 layout as an explicit approximation rather than claiming a recovered corridor.
3. Generate the front blue-bed room (21) and probable middle room (22) separately. Use 34 for the likely primary ensuite. Do not assign 35 or closet image 31 without further confirmation.
4. Assemble checked room assets against a shared upstairs layout. Align door openings and floor elevations, create navigation per floor and an explicit stair transition. Separate generations will not automatically join seamlessly. V1's 3.06 m rise is authored; independently generated v2 ground-floor coordinates must be reconciled with the upstairs/stair layout.

## Generation mechanics

The live Mint MCP schema accepts a prompt plus up to six public image URLs in `source_images`; `source_url` records provenance only. Use `start_world_generation` in the existing project after authorization, retain its asset ID and chat URL, follow returned polling instructions, then retrieve `get_asset_artifact_manifest` for appearance/collider artifacts. Auto mode proceeds to final output; review mode is appropriate if the user requests a preview checkpoint. The initial review submitted no task; the later approved submission is recorded in the upstairs handoff.

Mint's exposed start schema has no GLB structure field. Do not claim passing a floor-plan image constrains geometry. Marble's separate Chisel workflow documents GLB/FBX structure input; our v1 exporter could provide a coarse reference for that route, but access and execution through our MCP tools are not established.

Keep one simulator, with world-space transforms applied once, stable room/destination IDs, matched splat/depth cuts and validated navigation. Recheck walls, ceiling, door clearance, floor support and every destination before connecting floors. Source photos are sparse: unseen surfaces and connections remain approximations.

## Sources

- [Zillow listing](https://www.zillow.com/homedetails/10536-S-Tantau-Ave-Cupertino-CA-95014/19644938_zpid/)
- [Matching MLS photo gallery](https://www.redfin.com/CA/Cupertino/10536-S-Tantau-Ave-95014/home/886877)
- [Mint world generation](https://mcp.mint.gg/docs/tools/start_world_generation)
- [Mint artifact manifest](https://mcp.mint.gg/docs/tools/get_asset_artifact_manifest)
- [World Labs input requirements](https://docs.worldlabs.ai/marble/create/prompt-guides)
