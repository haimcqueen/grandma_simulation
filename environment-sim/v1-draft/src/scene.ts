import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  destinations,
  floors,
  objects,
  scenarioObjects,
  type HouseObject,
} from "./environment";
import type { Simulation } from "./simulation";

export function createHouseScene(
  container: HTMLElement,
  onDestination: (id: (typeof destinations)[number]["id"]) => void,
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedece6);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive ground-floor house. Drag to orbit, scroll to zoom, or use destination buttons.",
  );
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 12;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.47;
  const target = new THREE.Vector3(5.5, 0, 11);
  let topView = false;
  function setView(top: boolean) {
    topView = top;
    controls.target.copy(target);
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const scale = Math.max(1, 0.95 / aspect);
    const offset = top
      ? new THREE.Vector3(0, 40, 0.01)
      : new THREE.Vector3(21.5, 29, 26);
    camera.position.copy(target).add(offset.multiplyScalar(scale));
    controls.update();
  }
  setView(false);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x87958a, 2.5));
  const sun = new THREE.DirectionalLight(0xfff4dc, 3.2);
  sun.position.set(-8, 25, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -22,
    right: 22,
    top: 22,
    bottom: -22,
    near: 0.5,
    far: 65,
  });
  sun.shadow.normalBias = 0.04;
  sun.target.position.copy(target);
  scene.add(sun, sun.target);
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
      );
    return materials.get(color)!;
  };
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(scene, 5.5, -0.55, 11, 15, 0.25, 26, 0xe4e3d9);
  box(scene, 5.5, -0.35, 11, 12, 0.35, 23, 0xbac2af);
  for (const floor of floors) {
    box(
      scene,
      floor.x,
      -0.08,
      floor.z,
      floor.width,
      0.16,
      floor.depth,
      floor.color,
    );
    if (["great-room", "foyer", "bedroom", "adu"].includes(floor.id)) {
      for (
        let x = floor.x - floor.width / 2 + 0.24;
        x < floor.x + floor.width / 2;
        x += 0.28
      )
        box(scene, x, 0.005, floor.z, 0.009, 0.005, floor.depth, 0xc8b495);
    }
  }
  function addObject(parent: THREE.Object3D, object: HouseObject) {
    const mesh = box(
      parent,
      object.x,
      object.height / 2,
      object.z,
      object.width,
      object.height,
      object.depth,
      object.color,
    );
    mesh.name = object.id;
    if (object.kind === "wall")
      box(
        parent,
        object.x,
        object.height + 0.02,
        object.z,
        object.width + 0.02,
        0.04,
        object.depth + 0.02,
        0xffffff,
      );
    if (object.id.includes("counter") || object.id === "island")
      box(
        parent,
        object.x,
        object.height + 0.025,
        object.z,
        object.width + 0.05,
        0.06,
        object.depth + 0.05,
        0xf4f0e8,
      );
    if (object.id.startsWith("bed-")) {
      box(
        parent,
        object.x,
        0.53,
        object.z + 0.3,
        object.width + 0.01,
        0.12,
        object.depth * 0.65,
        0xb5bdb0,
      );
      box(
        parent,
        object.x,
        0.58,
        object.z - object.depth * 0.3,
        object.width * 0.8,
        0.16,
        0.4,
        0xfffcf1,
      );
    }
  }
  for (const object of objects) addObject(scene, object);
  // Back and arms stay within the sofa's shared collision footprint.
  box(scene, 4.63, 0.8, 9, 0.18, 0.45, 2.7, 0x627f77);
  for (const z of [7.75, 10.25])
    box(scene, 4.95, 0.73, z, 0.85, 0.2, 0.2, 0x627f77);
  box(scene, 6.25, 0.025, 9.05, 2.1, 0.025, 3.4, 0xc6ba9e);
  for (let step = 0; step < 9; step++)
    box(
      scene,
      2.1 + step * 0.4,
      0.12 + step * 0.07,
      14,
      0.4,
      0.2 + step * 0.14,
      1.6,
      0xd6caba,
    );
  // Small surface details are contained by their parent object's collision shape.
  box(scene, 10.65, 0.965, 12.4, 0.52, 0.015, 0.65, 0x4c5654);
  for (const z of [12.22, 12.58])
    for (const x of [10.52, 10.78]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.012, 6, 20),
        material(0xbac2ba),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.98, z);
      scene.add(ring);
    }
  box(scene, 8.15, 1.01, 12.15, 0.55, 0.06, 0.45, 0x6e8773);
  for (const [x, z] of [
    [4.75, 4.5],
    [10.5, 4.5],
    [0.7, 21.7],
  ]) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.18, 0.45, 12),
      material(0xa58265),
    );
    pot.position.set(x, 0.22, z);
    scene.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      material(0x6e8864),
    );
    leaves.scale.set(0.8, 1.3, 0.8);
    leaves.position.set(x, 0.7, z);
    leaves.castShadow = true;
    scene.add(leaves);
  }
  function label(text: string, x: number, z: number, scale = 3.0) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#48564f";
    context.font = "600 34px Arial";
    context.textAlign = "center";
    context.fillText(text, 256, 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true,
        opacity: 0.85,
      }),
    );
    sprite.position.set(x, 1.1, z);
    sprite.scale.set(scale, (scale * 80) / 512, 1);
    sprite.renderOrder = 5;
    scene.add(sprite);
    return sprite;
  }
  const labels = [
    label("LIVING ROOM", 6.4, 7.65),
    label("KITCHEN", 8.2, 14.3),
    label("COVERED PATIO", 7.7, 4.3),
    label("ATTACHED ADU", 2.2, 5.5),
    label("GARAGE", 2.9, 18),
    label("BEDROOM", 9.2, 21.5),
    label("ENTRY", 6.55, 20.8, 1.2),
  ];
  const markerMeshes: THREE.Mesh[] = [];
  for (const destination of destinations) {
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 8, 40),
      material(0x2e7666),
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.set(destination.x, 0.045, destination.z);
    marker.userData.destination = destination.id;
    scene.add(marker);
    markerMeshes.push(marker);
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.1, 16),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.copy(marker.position);
    hit.userData.destination = destination.id;
    scene.add(hit);
    markerMeshes.push(hit);
  }
  const resident = new THREE.Group();
  scene.add(resident);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.43, 5, 12),
    material(0x347d70),
  );
  body.position.y = 0.93;
  body.castShadow = true;
  resident.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    material(0xc79d7a),
  );
  head.position.y = 1.48;
  head.castShadow = true;
  resident.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    material(0xe1dfd8),
  );
  hair.position.y = 1.49;
  resident.add(hair);
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.105, 0.65, 0);
    box(leg, 0, -0.25, 0, 0.13, 0.5, 0.14, 0x48575b);
    box(leg, 0, -0.51, 0.05, 0.15, 0.09, 0.25, 0x384344);
    resident.add(leg);
    limbs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 1.15, 0);
    box(arm, 0, -0.22, 0, 0.11, 0.42, 0.12, 0x347d70);
    box(arm, 0, -0.46, 0, 0.1, 0.09, 0.1, 0xc79d7a);
    resident.add(arm);
    limbs.push(arm);
  }
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.39, 40),
    new THREE.MeshBasicMaterial({
      color: 0x347d70,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  resident.add(halo);
  const obstructionGroup = new THREE.Group();
  scene.add(obstructionGroup);
  const debugGroup = new THREE.Group();
  scene.add(debugGroup);
  debugGroup.visible = false;
  const debugMaterial = new THREE.LineBasicMaterial({
    color: 0xb65c36,
    transparent: true,
    opacity: 0.75,
  });
  function clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments)
        child.geometry.dispose();
    }
  }
  const routeMaterial = new THREE.LineBasicMaterial({ color: 0x2e7666 });
  const routeLine = new THREE.Line(new THREE.BufferGeometry(), routeMaterial);
  scene.add(routeLine);
  let revision = -1;
  function update(simulation: Simulation) {
    resident.position.set(simulation.position.x, 0, simulation.position.z);
    const turn = Math.atan2(
      Math.sin(simulation.heading - resident.rotation.y),
      Math.cos(simulation.heading - resident.rotation.y),
    );
    resident.rotation.y += turn * 0.2;
    const stride =
      simulation.status === "walking" && !simulation.paused
        ? Math.sin(simulation.distance * 9) * 0.43
        : 0;
    limbs.forEach(
      (limb, index) =>
        (limb.rotation.x =
          stride * (index < 2 ? 1 : -1) * (index % 2 ? -1 : 1)),
    );
    if (revision !== simulation.revision) {
      revision = simulation.revision;
      clearGroup(obstructionGroup);
      clearGroup(debugGroup);
      for (const object of scenarioObjects(simulation.scenario)) {
        addObject(obstructionGroup, object);
        box(
          obstructionGroup,
          object.x,
          0.82,
          object.z,
          object.width,
          0.06,
          0.69,
          0xe9c399,
        );
        for (
          let x = object.x - object.width / 2 + 0.2;
          x < object.x + object.width / 2;
          x += 0.4
        )
          box(obstructionGroup, x, 0.855, object.z, 0.16, 0.02, 0.69, 0x8c5337);
      }
      for (const object of simulation.obstacles) {
        const geometry = new THREE.BoxGeometry(
          object.width + 0.56,
          0.1,
          object.depth + 0.56,
        );
        const edges = new THREE.EdgesGeometry(geometry);
        geometry.dispose();
        const line = new THREE.LineSegments(edges, debugMaterial);
        line.position.set(object.x, 0.08, object.z);
        debugGroup.add(line);
      }
    }
    const points = simulation.route.length
      ? [simulation.position, ...simulation.route]
      : [];
    routeLine.geometry.dispose();
    routeLine.geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((point) => new THREE.Vector3(point.x, 0.07, point.z)),
    );
    controls.update();
    renderer.render(scene, camera);
  }
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(markerMeshes)[0];
    if (hit) onDestination(hit.object.userData.destination);
  });
  const observer = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    setView(topView);
  });
  observer.observe(container);
  return {
    update,
    setView,
    setDebug: (value: boolean) => (debugGroup.visible = value),
    setLabels: (value: boolean) =>
      labels.forEach((label) => (label.visible = value)),
  };
}
