import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Environment, EnvironmentObject } from "./contracts";

export function buildFixture(environment: Environment) {
  const root = new THREE.Group();
  root.name = environment.id;
  const wallGroup = new THREE.Group();
  root.add(wallGroup);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
      );
    return materials.get(color)!;
  };
  const box = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    rounded = false,
  ) => {
    const mesh = new THREE.Mesh(
      rounded
        ? new RoundedBoxGeometry(w, h, d, 3, 0.07)
        : new THREE.BoxGeometry(w, h, d),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const floor = environment.floor;
  box(
    root,
    floor.x,
    -0.13,
    floor.z,
    floor.width + 0.3,
    0.25,
    floor.depth + 0.3,
    "#c6b69e",
  );
  // Individual planks add depth and warm variation without a downloaded texture dependency.
  const tones = ["#d8c5a9", "#ddcdb4", "#d5c1a4", "#e0cfb5", "#d9c6ab"];
  for (let row = 0; row < 30; row++)
    for (let col = 0; col < 4; col++) {
      box(
        root,
        (col + 0.5) * 2,
        0.002,
        (row + 0.5) * 0.3,
        1.991,
        0.015,
        0.292,
        tones[(row * 3 + col * 7) % tones.length],
      );
    }
  box(root, 2.2, 0.025, 2.35, 3.7, 0.025, 3.45, "#e6ded0");
  for (const object of environment.objects) {
    const { x, z, width: w, depth: d, height: h, kind } = object;
    const parent = kind === "wall" ? wallGroup : root;
    if (kind === "sofa") {
      box(parent, x, 0.29, z, w, 0.48, d, "#e8e0d4", true);
      box(parent, x - w * 0.35, 0.57, z, 0.3, 0.43, d, "#eee7db", true);
      for (const side of [-1, 1])
        box(
          parent,
          x,
          0.53,
          z + side * (d / 2 - 0.14),
          w,
          0.3,
          0.27,
          "#eee7db",
          true,
        );
      for (const offset of [-0.78, 0, 0.78])
        box(
          parent,
          x + 0.05,
          0.52,
          z + offset,
          0.8,
          0.17,
          0.73,
          "#f3ecdf",
          true,
        );
    } else if (kind === "table") {
      box(
        parent,
        x,
        h - 0.035,
        z,
        w,
        0.09,
        d,
        object.id === "coffee-table" ? "#f5efe4" : "#95724f",
        true,
      );
      for (const side of [-1, 1])
        box(
          parent,
          x + side * w * 0.3,
          h / 2,
          z,
          0.12,
          h - 0.05,
          d * 0.6,
          "#877057",
        );
      if (object.id === "dining-table")
        for (const side of [-1, 1])
          for (const offset of [-0.5, 0.5]) {
            // Chairs fit inside the shared table footprint, keeping its collision bounds conservative.
            box(
              parent,
              x + offset,
              0.43,
              z + side * 0.25,
              0.43,
              0.1,
              0.38,
              "#b59c7e",
              true,
            );
          }
    } else if (kind === "island" || kind === "cabinet") {
      box(parent, x, h / 2, z, w, h, d, "#78543a");
      if (h < 1.1)
        box(parent, x, h + 0.025, z, w + 0.06, 0.055, d + 0.06, "#f4f0e8");
      if (kind === "island")
        for (const side of [-1, 1])
          box(
            parent,
            x,
            h / 2,
            z + side * (d / 2 - 0.02),
            w + 0.06,
            h,
            0.065,
            "#f4f0e8",
          );
      const panels = Math.max(1, Math.round(w / 0.55));
      for (let index = 1; index < panels; index++)
        box(
          parent,
          x - w / 2 + (index * w) / panels,
          h / 2,
          z - d / 2 - 0.004,
          0.009,
          h - 0.05,
          0.012,
          "#513d2c",
        );
    } else box(parent, x, h / 2, z, w, h, d, "#f2eee5");
  }
  // Fireplace and window frames stay at the fixture boundary.
  box(root, 0.095, 1.15, 2.5, 0.03, 0.52, 1.65, "#272d29");
  box(root, 0.11, 0.55, 2.5, 0.03, 0.12, 1.7, "#cbb99c");
  for (const x of [0.15, 2, 4, 6, 7.85])
    box(root, x, 1.5, 0, 0.045, 3, 0.05, "#333b36");
  box(root, 4, 3, 0, 8, 0.06, 0.07, "#333b36");
  box(root, 4, -0.08, -1.9, 8, 0.14, 3.8, "#d6d7c7");
  for (const x of [0.6, 7.4]) {
    box(root, x, 0.23, -1.5, 0.7, 0.48, 0.7, "#aaa18a", true);
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 10),
      material("#66825b"),
    );
    foliage.position.set(x, 0.95, -1.5);
    root.add(foliage);
  }
  return {
    root,
    wallGroup,
    createObstruction(object: EnvironmentObject) {
      const group = new THREE.Group();
      group.name = object.id;
      box(
        group,
        object.x,
        0.5,
        object.z,
        object.width,
        0.64,
        object.depth,
        "#ba7952",
        true,
      );
      box(
        group,
        object.x,
        0.83,
        object.z,
        object.width + 0.02,
        0.045,
        object.depth + 0.02,
        "#dfbb87",
      );
      for (const side of [-1, 1])
        for (const end of [-1, 1]) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12),
            material("#343d37"),
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(
            object.x + side * (object.width / 2 - 0.12),
            0.095,
            object.z + end * 0.23,
          );
          group.add(wheel);
        }
      return group;
    },
  };
}
