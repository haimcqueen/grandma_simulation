import * as THREE from "three";
import type { House } from "./house";

/** Project the actual connector into the active floor's map, including both flights. */
export function buildHouseMap(house: House, floorId: string) {
  const root = new THREE.Group();
  root.name = "house-map-connections";
  const floor = house.floors.find(value => value.id === floorId)!;
  const elevation = floor.environment.floorY + 0.1;
  for (const link of house.connections) {
    if (link.fromFloor !== floorId && link.toFloor !== floorId) continue;
    const ascending = link.fromFloor === floorId;
    const points = ascending ? link.points : [...link.points].reverse();
    const group = new THREE.Group();
    group.name = link.id;
    group.userData.label = ascending ? "Stairs up" : "Stairs down";
    const material = new THREE.MeshBasicMaterial({ color: 0xc78842 });
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 0.001) continue;
      const flight = new THREE.Mesh(new THREE.BoxGeometry(link.width, 0.02, length), material);
      flight.position.set((a.x + b.x) / 2, elevation, (a.z + b.z) / 2);
      flight.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      group.add(flight);
      // Tread marks distinguish the stair footprint from ordinary walking cells.
      for (let distance = 0.2; distance < length; distance += 0.25) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(link.width * 0.9, 0.01, 0.025),
          new THREE.MeshBasicMaterial({ color: 0xf5e2c6 }));
        tread.position.set(a.x + (b.x - a.x) * distance / length, elevation + 0.02, a.z + (b.z - a.z) * distance / length);
        tread.rotation.y = flight.rotation.y;
        group.add(tread);
      }
    }
    const entry = points[0];
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.31, 32),
      new THREE.MeshBasicMaterial({ color: 0x744613, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(entry.x, elevation + 0.04, entry.z);
    group.add(marker);
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 112;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff9ef"; context.fillRect(0, 0, 512, 112);
    context.fillStyle = "#67401d"; context.font = "bold 46px sans-serif";
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(`${ascending ? "↑" : "↓"} ${group.userData.label}`, 256, 56);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.46),
      new THREE.MeshBasicMaterial({ map: texture, depthTest: false, toneMapped: false }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(entry.x, elevation + 0.08, entry.z + 0.65);
    label.renderOrder = 5;
    group.add(label); root.add(group);
  }
  return root;
}
