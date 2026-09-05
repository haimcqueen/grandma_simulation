import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { floors, type HouseObject } from "./environment";

type Finish = "oak" | "plaster" | "stone" | "linen" | "concrete" | "grass";

/** Locally generated surface maps: no network requests or generation account required. */
export function createHouseAppearance(anisotropy: number, floorRegions = floors, ground = true) {
  const maps = new Map<Finish, THREE.CanvasTexture>();
  let seed = 831;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  function surface(kind: Finish) {
    if (maps.has(kind)) return maps.get(kind)!;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const data = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      let v = 226 + random() * 18;
      if (kind === "oak") {
        const board = Math.floor(x / 64);
        const grain = Math.sin(x * 1.5 + Math.sin(y * Math.PI / 256) * 2 + Math.sin(y * Math.PI / 64));
        v = 209 + Math.sin(board * 13) * 14 + grain * 9 + random() * 12;
        if (x % 64 < 1 || (y + board * 128) % 512 < 2) v = 142;
      } else if (kind === "grass") {
        v = 155 + random() * 100;
      } else if (kind === "linen") {
        v = 218 + (x % 4 < 2 ? 13 : -9) + (y % 4 < 2 ? 7 : -7) + random() * 12;
      } else if (kind === "stone" || kind === "concrete") {
        v = 225 + random() * 14 + Math.sin(x * 0.12 + Math.sin(y * 0.07) * 3) * 4;
        if (kind === "concrete" && (x < 3 || y < 3)) v = 168;
      }
      const i = (y * 512 + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    maps.set(kind, texture);
    return texture;
  }
  function finish(kind: Finish, color: number, repeatX = 1, repeatY = 1) {
    const map = surface(kind).clone();
    map.repeat.set(repeatX, repeatY);
    const bump = map.clone();
    bump.colorSpace = THREE.NoColorSpace;
    return new THREE.MeshStandardMaterial({
      color, map, bumpMap: bump, bumpScale: kind === "plaster" ? 0.0006 : kind === "linen" ? 0.002 : 0.004,
      roughness: kind === "stone" ? 0.38 : kind === "oak" ? 0.66 : 0.92,
    });
  }
  const oak = finish("oak", 0xb99a72);
  const walnut = finish("oak", 0x79583f);
  const plaster = finish("plaster", 0xeee9df, 2, 2);
  const stone = finish("stone", 0xf0eee5);
  const linen = finish("linen", 0xb1b8a3, 3, 3);
  const cream = finish("linen", 0xe9dfcd, 3, 3);
  const metal = new THREE.MeshStandardMaterial({ color: 0x353b38, roughness: 0.3, metalness: 0.75 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf1eee5, roughness: 0.6 });
  const upper = new THREE.Group();
  upper.name = "full-height-architecture";
  const cutawayCaps = new THREE.Group();
  const fixed = new THREE.Group();
  fixed.name = "architectural-details";

  function block(parent: THREE.Object3D, x: number, y: number, z: number,
    w: number, h: number, d: number, material: THREE.Material, rounded = false) {
    const mesh = new THREE.Mesh(rounded
      ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, w / 5, h / 5, d / 5))
      : new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function floorMaterial(id: string, width: number, depth: number) {
    if (id === "garden") return finish("grass", 0x78965b, width / 2, depth / 2);
    if (["patio", "garage", "bathroom"].includes(id) || id.includes("bath")) {
      // Box top UVs follow X/Z. One tile per 0.8 metres.
      return finish("concrete", id === "bathroom" ? 0xc6cdc7 : 0xc1b9a9, width / 0.8, depth / 0.8);
    }
    // Eight 0.19 m planks per texture width; 2.4 m board length.
    return finish("oak", 0xd1b58d, width / 1.52, depth / 2.4);
  }

  function decorate(object: HouseObject, mesh: THREE.Mesh, parent: THREE.Object3D) {
    const { x, z, width: w, depth: d, height: h, id } = object;
    if (object.kind === "wall") {
      mesh.material = plaster;
      // The baseboard stays within the authored collision footprint.
      block(fixed, x, 0.065, z, w, 0.13, d, trim);
      block(cutawayCaps, x, h + 0.015, z, w, 0.03, d, trim);
      if (id === "main-east") {
        // Existing solid wall footprint; glazing above the sill adds no opening to navigation.
        block(upper, x, 0.925, z, w, 0.15, d, plaster);
        block(upper, x, 2.7, z, w, 0.3, d, plaster);
        for (const center of [7.35, 10, 12.65, 14.65]) {
          block(upper, x, 1.775, center, w, 1.55, center === 10 ? 1.1 : 0.55, plaster);
        }
        const glass = new THREE.MeshStandardMaterial({
          color: 0xb3ced0, transparent: true, opacity: 0.22, roughness: 0.16,
          metalness: 0.15, depthWrite: false,
        });
        for (const [center, length] of [[8.54, 1.83], [11.46, 1.82], [13.66, 1.47]]) {
          const pane = block(upper, x, 1.76, center, 0.025, 1.5, length, glass);
          pane.castShadow = false;
          for (const y of [1.01, 2.51]) block(upper, x, y, center, w, 0.045, length, metal);
          for (const zz of [center - length / 2, center, center + length / 2]) {
            block(upper, x, 1.76, zz, w, 1.5, 0.045, metal);
          }
        }
      } else if (["upper-north", "bay-front"].includes(id)) {
        const opening = w * 0.7;
        const pier = (w - opening) / 2;
        block(upper, x, 0.925, z, w, 0.15, d, plaster);
        block(upper, x, 2.7, z, w, 0.3, d, plaster);
        for (const side of [-1, 1]) block(upper, x + side * (w - pier) / 2, 1.775, z, pier, 1.55, d, plaster);
        const glass = new THREE.MeshStandardMaterial({ color: 0xb3ced0, transparent: true, opacity: 0.22,
          roughness: 0.16, depthWrite: false });
        const pane = block(upper, x, 1.775, z, opening, 1.55, 0.025, glass);
        pane.castShadow = false;
        for (const y of [1.02, 2.53]) block(upper, x, y, z, opening, 0.045, d, metal);
        for (const side of [-1, 0, 1]) block(upper, x + side * opening / 2, 1.775, z, 0.045, 1.55, d, metal);
      } else block(upper, x, (h + 2.85) / 2, z, w, 2.85 - h, d, plaster);
      return;
    }
    if (id.includes("counter") || id === "island") {
      mesh.material = oak;
      block(parent, x, h + 0.025, z, w, 0.05, d, stone, true);
      const alongZ = d > w;
      const length = alongZ ? d : w;
      const count = Math.max(1, Math.round(length / 0.55));
      for (let i = 0; i < count; i++) {
        const offset = -length / 2 + (i + 0.5) * length / count;
        block(parent, x + (alongZ ? -w / 2 + 0.006 : offset), h / 2, z + (alongZ ? offset : -d / 2 + 0.006),
          alongZ ? 0.014 : length / count - 0.025, h - 0.18, alongZ ? length / count - 0.025 : 0.014, walnut);
        block(parent, x + (alongZ ? -w / 2 + 0.013 : offset), h - 0.16, z + (alongZ ? offset : -d / 2 + 0.013),
          alongZ ? 0.026 : 0.2, 0.018, alongZ ? 0.2 : 0.026, metal);
      }
    } else if (id === "sofa") {
      mesh.material = walnut;
      mesh.scale.y = 0.3;
      mesh.position.y = 0.2;
      for (let i = 0; i < 3; i++) block(parent, x + 0.07, 0.46, z - d / 2 + (i + 0.5) * d / 3,
        w - 0.18, 0.25, d / 3 - 0.035, linen, true);
      block(parent, x - w / 2 + 0.1, 0.67, z, 0.2, 0.64, d, linen, true);
      for (const zz of [z - d / 2 + 0.1, z + d / 2 - 0.1]) {
        block(parent, x, 0.57, zz, w, 0.45, 0.2, linen, true);
      }
      for (const zz of [z - 0.8, z + 0.8]) {
        const pillow = block(parent, x - 0.08, 0.72, zz, 0.18, 0.35, 0.4, cream, true);
        pillow.rotation.z = -0.18;
      }
    } else if (id.includes("table")) {
      mesh.material = walnut;
      mesh.scale.y = 0.07 / h;
      mesh.position.y = h - 0.035;
      for (const xx of [-1, 1]) for (const zz of [-1, 1]) {
        block(parent, x + xx * (w / 2 - 0.09), (h - 0.07) / 2, z + zz * (d / 2 - 0.09),
          0.065, h - 0.07, 0.065, walnut);
      }
    } else if (id.startsWith("bed-")) {
      mesh.material = walnut;
      block(parent, x, h + 0.06, z, w - 0.05, 0.2, d - 0.05, cream, true);
      block(parent, x, 0.72, z - d / 2 + 0.08, w, 0.85, 0.14, linen, true);
      block(parent, x, h + 0.18, z + 0.3, w - 0.04, 0.06, d * 0.62, linen, true);
      for (const xx of [-0.23, 0.23]) block(parent, x + xx * w, h + 0.22, z - d * 0.28,
        w * 0.41, 0.13, 0.4, cream, true);
    }
  }

  // Lintels bridge the existing passages above head height; floors remain at y=0.
  if (ground) {
  block(upper, 7.3, 2.6, 7, 2.2, 0.5, 0.16, plaster);
  block(upper, 6.55, 2.6, 15, 1.5, 0.5, 0.16, plaster);
  }
  for (const floor of floorRegions.filter(f => !["garden", "patio", "stairs"].includes(f.id))) {
    if (ground && floor.id === "great-room") {
      // Ceiling opening over the connecting staircase.
      block(upper, 7.7, 2.9, 10.3, 6.6, 0.1, 6.6, plaster);
      block(upper, 8.46, 2.9, 14.3, 5.08, 0.1, 1.4, plaster);
    } else block(upper, floor.x, 2.9, floor.z, floor.width, 0.1, floor.depth, plaster);
  }
  if (ground) {
  for (const zz of [10.7, 12.5, 14.1]) {
    block(upper, 7.7, 2.84, zz, 4.8, 0.025, 0.025,
      new THREE.MeshStandardMaterial({ color: 0xffecd0, emissive: 0xffe0ad, emissiveIntensity: 1.3 }));
  }
  // Kitchen backsplash and upper cabinets share the counter footprint.
  block(upper, 10.98, 1.3, 12.4, 0.025, 0.65, 4.3, stone);
  block(upper, 10.78, 2.18, 12.4, 0.4, 0.65, 4.3, oak);
  for (let z = 10.3; z < 14.5; z += 0.6) block(upper, 10.57, 2.18, z, 0.015, 0.61, 0.018, walnut);
  const rug = block(fixed, 6.25, 0.018, 9.05, 2.1, 0.025, 3.4, finish("linen", 0xc6bba4, 8, 12));
  rug.castShadow = false;
  }

  return { fixed, upper, cutawayCaps, floorMaterial, decorate,
    setInterior: (interior: boolean) => { upper.visible = interior; cutawayCaps.visible = !interior; },
  };
}
