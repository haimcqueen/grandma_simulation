/**
 * Small illustrative geometry for the objects each hazard popup names —
 * a rug for "loose rug", a knob for "round doorknob", and so on — built
 * directly from HAZARD_ZONES so a prop always sits exactly where its hazard
 * actually triggers. Purely cosmetic: none of this feeds isWalkable() or
 * navigation, and nothing here is required for the hazard system to work.
 *
 * A few hazards (stairs_no_rail, missing_baby_gate, poor_stair_contrast) are
 * deliberately left with no added prop — the absence of a rail/gate/contrast
 * strip on the plain staircase already there *is* the hazard.
 */
import * as THREE from "three";
import { HAZARD_ZONES, type HazardZone } from "./hazards";

export interface PropToolkit {
  material: (color: number) => THREE.MeshStandardMaterial;
  box: (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => THREE.Mesh;
}

type Builder = (scene: THREE.Object3D, zone: HazardZone, tk: PropToolkit) => void;

const builders: Record<string, Builder> = {
  loose_rug: (scene, zone, tk) => {
    const rug = tk.box(scene, zone.x, 0.012, zone.z, 1.6, 0.02, 1.0, 0xb1794f);
    rug.rotation.y = 0.12;
    const curl = tk.box(scene, zone.x + 0.7, 0.05, zone.z + 0.35, 0.35, 0.03, 0.35, 0xb1794f);
    curl.rotation.set(0.35, 0.12, 0.2);
  },
  low_sharp_furniture: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.41, zone.z, 0.06, 0.02, 0.06, 0x2e2620);
  },
  loose_cords: (scene, zone, tk) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(zone.x - 0.5, 0.012, zone.z - 0.3),
      new THREE.Vector3(zone.x, 0.012, zone.z + 0.1),
      new THREE.Vector3(zone.x + 0.5, 0.012, zone.z + 0.5),
      new THREE.Vector3(zone.x + 0.8, 0.012, zone.z + 0.2),
    ]);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.012, 6, false),
      tk.material(0x2b2b28),
    );
    mesh.castShadow = true;
    scene.add(mesh);
  },
  unstable_recliner: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.28, zone.z, 0.62, 0.16, 0.6, 0x8a6a4a);
    const back = tk.box(scene, zone.x - 0.28, 0.55, zone.z, 0.12, 0.55, 0.58, 0x8a6a4a);
    back.rotation.z = 0.18;
    for (const [dx, dz, h] of [
      [-0.25, -0.25, 0.3],
      [-0.25, 0.25, 0.3],
      [0.25, -0.25, 0.22],
      [0.25, 0.25, 0.3],
    ] as const)
      tk.box(scene, zone.x + dx, h / 2, zone.z + dz, 0.04, h, 0.04, 0x50412e);
  },
  climbable_tipover_furniture: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.28, zone.z, 1.1, 0.5, 0.4, 0x5b4632);
    tk.box(scene, zone.x, 0.85, zone.z - 0.05, 0.95, 0.55, 0.06, 0x232323);
  },
  glare_reflective_floor: (scene, zone) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0xfaf6ec, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, 0.011, zone.z);
    scene.add(mesh);
  },
  high_shelf_reach: (scene, zone, tk) => {
    tk.box(scene, zone.x, 1.0, zone.z, 0.3, 2.0, 0.9, 0x6e5233);
    for (const y of [0.5, 1.0, 1.5]) tk.box(scene, zone.x, y, zone.z, 0.32, 0.03, 0.92, 0x54402a);
    [0xa3573f, 0x3f6a57, 0x3f5a7a].forEach((c, i) =>
      tk.box(scene, zone.x, 1.62, zone.z - 0.3 + i * 0.2, 0.05, 0.22, 0.16, c));
  },
  blind_cords: (scene, zone, tk) => {
    tk.box(scene, zone.x, 1.7, zone.z, 1.2, 0.04, 0.05, 0xe4e0d2);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 16), tk.material(0xcfcabb));
    loop.position.set(zone.x + 0.55, 1.1, zone.z);
    scene.add(loop);
  },
  missing_grab_bars: (scene, zone) => {
    const points = [
      new THREE.Vector3(zone.x - 0.5, 0.9, zone.z + 0.42),
      new THREE.Vector3(zone.x + 0.5, 0.9, zone.z + 0.42),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({
      color: 0xb2725a, dashSize: 0.08, gapSize: 0.06,
    }));
    line.computeLineDistances();
    scene.add(line);
  },
  slippery_floor: (scene, zone) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 24),
      new THREE.MeshStandardMaterial({
        color: 0xdce8ea, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.5,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(zone.x, 0.012, zone.z);
    scene.add(mesh);
  },
  unlocked_toilet_lid: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.18, zone.z - 0.25, 0.42, 0.36, 0.4, 0xf3f2ec);
    tk.box(scene, zone.x, 0.5, zone.z - 0.42, 0.4, 0.28, 0.16, 0xf3f2ec);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.32, 16), tk.material(0xf3f2ec));
    bowl.position.set(zone.x, 0.16, zone.z + 0.1);
    scene.add(bowl);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), tk.material(0xffffff));
    seat.rotation.x = Math.PI / 2;
    seat.position.set(zone.x, 0.34, zone.z + 0.1);
    scene.add(seat);
  },
  dim_hallway_stairs: (scene, zone, tk) => {
    tk.box(scene, zone.x, 1.6, zone.z, 0.1, 0.14, 0.06, 0x3a3a36);
  },
  water_heater_too_hot: (scene, zone, tk) => {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 16), tk.material(0xcfd3d1));
    tank.position.set(zone.x, 0.65, zone.z);
    tank.castShadow = true;
    scene.add(tank);
    tk.box(scene, zone.x, 1.32, zone.z, 0.08, 0.12, 0.08, 0x8a8f8c);
  },
  frayed_cords: (scene, zone, tk) => {
    const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.03, 64, 8, 2, 3), tk.material(0x2b2b28));
    coil.rotation.x = Math.PI / 2;
    coil.scale.set(1, 1, 0.4);
    coil.position.set(zone.x, 0.03, zone.z);
    scene.add(coil);
    tk.box(scene, zone.x + 0.3, 0.02, zone.z + 0.1, 0.08, 0.02, 0.03, 0xc9784e);
  },
  heavy_door: (scene, zone, tk) => {
    tk.box(scene, zone.x, 1.0, zone.z, 1.4, 2.0, 0.08, 0x555a53);
  },
  unstable_step_stool: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.32, zone.z, 0.4, 0.05, 0.32, 0x9c8262);
    ([[-0.15, -0.12, 0.3], [-0.15, 0.12, 0.3], [0.15, -0.12, 0.22], [0.15, 0.12, 0.3]] as const)
      .forEach(([dx, dz, h]) => tk.box(scene, zone.x + dx, h / 2, zone.z + dz, 0.04, h, 0.04, 0x7a6448));
  },
  round_doorknob: (scene, zone, tk) => {
    // The door panel fills the bedroom-entry-left/right gap in environment.ts.
    tk.box(scene, zone.x + 0.03, 1.0, zone.z, 0.06, 2.0, 0.94, 0xd8cdb6);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), tk.material(0xb8a678));
    knob.position.set(zone.x + 0.09, 0.95, zone.z + 0.38);
    scene.add(knob);
    const knobOther = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), tk.material(0xb8a678));
    knobOther.position.set(zone.x - 0.03, 0.95, zone.z + 0.38);
    scene.add(knobOther);
  },
  obstructed_doorway: (scene, zone, tk) => {
    tk.box(scene, zone.x - 0.15, 0.15, zone.z, 0.3, 0.3, 0.3, 0xc9a15b);
    tk.box(scene, zone.x + 0.15, 0.22, zone.z + 0.1, 0.28, 0.44, 0.28, 0xb1794f);
  },
  accessible_exterior_door: (scene, zone, tk) => {
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 2.05),
      new THREE.MeshPhysicalMaterial({
        color: 0xdfeef0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1,
      }),
    );
    glass.position.set(zone.x, 1.05, zone.z);
    scene.add(glass);
    tk.box(scene, zone.x, 1.9, zone.z, 1.8, 0.05, 0.03, 0x8a8f86);
    tk.box(scene, zone.x, 0.06, zone.z, 1.8, 0.03, 0.03, 0x8a8f86);
  },
  uneven_threshold: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.03, zone.z, 1.4, 0.06, 0.12, 0xb9ab86);
  },
  stove_knobs_reachable: (scene, zone, tk) => {
    for (let i = -1; i <= 1; i++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), tk.material(0x2e2e2c));
      knob.rotation.z = Math.PI / 2;
      knob.position.set(10.3, 0.75, 12.4 + i * 0.14);
      scene.add(knob);
    }
  },
  pot_handles_outward: (scene, zone, tk) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 16), tk.material(0x51524e));
    pot.position.set(10.65, 1.02, 12.4);
    pot.castShadow = true;
    scene.add(pot);
    for (const dz of [-0.16, 0.16]) tk.box(scene, 10.43, 1.02, 12.4 + dz, 0.18, 0.02, 0.03, 0x2e2e2c);
  },
  hot_items_counter_edge: (scene, zone, tk) => {
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12), tk.material(0x7c8b86));
    kettle.position.set(zone.x - 0.1, 1.12, zone.z - 0.5);
    kettle.castShadow = true;
    scene.add(kettle);
  },
  low_unlocked_cabinet_hazmat: (scene, zone, tk) => {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 8), tk.material(0x6a8f6a));
    bottle.position.set(zone.x, 0.42, zone.z);
    scene.add(bottle);
  },
  small_objects_reachable: (scene, zone, tk) => {
    [0xc9784e, 0x5b8972, 0x4c6e8f].forEach((c, i) => {
      const angle = (i / 3) * Math.PI * 2;
      tk.box(scene, zone.x + Math.cos(angle) * 0.4, 0.04, zone.z + Math.sin(angle) * 0.4, 0.08, 0.08, 0.08, c);
    });
  },
  heavy_cookware_storage: (scene, zone, tk) => {
    for (let i = 0; i < 2; i++) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15 - i * 0.02, 0.15 - i * 0.02, 0.1, 14), tk.material(0x565a56));
      pot.position.set(zone.x, 0.05 + i * 0.11, zone.z);
      scene.add(pot);
    }
  },
  uncovered_outlets: (scene, zone, tk) => {
    tk.box(scene, zone.x + 0.3, 0.4, zone.z, 0.02, 0.12, 0.08, 0xe7e3d8);
  },
  unsecured_drawers: (scene, zone, tk) => {
    tk.box(scene, zone.x, 0.7, zone.z, 0.4, 0.03, 0.02, 0x6e5a3f);
  },
};

/**
 * Adds one prop group for every hazard zone that has a builder registered,
 * and returns it so callers can toggle visibility (e.g. a "show hazard
 * objects" checkbox) without touching the rest of the scene graph.
 */
export function buildHazardProps(
  scene: THREE.Object3D,
  tk: PropToolkit,
  zones: HazardZone[] = HAZARD_ZONES,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "hazard-props";
  scene.add(group);
  for (const zone of zones) builders[zone.hazardId]?.(group, zone, tk);
  return group;
}
