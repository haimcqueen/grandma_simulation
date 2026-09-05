import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  destinations,
  floors,
  objects,
  scenarioObjects,
  patioFallZone,
  type HouseObject,
} from "./environment";
import type { Simulation } from "./simulation";
import { Robot } from "./robot/robot";
import { pose } from "./robot/gait";
import { UPRIGHT, lerpStance } from "./robot/stance";
import { crawl } from "./robot/crawl";
import { SUBJECTS, subjectById, type Subject } from "./robot/subjects";
import { LIVERIES } from "./robot/livery";
import { loadFigurine } from "./robot/figurine";
import { poseFall } from "./robot/fall";

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

  /** Close follow on the resident. Overhead and floor-plan views release it. */
  let follow = false;
  let followDistance = 3.2;
  const followTarget = new THREE.Vector3();
  const followEye = new THREE.Vector3();

  function setFollow(on: boolean) {
    follow = on;
    controls.enabled = !on;
    if (!on) setView(topView);
  }

  function zoomFollow(delta: number) {
    followDistance = Math.min(9, Math.max(1.1, followDistance + delta));
  }

  function updateFollow(simulation: Simulation, height: number) {
    if (!follow) return;
    // eye-level on the subject, so a 0.5 m infant is framed like a 1.8 m adult
    const eyeHeight = Math.max(0.35, height * 0.82);
    followTarget.set(simulation.position.x, eyeHeight, simulation.position.z);
    const back = followDistance;
    followEye.set(
      simulation.position.x - Math.sin(simulation.heading) * back,
      eyeHeight + followDistance * 0.42,
      simulation.position.z - Math.cos(simulation.heading) * back,
    );
    camera.position.lerp(followEye, 0.12);
    controls.target.lerp(followTarget, 0.18);
    camera.lookAt(controls.target);
  }

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
  const figurine = new THREE.Group();
  figurine.position.set(6.6, 0, 9.9);
  scene.add(figurine);
  const fallZone = new THREE.Mesh(
    new THREE.PlaneGeometry(patioFallZone.width, patioFallZone.depth),
    new THREE.MeshBasicMaterial({ color: 0xd89942, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  fallZone.rotation.x = -Math.PI / 2;
  fallZone.position.set(patioFallZone.x, 0.04, patioFallZone.z);
  fallZone.visible = false;
  scene.add(fallZone);
  let figurineModel: THREE.Group | null = null;
  let showFigurineReference = true;
  const figurineReady = loadFigurine().then(model => {
    figurineModel = model;
    figurine.add(model);
    return model;
  });
  // Placeholder resident replaced with a baked Unitree GLB. The `resident`
  // group contract is unchanged: simulation still owns position and heading.
  // Forward is +Z in the bake, matching this project's stated convention.
  let robot: Robot | null = null;
  let hunch = 1;
  let subject: Subject = SUBJECTS[0];
  const cache = new Map<string, Robot>();
  let subjectRequest = 0;

  async function setSubject(id: string) {
    const request = ++subjectRequest;
    const next = subjectById(id);
    if (next.locomotion === "rigid") {
      const model = await figurineReady;
      if (request !== subjectRequest) return null;
      if (robot) resident.remove(robot.root);
      robot = null;
      resident.add(model);
      figurine.visible = false;
      subject = next;
      return next;
    }
    let loaded = cache.get(next.asset);
    if (!loaded) {
      loaded = await new Robot().load(
        `/robot/${next.asset}.glb`,
        `/robot/${next.asset}.joints.json`,
      );
      cache.set(next.asset, loaded);
    }
    if (request !== subjectRequest) return null;
    if (figurineModel) figurine.add(figurineModel);
    figurine.visible = showFigurineReference;
    if (robot && robot !== loaded) resident.remove(robot.root);
    subject = next;
    robot = loaded;
    resident.add(loaded.root);
    console.info(
      `[resident] ${next.label}: ${loaded.height.toFixed(2)}m, ${next.speedMps} m/s, ${next.locomotion}`,
    );
    return next;
  }
  void setSubject("grandma").catch((error) =>
    console.error("[resident] load failed", error),
  );

  let liveryIndex = 0;
  function cycleSkin() {
    liveryIndex = (liveryIndex + 1) % LIVERIES.length;
    robot?.setSkin(LIVERIES[liveryIndex]);
    return LIVERIES[liveryIndex];
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "[") hunch = Math.max(0, hunch - 0.1);
    if (key === "]") hunch = Math.min(1, hunch + 0.1);
    if (key === "k") console.info(`[resident] skin: ${cycleSkin().label}`);
  });

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
    resident.rotation.y = simulation.heading;
    fallZone.visible = simulation.patioFallEnabled;
    if (robot) {
      robot.root.rotation.x = 0;
      if (simulation.isFalling) {
        const stance = lerpStance(UPRIGHT, subject.stance ?? UPRIGHT, hunch);
        const { pitch, roll } = poseFall(robot, stance, simulation.gaitPhase,
          simulation.fallStartedAt, subject.motion, simulation.gaitBlend, simulation.fallProgress);
        robot.root.rotation.set(pitch, 0, roll);
        robot.settleOnGround();
      } else if (subject.locomotion === "quadruped" && subject.crawl) {
        const { bob, roll } = crawl(
          robot,
          subject.crawl,
          simulation.gaitPhase,
          simulation.time,
          0,
          simulation.gaitBlend,
        );
        robot.root.rotation.z = roll;
        robot.settleOnGround(bob);
      } else {
        const stance = lerpStance(UPRIGHT, subject.stance ?? UPRIGHT, hunch);
        const { bob } = pose(robot, stance, simulation.gaitPhase, simulation.time,
          1, subject.motion, simulation.gaitBlend);
        robot.root.rotation.z = 0;
        robot.settleOnGround(bob);
      }
    }

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
    updateFollow(simulation, robot?.height ?? (subject.locomotion === "rigid" ? 1.55 : 1.3));
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
    setView: (top: boolean) => {
      if (follow) setFollow(false);
      setView(top);
    },
    setFollow,
    isFollowing: () => follow,
    zoomFollow,
    setSubject,
    subjects: SUBJECTS,
    figurineReady,
    setFigurineVisible: (visible: boolean) => {
      showFigurineReference = visible;
      figurine.visible = visible && subject.locomotion !== "rigid";
    },
    setSkin: (id: string) => robot?.setSkin(id),
    liveries: LIVERIES,
    setDebug: (value: boolean) => (debugGroup.visible = value),
    setLabels: (value: boolean) =>
      labels.forEach((label) => (label.visible = value)),
  };
}
