# House asset guide for parallel contributions

**Status: optional side-work guide. Checked 2026-09-05 against v2 at `af4341c`.** This is a proposed contribution workflow, not a new shared architecture or assignment for every teammate. It does not change the running simulator.

## What to produce

Pick **one small, connected scene**: a different house's living/kitchen area, a bedroom/hallway section, a courtyard, or a fictional room. Deliver its visual asset, matching collision geometry, documented transforms and, where feasible, a checked walking area with a spawn and two or three destinations. The receiving agent should be able to download the files and reproduce your checks.

The output is a reusable scene package. Character modeling, hazard rules, shared UI changes and whole-house assembly can stay with their existing owners. Start with a level area: the current v2 navigation baker is not a stairs or multi-floor solver.

| Readiness | What has actually been demonstrated |
| --- | --- |
| Visual preview | Image or panorama only; no claim of a working 3D scene |
| Environment ready | Final appearance and collider load together, with alignment evidence |
| Movement ready | Validated spawn, connected destinations and routes against that collider |
| Integrated | Shared app selects the scene, uses its cameras/labels, and passes scene-specific behavior checks |

A generation job saying “succeeded” alone does not establish the last two states.

## Keep contributions separate

Use your own branch or checkout and a unique slug, such as `oak-house-kitchen-alex`. Before creating a branch, follow the repository's Git identity instructions. Claim the scene and owner with your teammates to avoid duplicate paid generations; this guide does not send messages or create assignments automatically.

Suggested deliverable location, **separate from active simulation source**:

```text
scene-contributions/<scene-id>/
├── README.md              # Outcome, readiness, run steps, limitations
├── source-record.json     # Source links, prompt, job IDs and observations
├── world.json             # WorldAsset metadata and independent transforms
├── environment.json       # Spawn, destinations, bounds, scenario footprints
├── navigation.json        # Actual baked grid; omit until checked
├── calibration.json      # Measured/estimated scale, floor and bake settings
├── checksums.json         # Asset filenames, bytes and SHA-256
├── fetch-assets.mjs        # Downloads THIS scene; no embedded credentials
├── checks/                # Scene-specific validation scripts/results
├── evidence/              # A few useful screenshots
├── .gitignore             # Ignore assets/ and temporary outputs
└── assets/                # Local original binaries; not committed by default
```

Do not overwrite `tantau.json`, replace the app entry point, rename shared IDs, or change dependency versions while producing a scene. Experimental adapters belong in your branch/contribution folder with a clear integration note. Never copy private workspace-level preparation documents into the team repo as part of the handoff.

## Give your agent this assignment

Fill in the brackets, then paste this prompt with this guide:

> Read this guide fully and inspect the current repository instructions and simulator contracts. Build one optional environment contribution for **[scene ID / owner]**, using **[listing URL, photos, floor plan, or fictional description]**. The scope is **[specific connected room or section]**. Put its metadata, scripts and evidence in `scene-contributions/[scene-id]/`; do not edit the shared app or another teammate's files.
>
> First identify input coverage, available generation/export access, and uncertainties that affect scale or movement. Reuse the existing Three.js/Spark stack and source-to-simulation conventions. Produce final appearance plus matching collider, an honest source record, reproducible downloads, alignment checks and, if possible, a validated spawn and two or three reachable destinations. Keep the current placeholder for movement tests; character details belong to another teammate.
>
> Generation budget/access: **[already authorized budget or “prepare inputs and discuss before paid generation”]**. Preview preference: **[automatic completion or review preview first]**. Honor the permissions I have already given you; ask only for missing authorization, authentication or information I must provide myself. Persist job IDs and resume existing jobs after timeouts. Do not publish private reference media without permission.
>
> Inspect the final result from several viewpoints and test the actual scene. Label invented areas, estimated dimensions, unsupported passages and any mocked components. Explain the remaining shared integration work rather than silently changing core code. Finish with the handoff checklist below. Do not generate an entire competing application.

