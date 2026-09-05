# Ottoman asset

`ottoman.glb` is a browser copy of the user-supplied `round ottoman 3d model.glb` (Tripo export).

- Source: 1,886,328 triangles, roughly 53 MB.
- Browser copy: 39,998 triangles, 27,177 vertices, 2,913,796 bytes.
- Original embedded base-color, roughness/metalness and normal textures are retained.
- Simplification uses meshoptimizer 1.1.1, targeting 40,000 triangles with a 0.002 relative error limit; measured error was 0.0004806.
- Room placement, dimensions, removal region and solid contact settings are in `src/room-objects.ts`.

To regenerate from the original file, from `environment-sim/v2`:

```sh
node scripts/prepare-ottoman.mjs '/path/to/round ottoman 3d model.glb'
```

The preparation script specifically handles this static single-mesh GLB layout. The full-resolution original is not modified or committed.
