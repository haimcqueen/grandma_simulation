# House Lab

**Hazards are integrated:** see the [hazard merge and reuse notes](docs/HAZARD-INTEGRATION.md) for zone configuration, profiles, popups and validation.

**Collaborators:** start with the [Unitree integration and reuse guide](docs/UNITREE-COLLABORATOR-GUIDE.md).

A browser-based house simulation with a photo-guided World Labs environment, the team's walking Unitree G1 robot, route planning and editable passage scenarios. The photo-guided room and robot demo is in **`environment-sim/v2/`**. V2 includes the team's Unitree G1/H1/Go2 bodies, articulated gait, arrow-key controls, first/third-person cameras and ground-level fall demos. Garden and upstairs reconstruction remain in **`environment-sim/v1-draft/`** and are not yet integrated into the realistic world.

## Quick start

Use Node 22.12+ or 24+:

```sh
cd environment-sim/v2
npm ci
npm run dev
```

Open **http://127.0.0.1:5174/**. The room and collider load from public runtime URLs without Mint authentication or API keys. The resident starts walking automatically. Choose a destination, add a cart or barrier, pause/reset, or switch to the follow camera.

## Download the house for local use

From `environment-sim/v2/`:

```sh
npm run fetch-world
cp .env.example .env.local
```

Uncomment `VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json` in `.env.local` and restart Vite. The fetch script downloads both the 43.45 MB RAD appearance asset and the 4.32 MB GLB collider, writes a local manifest, and records SHA-256 checksums. Large files live in Git-ignored `public/worlds/`.

Agents can also use `curl` with the URLs from `public/environment/tantau.json`; the following shell example requires Node and curl:

```sh
mkdir -p public/worlds
curl --fail --location --retry 3 "$(node -p 'JSON.parse(require("fs").readFileSync("public/environment/tantau.json", "utf8")).splatUrl')" --output public/worlds/tantau.rad
curl --fail --location --retry 3 "$(node -p 'JSON.parse(require("fs").readFileSync("public/environment/tantau.json", "utf8")).colliderUrl')" --output public/worlds/tantau-collider.glb
```

Prefer `npm run fetch-world`: it also creates the local manifest. Both files are needed—the collider alone does not contain the room's photorealistic appearance. No Google Drive upload is needed. Public URLs were verified on 2026-09-05; keep a local copy for demos.

## Team entry points

- [V2 app and character integration](environment-sim/v2/README.md)
- [Implementation handoff and validation](docs/implementation/v2/README.md)
- [Shared team foundations](docs/shared-specs/draft/TEAM-FOUNDATIONS.md)
- [Team character and multi-floor app](environment-sim/v1-draft/README.md)

The Unitree robot is replaceable through the resident API. The generated room approximates listing photos; dimensions and unseen regions are not surveyed. No full biomechanical model or automatic hazard detection is claimed.

## Bringing the room into the team app

V2 uses Spark to render RAD splats. The v1 GLB visual-slot loader cannot render the RAD directly, and the collider GLB is not a textured house. Reuse v2's `world-loader.ts` and rendering layers when integrating with v1, and reconcile coordinate transforms/navigation before moving v1 characters into this room. V2 incorporates the Unitree bodies and room-local fall poses; the garden and upstairs still require integration. See [the existing team handoff](docs/TEAM-HANDOFF-HOUSE.md) for those modules.

## Checks

Inside `environment-sim/v2/`, run `npm run build` and `npm test`. With the dev server running, use `npm run test:combined`. Browser scripts use installed Google Chrome via Playwright. Sample-based checks also require `npm run fetch-sample`. See the v2 README for the remaining scripts.
