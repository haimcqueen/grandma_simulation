import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const bytes=await readFile(process.argv[2]);
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(gltf.scene),bins=new Map();let triangles=0;
gltf.scene.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),pos=g.attributes.position,idx=g.index;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let i=0;i<(idx?.count??pos.count);i+=3){a.fromBufferAttribute(pos,idx?idx.getX(i):i);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2);const normal=ab.subVectors(b,a).cross(ac.subVectors(c,a));const area=normal.length()/2;normal.normalize();triangles++;if(Math.abs(normal.y)>.95){const y=Math.round((a.y+b.y+c.y)/3/.02)*.02;bins.set(y,(bins.get(y)??0)+area);}}
});
console.log(JSON.stringify({bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},triangles,horizontalPlanes:[...bins].sort((a,b)=>b[1]-a[1]).slice(0,15)},null,2));
