// Prepare the static, single-mesh Tripo GLB; retain embedded textures and UVs.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
const [input, output = 'public/props/ottoman.glb'] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/prepare-ottoman.mjs source.glb [output.glb]');
const file = await readFile(input);
assert.equal(file.readUInt32LE(0), 0x46546c67);
const jsonLength = file.readUInt32LE(12);
const doc = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
const bin = file.subarray(28 + jsonLength);
assert.equal(doc.meshes.length, 1);
assert.equal(doc.meshes[0].primitives.length, 1);
const primitive = doc.meshes[0].primitives[0];
const readAccessor = (index, Type) => {
 const a = doc.accessors[index], v = doc.bufferViews[a.bufferView];
 assert.equal(v.byteStride, undefined);
 const start = (v.byteOffset || 0) + (a.byteOffset || 0);
 const components = {SCALAR:1,VEC2:2,VEC3:3}[a.type];
 return new Type(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + a.count * components * Type.BYTES_PER_ELEMENT));
};
const positions = readAccessor(primitive.attributes.POSITION, Float32Array);
const indices = readAccessor(primitive.indices, Uint32Array);
await MeshoptSimplifier.ready;
const [reduced, error] = MeshoptSimplifier.simplify(indices, positions, 3, 120000, 0.002);
const [remap, count] = MeshoptSimplifier.compactMesh(reduced);
const views = [], chunks = [];
let offset = 0;
const append = (bytes, target) => {
 const padded = Buffer.alloc(Math.ceil(bytes.byteLength / 4) * 4);
 Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).copy(padded);
 const view = views.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength,...(target ? {target} : {})}) - 1;
 chunks.push(padded);offset += padded.length;return view;
};
for (const image of doc.images) {
 const view = doc.bufferViews[image.bufferView];
 image.bufferView = append(bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
}
for (const index of Object.values(primitive.attributes)) {
 const a = doc.accessors[index];assert.equal(a.componentType, 5126);
 const size = {VEC2:2,VEC3:3}[a.type];
 const original = readAccessor(index, Float32Array), compact = new Float32Array(count * size);
 for (let old = 0; old < remap.length; old++) if (remap[old] !== 0xffffffff)
  compact.set(original.subarray(old * size, old * size + size), remap[old] * size);
 a.bufferView = append(compact,34962); a.byteOffset = 0; a.count = count;
}
const ia = doc.accessors[primitive.indices];
ia.bufferView = append(reduced,34963);ia.byteOffset=0;ia.count=reduced.length;ia.min=[0];ia.max=[count-1];
doc.bufferViews=views;doc.buffers=[{byteLength:offset}];
const json = Buffer.from(JSON.stringify(doc));
const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+offset,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset,0);binHeader.writeUInt32LE(0x004e4942,4);
await writeFile(output,Buffer.concat([header,padded,binHeader,...chunks]));
console.log({sourceTriangles:indices.length/3,triangles:reduced.length/3,vertices:count,error,bytes:28+padded.length+offset});
