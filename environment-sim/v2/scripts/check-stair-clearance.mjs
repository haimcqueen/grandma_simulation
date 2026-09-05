import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
const read=async url=>JSON.parse(await readFile(`public${url}`,'utf8'));
const house=await read('/environment/house/house.json');
const worlds=[];
for(const floor of house.floors){
 const asset=await read(floor.worldUrl);const bytes=await readFile(`public/worlds/house-${floor.id}-collider.glb`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const transform=asset.colliderTransform;gltf.scene.position.fromArray(transform.position);gltf.scene.quaternion.fromArray(transform.quaternion);gltf.scene.scale.setScalar(transform.scale);gltf.scene.updateMatrixWorld(true);
 const trees=[];gltf.scene.traverse(child=>{if(child.isMesh)trees.push(new MeshBVH(child.geometry.clone().applyMatrix4(child.matrixWorld)));});
 worlds.push({id:floor.id,trees,cutouts:asset.cutouts.map(b=>new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)))});
}
const contacts=[];let samples=0;
for(const link of house.connections)for(let i=1;i<link.points.length;i++){
 const start=new THREE.Vector3(link.points[i-1].x,link.points[i-1].y,link.points[i-1].z),end=new THREE.Vector3(link.points[i].x,link.points[i].y,link.points[i].z);
 const count=Math.ceil(start.distanceTo(end)/.05);
 for(let sample=0;sample<=count;sample++){
  samples++;const position=start.clone().lerp(end,sample/count);
  const capsule=new THREE.Line3(position.clone().add(new THREE.Vector3(0,.4,0)),position.clone().add(new THREE.Vector3(0,1.42,0)));
  const bounds=new THREE.Box3().setFromPoints([capsule.start,capsule.end]).expandByScalar(.28);
  for(const world of worlds){let contact;
   const blocked=world.trees.some(tree=>tree.shapecast({intersectsBounds:b=>bounds.intersectsBox(b),intersectsTriangle:tri=>{
    const point=new THREE.Vector3();const distance=tri.closestPointToSegment(capsule,point);
    if(distance>=.28||world.cutouts.some(b=>b.containsPoint(point)))return false;
    contact=point.toArray();return true;
   }}));
   if(blocked)contacts.push({floor:world.id,segment:i,position:position.toArray(),contact});
  }
 }
}
console.log(JSON.stringify({samples,contacts:contacts.length,firstContacts:contacts.slice(0,12)},null,2));
assert.equal(contacts.length,0,'Authored stair travel intersects generated geometry outside explicit openings');
