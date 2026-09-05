import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const house=JSON.parse(await readFile('public/environment/house/house.json','utf8'));
await mkdir('public/worlds',{recursive:true});const checksums=[];
const expected=JSON.parse(await readFile('public/environment/house/checksums.json','utf8'));
for(const floor of house.floors){
 const asset=JSON.parse(await readFile(`public${floor.worldUrl}`,'utf8'));
 for(const [field,suffix] of [['splatUrl','.rad'],['colliderUrl','-collider.glb']]){
  const name=`house-${floor.id}${suffix}`;
  const response=await fetch(asset[field]);if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const checksum={name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const reference=expected.find(item=>item.name===name);
  if(!reference || reference.sha256!==checksum.sha256 || reference.bytes!==checksum.bytes) throw new Error(`${name}: asset does not match the checked-in checksum`);
  await writeFile(`public/worlds/${name}`,bytes);
  checksums.push(checksum);
  asset[field]=`/worlds/${name}`;console.log(`Downloaded ${name}: ${bytes.length} bytes`);
 }
 floor.worldUrl=`/worlds/house-${floor.id}.json`;
 await writeFile(`public${floor.worldUrl}`,JSON.stringify(asset,null,2)+'\n');
}
await writeFile('public/worlds/house-local.json',JSON.stringify(house,null,2)+'\n');
await writeFile('public/worlds/house-checksums.json',JSON.stringify(checksums,null,2)+'\n');
console.log('Set VITE_HOUSE_MANIFEST_URL=/worlds/house-local.json in .env.local and restart Vite.');