## 1. Collect inputs for one coherent space

For a listing, record the listing URL and retrieve the actual room photographs. Group views showing the **same connected space**. Note which openings, furnishings and materials are visible. Save dimensions only with their source; total property square footage does not determine a room's shape. If the listing is inaccessible, use supplied images or describe the missing evidence.

A few photos guide appearance; they do not prove unseen layout. Treat separately generated rooms as independent scenes until their doorway positions, floors, scale and overlap have been checked. Two prompts mentioning the same hallway do not create matching boundaries.

Suggested prompt, adapted to the supplied evidence:

> One coherent [room/section], guided by these photographs. Preserve [visible materials, openings and distinctive landmarks]. Show continuous open floor space between [intended destinations], viewed from [reference viewpoint]. No people. Keep [editable scenario prop] absent so the simulator can add it separately. Limit the scene to [boundary]. Unseen regions are approximate; do not invent additional floors or disconnected rooms.

Do not promise exact geometry preservation from a prompt. Keep furniture that must move or doors that must open out of the baked background, or document them as fixed.

## 2. Generate and retrieve final artifacts

Our existing Tantau example used Mint's World Labs workflow. Use the teammate's available connector/account; access on one person's machine does not establish access on another's. An agent can prepare inputs, submit within authorized scope, monitor a job, retrieve manifests and download files. Account login or missing export entitlement may require the user.

Mint's `start_world_generation` accepts reference images. **`source_url` is metadata only**: pass the actual images through `image_url` or `source_images`. Current modes are `auto` for final generation and `review` when the user wants preview review first. Follow the live schema and selected mode. [Mint generation documentation](https://mcp.mint.gg/docs/tools/start_world_generation).

Persist the project, asset/chat IDs, source images, prompt, generation mode and status before waiting. Poll the existing job; do not resubmit because a call timed out. A preview image is not the final world.

