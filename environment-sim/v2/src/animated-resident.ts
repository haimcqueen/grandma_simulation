import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeMeshes } from "./world-loader";
export type ResidentAssets = {
  modelUrl: string;
  idleUrl: string;
  walkUrl: string;
  height: number;
  forwardRotation?: number;
};

export async function loadAnimatedResident(assets: ResidentAssets) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled([
    loader.loadAsync(assets.modelUrl),
    loader.loadAsync(assets.idleUrl),
    loader.loadAsync(assets.walkUrl),
  ]);
  if (results.some((result) => result.status === "rejected")) {
    for (const result of results)
      if (result.status === "fulfilled") disposeMeshes(result.value.scene);
    throw new Error(
      "The resident model or animation could not load. Check the downloaded asset bundle.",
    );
  }
  const [model, idle, walk] = results.map(
    (result) =>
      (
        result as PromiseFulfilledResult<
          Awaited<ReturnType<GLTFLoader["loadAsync"]>>
        >
      ).value,
  );
  if (!idle.animations.length || !walk.animations.length)
    throw new Error("Resident animation files contain no clips.");
  const root = new THREE.Group(),
    rig = model.scene;
  root.name = "resident-01";
  root.add(rig);
  rig.rotation.y = assets.forwardRotation ?? 0;
  rig.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(rig),
    size = bounds.getSize(new THREE.Vector3());
  if (size.y <= 0) throw new Error("Resident has invalid bounds.");
  rig.scale.multiplyScalar(assets.height / size.y);
  rig.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(rig);
  rig.position.y -= scaledBounds.min.y;
  rig.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    }
  });
  const mixer = new THREE.AnimationMixer(rig);
  const idleClip = idle.animations[0].clone(),
    walkClip = walk.animations[0].clone();
  // Both clips come from the same rigging batch. Horizontal travel is owned by Simulation.
  const actions = {
    idle: mixer.clipAction(idleClip),
    walk: mixer.clipAction(walkClip),
  };
  actions.idle.play();
  let current: "idle" | "walk" = "idle",
    previousTime = 0,
    previousDistance = 0;
  disposeMeshes(idle.scene);
  disposeMeshes(walk.scene);
  return {
    root,
    rig,
    mixer,
    metadata: {
      height: assets.height,
      bounds: size.toArray(),
      idleDuration: idleClip.duration,
      walkDuration: walkClip.duration,
    },
    update(
      time: number,
      distance: number,
      walking: boolean,
      paused: boolean,
      speed: number,
    ) {
      const delta = Math.max(0, Math.min(time - previousTime, 0.1));
      if (time < previousTime || distance < previousDistance) {
        mixer.setTime(0);
      }
      previousTime = time;
      previousDistance = distance;
      const next = walking ? "walk" : "idle";
      if (next !== current) {
        actions[current].fadeOut(0.22);
        actions[next].reset().fadeIn(0.22).play();
        current = next;
      }
      actions.walk.timeScale = speed / 1.1;
      if (!paused) mixer.update(delta);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(rig);
      disposeMeshes(root);
    },
  };
}
