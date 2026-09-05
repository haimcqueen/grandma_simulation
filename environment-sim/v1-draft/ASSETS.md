# Replacing the house visuals

Edit `src/visualConfig.ts` and place self-contained GLB models or a 2:1 equirectangular JPG/PNG panorama in `public/environment/`. Empty `assets` uses the authored placeholders. No generation service is required at runtime.

```ts
export const visualConfig: EnvironmentVisualConfig = {
  background: { panoramaUrl: "/environment/garden-panorama.jpg" },
  assets: {
    "ground:sofa": { url: "/environment/linen-sofa.glb", rotationY: Math.PI / 2 },
    "ground:dining-table": { url: "/environment/oak-table.glb" },
    "upper:bed-upper-primary": { url: "/environment/primary-bed.glb" },
    "ground:shell": { url: "/environment/ground-shell.glb", scale: 1, offset: [0, 0, 0] },
    "upper:shell": { url: "/environment/upper-shell.glb" },
  },
};
```

The files above are illustrative paths, not bundled assets. Omit entries until their files exist.

## Component responsibilities

| Component | Owns |
| --- | --- |
| `environment.ts`, `upperFloor.ts` | Stable IDs, floor layouts, furniture footprints, destinations |
| `navigation.ts`, `simulation.ts` | Route planning, movement, active floor, state and time |
| `stairs.ts`, `stairView.ts` | Stair route/dimensions and its replaceable default renderer |
| `houseAppearance.ts` | Reusable procedural finishes and default architectural/furniture detailing |
| `environmentAssets.ts` | Visual slots, imported model loading, placement, swapping, restore, disposal, background |
| `visualConfig.ts` | Asset choices; no simulation logic |
| `scene.ts` | Assembling visual components, cameras, lighting, and character presentation |

Furniture slots are `ground:<HouseObject.id>` and `upper:<HouseObject.id>` for furniture in those layouts. Additional slots are `ground:shell`, `upper:shell`, and `stairs`. `view.assets.ids()` returns the registered list.

The shell contains floors, walls and architectural details. Furniture is a separate visual slot; it stays visible when replacing a shell. Supply an unfurnished shell to avoid baked-in duplicate furniture. The robot and scenario obstructions are separate from shell replacement.

## Placement and navigation contract

- Furniture is rotated by `rotationY` and uniformly scaled to fit **inside its existing horizontal footprint**. The imported model's bounding-box center is aligned to that footprint and its bottom is grounded at the floor. Its proportions are preserved. Furniture `scale` and `offset` are intentionally ignored; edit the authored layout to move or enlarge an obstacle.
- Shell and stair assets use their authored coordinates, with optional `scale`, `offset`, and `rotationY`. Use metres and Y-up. Upper-floor assets are authored at local floor y=0; the scene adds the 3.06 m storey rise.
- These are visual replacements. They do not change collision geometry, destinations, hazards, or the stair route. A materially different building layout needs updated layout data and navigation checks. A photorealistic mesh does not automatically provide usable collision or route data.
- Floors remain selectable through physical stair traversal. Imported shells should supply the same stair opening and doorways. A generic GLB shell is shown as supplied; it does not automatically gain the authored shell's camera-dependent cutaway behavior.
- The current loader supports ordinary GLB/GLTF. Draco/KTX2 decoder setup and Gaussian splat rendering are not configured. World Labs splats need a Spark-backed adapter; a textured mesh export can use the current loader.

## Runtime API

```ts
await view.assets.replace("ground:sofa", { url: "/environment/sofa.glb" });
view.assets.restore("ground:sofa");
await view.assets.setBackground({ color: "#dce7ed" });
const results = await view.assets.apply(visualConfig);
```

Failures preserve the current visual; independent successful replacements still apply. A later request wins over an earlier slow load. Restore cancels pending replacement for that slot and releases imported mesh resources. Authored fallback resources remain available. The default GLTF loader is injectable in `EnvironmentAssets`, so another asset provider can be added without changing the simulation. A custom renderer with non-mesh GPU resources also needs corresponding cleanup support.

The asset tests verify footprint fitting with off-center imports, successful and failed replacement, resource release, asynchronous races, and partial configuration failures.
