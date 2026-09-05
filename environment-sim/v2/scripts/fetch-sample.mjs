import { mkdir, writeFile } from "node:fs/promises";
const root =
  "https://wlt-ai-cdn.art/example_exports/rustic_kitchen_with_natural_light/rustic_kitchen_with_natural_light";
await mkdir("public/samples", { recursive: true });
for (const [suffix, name] of [
  ["_500k.spz", "kitchen.spz"],
  ["_collider.glb", "kitchen-collider.glb"],
]) {
  const start = performance.now();
  const response = await fetch(root + suffix);
  if (!response.ok) throw Error(`${response.status}: ${name}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(`public/samples/${name}`, bytes);
  console.log(
    JSON.stringify({
      name,
      bytes: bytes.length,
      downloadMs: Math.round(performance.now() - start),
      source: root + suffix,
    }),
  );
}
