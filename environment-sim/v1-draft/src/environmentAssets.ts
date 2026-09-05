import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Rectangle } from "./environment";

export type VisualAsset = {
  url: string;
  /** Radians around Y, applied before fitting. */
  rotationY?: number;
  /** Shells use authored coordinates; furniture fits uniformly within its footprint. */
  scale?: number;
  offset?: [number, number, number];
};
export type EnvironmentVisualConfig = {
  background?: { color?: string; panoramaUrl?: string };
  assets?: Record<string, VisualAsset>;
};
type Slot = {
  root: THREE.Group;
  fallback: THREE.Object3D;
  footprint?: Rectangle;
  loaded?: THREE.Object3D;
  request: number;
};

/** Disposes only assets owned by this layer, never shared authored materials. */
export function disposeVisual(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}

export function placeVisual(model: THREE.Object3D, asset: VisualAsset, footprint?: Rectangle) {
  model.rotation.y += asset.rotationY ?? 0;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every(Number.isFinite)) throw new Error("Asset contains no usable geometry");
  if (footprint) {
    if (size.x < 0.000001 || size.z < 0.000001) throw new Error("Asset has no horizontal footprint");
    model.scale.multiplyScalar(Math.min(footprint.width / size.x, footprint.depth / size.z));
    model.updateMatrixWorld(true);
    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.add(new THREE.Vector3(footprint.x - center.x, -bounds.min.y, footprint.z - center.z));
  } else {
    if (asset.scale !== undefined && (!Number.isFinite(asset.scale) || asset.scale <= 0)) throw new Error("Asset scale must be positive");
    model.scale.multiplyScalar(asset.scale ?? 1);
    if (asset.offset) model.position.add(new THREE.Vector3(...asset.offset));
  }
  model.traverse(node => { if (node instanceof THREE.Mesh) node.castShadow = node.receiveShadow = true; });
  model.updateMatrixWorld(true);
}

/** Visual ownership is independent of navigation, floor state, and character animation. */
export class EnvironmentAssets {
  private slots = new Map<string, Slot>();
  private backgroundRequest = 0;
  private panorama?: THREE.Texture;
  private initialBackground: THREE.Scene["background"];
  constructor(private scene: THREE.Scene,
    private loadModel: (url: string) => Promise<THREE.Object3D> = async url => (await new GLTFLoader().loadAsync(url)).scene) {
    this.initialBackground = scene.background;
  }
  register(id: string, parent: THREE.Object3D, fallback: THREE.Object3D, footprint?: Rectangle) {
    if (this.slots.has(id)) throw new Error(`Duplicate visual slot: ${id}`);
    const root = new THREE.Group();
    root.name = `visual:${id}`;
    root.add(fallback);
    parent.add(root);
    this.slots.set(id, { root, fallback, footprint, request: 0 });
    return root;
  }
  ids() { return [...this.slots.keys()]; }
  fallback(id: string) { return this.slot(id).fallback; }
  private slot(id: string) {
    const slot = this.slots.get(id);
    if (!slot) throw new Error(`Unknown visual slot: ${id}`);
    return slot;
  }
  async replace(id: string, asset: VisualAsset) {
    const slot = this.slot(id);
    const request = ++slot.request;
    const loaded = await this.loadModel(asset.url);
    if (request !== slot.request) { disposeVisual(loaded); return false; }
    try { placeVisual(loaded, asset, slot.footprint); }
    catch (error) { disposeVisual(loaded); throw error; }
    if (slot.loaded) { slot.root.remove(slot.loaded); disposeVisual(slot.loaded); }
    slot.loaded = loaded;
    slot.fallback.visible = false;
    slot.root.add(loaded);
    return true;
  }
  restore(id: string) {
    const slot = this.slot(id);
    slot.request++;
    if (slot.loaded) { slot.root.remove(slot.loaded); disposeVisual(slot.loaded); slot.loaded = undefined; }
    slot.fallback.visible = true;
  }
  async setBackground(background?: EnvironmentVisualConfig["background"]) {
    const request = ++this.backgroundRequest;
    const texture = background?.panoramaUrl ? await new THREE.TextureLoader().loadAsync(background.panoramaUrl) : undefined;
    if (request !== this.backgroundRequest) { texture?.dispose(); return; }
    this.panorama?.dispose();
    this.panorama = texture;
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.scene.background = texture ?? (background?.color ? new THREE.Color(background.color) : this.initialBackground);
  }
  async apply(config: EnvironmentVisualConfig) {
    const tasks = Object.entries(config.assets ?? {}).map(async ([id, asset]) => {
      try { await this.replace(id, asset); return { id, ok: true as const }; }
      catch (error) { return { id, ok: false as const, error: String(error) }; }
    });
    if (config.background) tasks.push((async () => {
      try { await this.setBackground(config.background); return { id: "background", ok: true as const }; }
      catch (error) { return { id: "background", ok: false as const, error: String(error) }; }
    })());
    return Promise.all(tasks);
  }
  dispose() {
    for (const id of this.ids()) this.restore(id);
    this.backgroundRequest++;
    this.panorama?.dispose();
    this.panorama = undefined;
    this.scene.background = this.initialBackground;
  }
}
