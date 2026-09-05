import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = JSON.parse(
  await readFile("public/environment/tantau.json", "utf8"),
);
const folder = "public/worlds";
await mkdir(folder, { recursive: true });
const result = { ...source },
  files = [];
for (const [field, name] of [
  ["splatUrl", "tantau.rad"],
  ["colliderUrl", "tantau-collider.glb"],
]) {
  const response = await fetch(source[field]);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`${folder}/${name}`, bytes);
  result[field] = `/worlds/${name}`;
  files.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  console.log(`Downloaded ${name}: ${bytes.length.toLocaleString()} bytes`);
}
await writeFile(
  `${folder}/tantau-local.json`,
  JSON.stringify(result, null, 2) + "\n",
);
await writeFile(
  `${folder}/checksums.json`,
  JSON.stringify(files, null, 2) + "\n",
);
console.log(
  "Local bundle ready. Set VITE_WORLD_MANIFEST_URL=/worlds/tantau-local.json in .env.local to use it.",
);
