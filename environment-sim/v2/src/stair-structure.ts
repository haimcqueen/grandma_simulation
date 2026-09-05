import * as THREE from "three";
import type { StairConnection } from "./house";

/** Shared authored walls and floors used by rendering and navigation baking. Local +X enters the recess; +Z points toward the rear of the house. */
export function buildStairStructure(connection: StairConnection) {
  const root = new THREE.Group();
  const layout = connection.stairwell;
  if (!layout) return root;
  root.position.set(layout.origin.x, layout.origin.y, layout.origin.z);
  root.rotation.y = layout.yaw;
  const { approach, run, separation, hallLength, rise } = layout;
  const half = connection.width / 2, back = approach + run + half;
  const plaster = new THREE.MeshStandardMaterial({ color: "#eeeae2", roughness: 0.9 });
  const oak = new THREE.MeshStandardMaterial({ color: "#bfa17c", roughness: 0.72 });
  const trim = new THREE.MeshStandardMaterial({ color: "#faf7f0", roughness: 0.65 });
  const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, floorY: number, navigationFloor?: string) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material.clone());
    mesh.name = id; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { architecture: true, stairShell: id.startsWith("stair-") || id.includes("window"), floorY, ...(navigationFloor ? { navigationFloor } : {}) };
    if (id === "stair-front-return-wall") mesh.userData.cutawayNormal = [-1, 0, 0];
    else if (id.includes("stair-side")) mesh.userData.cutawayNormal = [0, 0, z < 0 ? -1 : 1];
    else if (id.includes("stair-back") || id.startsWith("window-") || id === "stair-window") mesh.userData.cutawayNormal = [1, 0, 0];
    else if (id.startsWith("hall-wall")) mesh.userData.cutawayNormal = [x < 0 ? -1 : 1, 0, 0];
    else if (id === "landing-end-wall") mesh.userData.cutawayNormal = [0, 0, -1];
    root.add(mesh); return mesh;
  };
  // The side walls sit outside both flights. The open end faces the foyer.
  for (const z of [-half - 0.08, separation + half + 0.08]) {
    box(`stair-side-${z}`, (approach + back)/2, rise/2, z, back-approach, rise, .16, plaster, 0);
    box(`upper-stair-side-${z}`, (approach + back)/2, rise+1.4, z, back-approach, 2.8, .16, plaster, rise);
  }
  // Separate the returning flight from the entry, as in the enclosed stair photo.
  const partitionEnd = approach + run - half;
  box("stair-center-partition",(approach+partitionEnd)/2,rise/2,separation/2,partitionEnd-approach,rise,.16,plaster,0);
  box("stair-front-return-wall",approach-.08,rise/2,separation,.16,rise,connection.width,plaster,0);
  box("stair-ceiling",(approach+back)/2,rise+2.86,separation/2,back-approach,.12,separation+connection.width+.32,plaster,rise);
  box("stair-back-lower", back+.08, rise/2, separation/2, .16, rise, separation+connection.width+.32, plaster, 0);
  // Window aperture at the far wall, echoing the landing photo.
  const full = separation+connection.width+.32;
  box("window-sill-wall",back+.08,rise+.35,separation/2,.16,.7,full,plaster,rise);
  box("window-head-wall",back+.08,rise+2.65,separation/2,.16,.3,full,plaster,rise);
  for (const side of [-1,1]) box(`window-jamb-${side}`,back+.08,rise+1.6,separation/2+side*(full/2-.22),.16,1.8,.44,plaster,rise);
  const glass = new THREE.MeshStandardMaterial({color:"#d3e2e6",transparent:true,opacity:.35,roughness:.12,metalness:.1,side:THREE.DoubleSide});
  box("stair-window",back+.08,rise+1.6,separation/2,.025,1.8,full-.88,glass,rise);
  // Upper hall is normal navigable floor, independent of the stair movement rail.
  const hallStart = separation-half, hallEnd = separation+hallLength;
  box("upper-hall-floor",0,rise-.07,(hallStart+hallEnd+.45)/2,connection.width,.14,hallEnd+.45-hallStart,oak,rise,connection.toFloor);
  box("upper-landing-floor",approach/2,rise-.07,separation,approach,.14,connection.width,oak,rise,connection.toFloor);
  for(const side of [-1,1]) {
    // Leave the west-side stair arrival open at the landing.
    const start = side === 1 ? separation+half : hallStart;
    const length = hallEnd-start;
    box(`hall-wall-${side}`,side*(half+.08),rise+1.4,(start+hallEnd)/2,.16,2.8,length,plaster,rise);
    box(`hall-baseboard-${side}`,side*(half-.01),rise+.06,(start+hallEnd)/2,.025,.12,length,trim,rise);
  }
  box("hall-ceiling",0,rise+2.86,(hallStart+hallEnd)/2,connection.width+.32,.12,hallEnd-hallStart,plaster,rise);
  // Close the front of the landing; the bedroom threshold at the far end remains open.
  box("landing-end-wall",0,rise+1.4,hallStart-.08,connection.width+.32,2.8,.16,plaster,rise);
  for (const material of [plaster, oak, trim, glass]) material.dispose();
  root.updateMatrixWorld(true);
  return root;
}