After success, request `get_asset_artifact_manifest` for the world and inspect its real fields. Mint documents artifact URLs, paths and loader hints; save the returned contract separately from our app manifest. [Mint artifact manifest documentation](https://mcp.mint.gg/docs/tools/get_asset_artifact_manifest).

For the existing v2 world loader, deliver:

- **Appearance:** a tested `.rad` Gaussian-splat asset, or a tested `.spz` asset.
- **Collision:** the matching `.glb` triangle mesh, with its own transform.
- **Metadata:** URLs, source records, transforms, byte sizes and checksums.

The collider GLB is not a textured house. A panorama is not a navigable 3D environment. If the provider instead supplies a textured GLB house, that may be useful to v1's ordinary mesh loader, but it requires a distinct integration path from v2's current splat world loader. Do not rename formats to make them appear compatible.

## 3. Download and share without account dependencies

Prefer the provider's durable public runtime URLs when available. We verified anonymous downloads for the Tantau RAD and collider; verify each NEW scene independently. Account entitlement and URL behavior can differ between assets.

Use `curl --fail --location --retry 3 URL --output FILE` or a scene-specific fetch script. Record byte counts and SHA-256 hashes, verify the output is the expected binary rather than an HTML login page, and test browser loading too. A successful curl download does not prove browser CORS or paged-streaming support.

Keep original files locally. Commit small manifests/scripts and useful evidence; distribute large binaries through approved asset hosting or a separate package. If provider links are temporary, provide an agreed durable mirror or an authorized local package. Google Drive is an optional fallback, not required by this workflow: sharing pages may return HTML, and direct browser streaming must be tested. Never put expiring signatures, credentials or personal keys in the public manifest.

The existing `scripts/fetch-world.mjs` is **Tantau-specific**. Copy/adapt its approach into your contribution's download script rather than overwriting its manifest or fetching the wrong house.

## 4. Establish the spatial contract

The current types live in [contracts.ts](../../../environment-sim/v2/src/contracts.ts), with validation in [asset-manifest.ts](../../../environment-sim/v2/src/asset-manifest.ts). Re-read them if the repository changes.

| Property | Current convention |
| --- | --- |
| Frame | Right-handed, Y up; X/Z describe the floor |
| Units | Meters, with estimated scale explicitly labeled; seconds |
| Character | Feet-origin root, forward +Z; default radius 0.28 m and height 1.7 m |
| Quaternion | Normalized `[x, y, z, w]` |
| Asset transforms | Separate position/quaternion/uniform positive scale for appearance and collider |
| URLs | Absolute application paths beginning `/`, or HTTP(S) |
| Identity | Stable unique scene/object/destination IDs |

Verify floor height and at least three distinctive landmarks from multiple viewpoints with collision wireframe visible. Check clearances at openings, not just walls from one camera. Record how scale was measured or estimated and keep `metricStatus: "unverified"` until physically supported calibration has been checked.

**Do not copy Tantau's scale 1.905, Y offset 1.2954 or X flip blindly.** Even the appearance and collider from one export may require different corrections. Apply each source transform once; document whether a loader has already applied any conversion.

World manifest shape (illustrative values and paths, not a verified room):

```json
{
  "id": "oak-house-kitchen-alex",
  "label": "Oak house kitchen",
  "source": "Photo-guided generation; unseen areas approximate",
  "splatUrl": "/worlds/oak-house-kitchen-alex/scene.rad",
  "colliderUrl": "/worlds/oak-house-kitchen-alex/collider.glb",
  "splatTransform": {"position": [0,0,0], "quaternion": [0,0,0,1], "scale": 1},
  "colliderTransform": {"position": [0,0,0], "quaternion": [0,0,0,1], "scale": 1},
  "metricStatus": "unverified",
  "camera": {"position": [0,1.5,0], "target": [0,1.2,-3]}
}
```

## 5. Prepare movement data

Use the existing [navigation baker](../../../environment-sim/v2/scripts/bake-navigation.mjs) in your checkout, supplying **your** world manifest, downloaded collider, calibration and output paths:

```sh
# Run from environment-sim/v2 after npm ci; substitute your contribution paths.
node scripts/bake-navigation.mjs WORLD_JSON COLLIDER_GLB CALIBRATION_JSON OUTPUT_GRID_JSON
```

Calibration needs `floorY`, `minimumX`, `maximumX`, `minimumZ`, `maximumZ`, and may set `cell`, `radius`, `height`. Current defaults are 0.15 m cells, 0.28 m radius and 1.7 m height. The baker samples a small vertical band around one floor, includes clearance for cell diagonals, and treats geometry within 0.12 m of the floor as noise. It will not automatically solve stairs, ramps, stacked floors or tiny trip hazards.

Build an `Environment` with the following fields, using measured/checked coordinates:

```text
id, label, provenance
floor: { x, z, width, depth }     # Bounding rectangle; the grid restricts traversability
floorY
objects: []                     # Additional axis-aligned blockers, if needed
spawn: { x, z }
destinations: [{ id, label, x, z }, ...]
passage: { x, z }
scenarioFootprints: { cart: { x,z,width,depth }, blocked: { x,z,width,depth } }
navigation: <the actual NavigationGrid object when building a runtime bundle>
```

Choose standing approach positions outside solid furniture. Test both directions between destinations, body clearance on every simulation step, reset, and a meaningful blocked route. If retaining the cart/barrier controls, place their footprints in this scene so the cart detours or reports blockage honestly, the barrier blocks the intended route, and neither overlaps the spawn. Do not reuse Tantau's scenario coordinates.

Run `validateSimulationEnvironment` from [simulation-environment.ts](../../../environment-sim/v2/src/simulation-environment.ts), then exercise `Simulation` and `planRoute` against your data. Do not declare a scene valid solely because the existing Tantau tests passed. The current grid validator checks the default character; other profiles require explicit revalidation.

For a larger house, return separate single-floor regions or independent scene packages with documented boundaries. Continuous room stitching, shared portals and multi-floor navigation are future integration work unless explicitly assigned.

## 6. Inspect and integrate honestly

In your own checkout, stage local assets in ignored `environment-sim/v2/public/worlds/<scene-id>/`. The environment inspection page accepts a `WorldAsset` or a bundle containing `world` through `VITE_WORLD_MANIFEST_URL`. Start Vite with a temporary environment variable and a free port; do not overwrite a teammate's `.env.local`:

```sh
VITE_WORLD_MANIFEST_URL=/worlds/SCENE_ID/world.json npm run dev -- --port 5180 --strictPort
```

Open `http://localhost:5180/environment.html` for appearance, collider and surface-anchor checks. Confirm the loaded asset ID: the inspection UI still has Tantau-specific labels and reference images, so those are not evidence for your new scene.

To enable walking for a non-Tantau world, build a runtime **`bundle.json`** containing `{ "world": <WorldAsset>, "environment": <Environment with navigation embedded> }`. Keep `resident` omitted to use the placeholder. Point `VITE_WORLD_MANIFEST_URL` to that bundle and open the main page.

A minimal packaging step in your contribution script is:

```js
const world = JSON.parse(await readFile(worldPath, "utf8"));
const environment = JSON.parse(await readFile(environmentPath, "utf8"));
environment.navigation = JSON.parse(await readFile(navigationPath, "utf8"));
validateSimulationEnvironment(environment);
await writeFile(bundlePath, JSON.stringify({ world, environment }, null, 2));
```

Import the file helpers and validator in your own script; run TypeScript imports with the app's existing `tsx` tool. This is packaging logic, not a provider request schema. A new world's `navigationUrl` alone does **not** activate movement: `main.ts` only automatically loads that descriptor for Tantau. Embed the grid for a custom bundle.

Current integration gaps to report to the receiving agent:

- `viewer.ts` has Tantau-specific simulation camera positions; adapt scene cameras in the receiving branch. Appearance inspection honors the manifest camera, but the simulation camera presets need generalization.
- Address text, source links and some labels are still Tantau-specific. Replace them when registering the scene; do not present Tantau source photos as provenance for another house.
- v1's team app has character, garden and multi-floor work. It uses a different environment/asset interface. Reuse the Spark world loader and reconcile navigation/coordinates with the owner; a v2 manifest is not a drop-in v1 GLB slot replacement.
- Render splat color, then the collider depth and characters/props as the existing v2 viewer does. Keep one scene/update owner and test occlusion; merely overlaying a character on a panorama is insufficient.

These gaps do not require every contributor to edit the shared app. Return a checked package and a bounded integration note; let the designated integrator make the shared changes once.

## 7. Handoff checklist

Deliver this short record in the contribution README:

```text
Scene ID / owner / revision:
Readiness: preview | environment ready | movement ready | integrated
Source inputs and inferred/invented regions:
Generation job/chat IDs and final status:
Download command, asset bytes, checksums and access requirements:
Appearance and collider transforms; scale evidence:
Spawn and named destinations; supported character profile:
Checks performed, commands, observed results and screenshots:
Known visual/navigation defects and unsupported areas:
Shared integration changes still required:
```

Include a useful interior screenshot, collider alignment view and route evidence. For movement-ready status, demonstrate arrival, no wall/furniture crossing, blocked-route response, recovery, pause/reset and character occlusion. Test a fresh download rather than relying on your authenticated browser cache. Record timings as observations on your device, not general guarantees.

The reference implementation is [v2](../../../environment-sim/v2/README.md); its source/job record is [here](../../implementation/v2/generation-record.json). The [shared foundations](../../shared-specs/draft/TEAM-FOUNDATIONS.md) explain why appearance, navigation, state and time ownership remain separate. Vendor tool details can change: recheck the live schema when starting a new job.
