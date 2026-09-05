import * as THREE from "three";
import { disposeMeshes } from "./scene-resources";
import type { StairConnection } from "./house";

/** Authored connector geometry. Route elevation follows a continuous ramp over visible treads; no foot-contact physics. */
export function buildStairConnection(connection: StairConnection) {
  const root = new THREE.Group();
  root.name = connection.id;
  const grain = document.createElement("canvas");
  grain.width = 128; grain.height = 256;
  const context = grain.getContext("2d")!;
  context.fillStyle = "#baa17e"; context.fillRect(0, 0, 128, 256);
  for (let line = 0; line < 64; line++) {
    context.strokeStyle = `rgba(90, 65, 38, ${0.03 + (line % 5) * 0.008})`;
    context.beginPath();
    for (let y = 0; y <= 256; y += 8) {
      const x = line * 2 + Math.sin(y / 55 + line) * 1.3;
      if (y === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(grain);
  texture.colorSpace = THREE.SRGBColorSpace;
  const wood = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72 });
  const white = new THREE.MeshStandardMaterial({ color: "#eae7df", roughness: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: "#747a77", roughness: 0.32, metalness: 0.7 });
  const rail = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) => {
    const delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    root.add(mesh);
  };
  for (let index = 1; index < connection.points.length; index++) {
    const a = new THREE.Vector3(connection.points[index - 1].x, connection.points[index - 1].y, connection.points[index - 1].z);
    const b = new THREE.Vector3(connection.points[index].x, connection.points[index].y, connection.points[index].z);
    const horizontal = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const length = horizontal.length();
    if (length < 0.001) continue;
    const direction = horizontal.normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const risers = Math.max(1, Math.ceil(Math.abs(b.y - a.y) / 0.18));
    for (let step = 0; step < risers; step++) {
      const t = (step + 0.5) / risers;
      const position = a.clone().lerp(b, t);
      const top = position.y;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(connection.width, 0.1, length / risers + (risers === 1 ? connection.width : 0.012)), wood);
      tread.position.copy(position); tread.position.y = top - 0.05;
      tread.rotation.y = Math.atan2(direction.x, direction.z);
      tread.receiveShadow = true; root.add(tread);
      if (risers > 1) {
        const riser = new THREE.Mesh(new THREE.BoxGeometry(connection.width, Math.abs(b.y-a.y)/risers, 0.035), white);
        riser.position.copy(position).addScaledVector(direction, -length / risers / 2);
        riser.position.y -= Math.abs(b.y-a.y)/risers/2;
        riser.rotation.y = tread.rotation.y; root.add(riser);
      }
    }
    for (const sign of [-1, 1]) {
      if (risers > 1) {
        const span = b.clone().sub(a);
        const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, span.length()), white);
        stringer.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(side, sign * connection.width / 2);
        stringer.position.y -= 0.19;
        stringer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), span.normalize());
        root.add(stringer);
      }
      const inset = Math.min(connection.width / 2, length * 0.49);
      const start = a.clone().lerp(b, inset / length).addScaledVector(side, sign * connection.width / 2);
      const end = b.clone().lerp(a, inset / length).addScaledVector(side, sign * connection.width / 2);
      const count = Math.max(1, Math.ceil(length / 0.65));
      for (let post = 0; post <= count; post++) {
        const foot = start.clone().lerp(end, post/count);
        rail(foot, foot.clone().add(new THREE.Vector3(0, 0.95, 0)), 0.018, steel);
      }
      rail(start.add(new THREE.Vector3(0, 0.95, 0)), end.add(new THREE.Vector3(0, 0.95, 0)), 0.04, wood);
    }
  }
  return root;
}

/** Release the connector's shared texture once, then its geometry and materials. */
export function disposeStairConnection(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse(child => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && child.material.map)
      textures.add(child.material.map);
  });
  textures.forEach(texture => texture.dispose());
  disposeMeshes(root);
}
