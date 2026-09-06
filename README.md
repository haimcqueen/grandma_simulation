# STGS — Save the Grannys Simulation

**🥈 Second place · [Spatial Intelligence + Generative 3D Hackathon](https://luma.com/b101ml40)**<br>
Track 2: Physical AI & Simulation · September 5, 2026 · San Francisco<br>
Built by **Hai Bui, Katherine Wang, and Sean Tey**

STGS explores how interactive simulation can help identify potential household hazards and suggest ways to make homes safer for older adults.

Starting from photographs of a living space, we create an explorable 3D environment to examine how everyday objects and layouts affect movement and safety. The prototype demonstrates scenarios such as potential fall risks, using simulated interactions to illustrate hazards and present prevention recommendations informed by NIH and CDC guidance.

Thanks to **Founders Inc., Mint, Tripo, World Labs, and Convex** for supporting the event.

**[Presentation slides](https://canva.link/7pzzwal00fv0sf8)**

## Screenshots

![Third-person exploration with Unitree in the living room](docs/media/thirdpov-sample.jpg)

![World overview of the generated room](docs/media/wide-view-sample.jpg)

![Hazard explanation and home-safety recommendations](docs/media/fall-risk-sample.jpg)

## Demo

Explore the home, switch between Unitree and grandma, and encounter simulated hazards with explanations and prevention suggestions.

![STGS walkthrough and household hazard demonstration](docs/media/STGS-demo.gif)

## How it works

- **Environment:** Mint’s World Labs integration generates photo-guided 3D spaces. Spark renders the Gaussian splats inside Three.js, with matching collision geometry supporting navigation.
- **Objects and characters:** Tripo-generated objects add controllable geometry for household hazard scenarios. Unitree and grandma share movement and animation logic.
- **Safety scenarios:** Configured encounters trigger simulated responses, explanatory cards, and prevention suggestions informed by NIH/NIA and CDC guidance.

The prototype uses approximate geometry and authored scenarios; its ratings are not clinically validated injury predictions.

## Run locally

Requires **Node.js 22.12+ or 24+**.

```sh
git clone https://github.com/haimcqueen/grandma_simulation.git
cd grandma_simulation/environment-sim/v2
npm ci
npm run dev
```

Open **http://127.0.0.1:5174/**. Environment assets stream automatically; no generation API keys are needed.

**Controls:** Arrow keys to move and turn · **A** to switch characters · **F/V/B/M** for camera views · **R** to reset.

The [two-floor walkthrough](http://127.0.0.1:5174/?house=1) is available as a separate scene.

See the [development guide](environment-sim/v2/README.md) for local asset downloads, additional scenes, tests, and integration details.
