import * as THREE from "three";
import { buildHazardProps, type PropToolkit } from "../../v1-draft/src/hazard-props";
import type { Environment } from "./contracts";
import { floorHeightAt } from "./navigation-grid";
import { disposeMeshes } from "./scene-resources";

/** Cosmetic demo props. Detection and navigation never depend on their visibility. */
export class RoomHazardView {
  readonly root = new THREE.Group();
  private environment?: Environment;
  constructor() { this.root.name = "room-hazard-props"; }
  setEnvironment(environment: Environment) {
    if (this.environment === environment) return;
    this.environment = environment;
    this.dispose();
    const toolkit: PropToolkit = {
      material: color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      box: (parent, x, y, z, width, height, depth, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), toolkit.material(color));
        mesh.position.set(x, y, z);
        mesh.castShadow = mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      },
    };
    for (const zone of environment.hazardZones ?? []) {
      // Build in local coordinates; the room owns placement, support height and scale.
      const prop = buildHazardProps(this.root, toolkit, [{ ...zone, x: 0, z: 0 }]);
      prop.name = `hazard:${zone.hazardId}`;
      prop.position.set(zone.x, floorHeightAt(environment, zone), zone.z);
      prop.scale.setScalar(zone.propScale ?? 1);
    }
  }
  dispose() { disposeMeshes(this.root); this.root.clear(); }
}
