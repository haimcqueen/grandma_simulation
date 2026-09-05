import { EnvironmentAssets } from "./environmentAssets";
import { FLOOR_RISE } from "./stairs";
import { createStaircase } from "./stairView";
import { upperDestinations, upperFloors, upperObjects } from "./upperFloor";
import * as THREE from "three";
import { createHouseAppearance } from "./houseAppearance";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  destinations,
  floors,
  objects,
  scenarioObjects,
  patioFallZone,
  type HouseObject, type DestinationId, type FloorLevel,
} from "./environment";
import type { Simulation } from "./simulation";
import type { Scenario } from "./environment";
import { Robot } from "./robot/robot";
import { pose } from "./robot/gait";
import { UPRIGHT, lerpStance } from "./robot/stance";
import { crawl } from "./robot/crawl";
import { SUBJECTS, subjectById, type Subject } from "./robot/subjects";
import { LIVERIES } from "./robot/livery";
import { SwarmView } from "./robot/swarmView";
import { loadFigurine } from "./robot/figurine";
import { BALCONY, BALCONY_APPROACH, poseFall, fallOrientation } from "./robot/fall";

export function createHouseScene(
  container: HTMLElement,
  onDestination: (id: DestinationId) => void,
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedece6);
  const assets = new EnvironmentAssets(scene);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive ground-floor house. Drag to orbit, scroll to zoom, or use destination buttons.",
  );
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 120);
  const firstPersonCamera = new THREE.PerspectiveCamera(75, 1, 0.025, 120);
  const thirdPersonCamera = new THREE.PerspectiveCamera(55, 1, 0.05, 120);
  const widePane = container.querySelector<HTMLElement>("#wide-view")!;
  let cameraMode: "wide" | "first-person" | "third-person" = "wide";
  const controls = new OrbitControls(camera, widePane);
  controls.enableDamping = true;
  controls.minDistance = 12;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.47;
  const target = new THREE.Vector3(5.5, 0, 11);
  let topView = false;
  function setView(top: boolean) {
    cameraMode = "wide";
    controls.enabled = true;
    topView = top;
    controls.target.copy(target);
    const aspect = widePane.clientWidth / Math.max(1, widePane.clientHeight);
    const scale = Math.max(1, 0.95 / aspect);
    const offset = top
      ? new THREE.Vector3(0, 40, 0.01)
      : new THREE.Vector3(21.5, 29, 26);
    camera.position.copy(target).add(offset.multiplyScalar(scale));
    controls.update();
  }
  setView(false);
  function setCameraMode(mode: typeof cameraMode) {
    cameraMode = mode;
    controls.enabled = mode === "wide";
    container.dataset.cameraMode = mode;
  }

  let followDistance = 3.2;
  const followTarget = new THREE.Vector3();
  const followEye = new THREE.Vector3();

  function zoomFollow(delta: number) {
    followDistance = Math.min(9, Math.max(1.1, followDistance + delta));
  }

  function updateThirdPerson(simulation: Simulation, height: number) {
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const framing = Math.max(1, 0.9 / aspect);
    if (simulation.isFalling && simulation.fallKind === "balcony") {
      followTarget.set(BALCONY.x, 1.6, BALCONY.z + 1.6);
      thirdPersonCamera.position.copy(followTarget).add(new THREE.Vector3(5, 3.8, 6).multiplyScalar(framing));
      thirdPersonCamera.lookAt(followTarget);
      return;
    }
    const eyeHeight = simulation.elevation + Math.max(0.35,
      height * 0.55 * (simulation.isFalling ? 1 - simulation.fallProgress * 0.8 : 1));
    followTarget.set(simulation.position.x, eyeHeight, simulation.position.z);
    const back = (simulation.onStairs ? Math.min(1.65, followDistance) : followDistance) * framing;
    followEye.set(
      simulation.position.x - Math.sin(simulation.heading) * back,
      eyeHeight + back * 0.4,
      simulation.position.z - Math.cos(simulation.heading) * back,
    );
    thirdPersonCamera.position.copy(followEye);
    thirdPersonCamera.lookAt(followTarget);
  }

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb5ada1, 2.5));
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
  const appearance = createHouseAppearance(renderer.capabilities.getMaxAnisotropy());
  const groundShell = new THREE.Group();
  groundShell.add(appearance.fixed, appearance.upper, appearance.cutawayCaps);
  box(groundShell, 5.5, -0.55, 11, 15, 0.25, 26, 0xe4e3d9);
  box(groundShell, 5.5, -0.35, 11, 12, 0.35, 23, 0xbac2af);
  for (const floor of floors) {
    const mesh = box(groundShell, floor.x, -0.08, floor.z, floor.width, 0.16, floor.depth, floor.color);
    mesh.material = appearance.floorMaterial(floor.id, floor.width, floor.depth);
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
    appearance.decorate(object, mesh, parent);
  }
  for (const object of objects) {
    if (object.id === "stair-volume") continue;
    if (object.kind === "wall") addObject(groundShell, object);
    else {
      const fallback = new THREE.Group();
      addObject(fallback, object);
      assets.register(`ground:${object.id}`, scene, fallback, object);
    }
  }
  assets.register("ground:shell", scene, groundShell);
  // Small surface details are contained by their parent object's collision shape.
  box(assets.fallback("ground:east-counter"), 10.65, 0.965, 12.4, 0.52, 0.015, 0.65, 0x4c5654);
  for (const z of [12.22, 12.58])
    for (const x of [10.52, 10.78]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.012, 6, 20),
        material(0xbac2ba),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.98, z);
      assets.fallback("ground:east-counter").add(ring);
    }
  box(assets.fallback("ground:island"), 8.15, 1.01, 12.15, 0.55, 0.06, 0.45, 0x6e8773);
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
    label("GARDEN", 7.7, 0.8),
    label("ATTACHED ADU", 2.2, 5.5),
    label("GARAGE", 2.9, 18),
    label("BEDROOM", 9.2, 21.5),
    label("ENTRY", 6.55, 20.8, 1.2),
  ];
  let showRoomLabels = true;
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
  const groundGroup = new THREE.Group();
  groundGroup.name = "ground-floor";
  for (const child of [...scene.children]) {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite || child instanceof THREE.Group) groundGroup.add(child);
  }
  scene.add(groundGroup);
  const upstairs = new THREE.Group();
  upstairs.name = "second-floor";
  upstairs.position.y = FLOOR_RISE;
  const staircase = createStaircase();
  assets.register("stairs", scene, staircase);
  scene.add(upstairs);
  const upperAppearance = createHouseAppearance(renderer.capabilities.getMaxAnisotropy(), upperFloors, false);
  const upperShell = new THREE.Group();
  upperShell.add(upperAppearance.fixed, upperAppearance.upper, upperAppearance.cutawayCaps);
  assets.register("upper:shell", upstairs, upperShell);
  for (const floor of upperFloors) {
    if (floor.id === "upper-landing") {
      // Leave the traced stair opening genuinely open in the upper slab.
      const hole = upperObjects.find(o => o.id === "upper-stair-opening")!;
      const edge = hole.x + hole.width / 2;
      const end = floor.x + floor.width / 2;
      const mesh = box(upperShell, (edge + end) / 2, -0.08, floor.z, end - edge, 0.16, floor.depth, floor.color);
      mesh.material = upperAppearance.floorMaterial(floor.id, end - edge, floor.depth);
      continue;
    }
    const mesh = box(upperShell, floor.x, -0.08, floor.z, floor.width, 0.16, floor.depth, floor.color);
    mesh.material = upperAppearance.floorMaterial(floor.id, floor.width, floor.depth);
  }
  for (const object of upperObjects) {
    if (object.id === "upper-stair-opening") continue;
    const fallback = new THREE.Group();
    const mesh = box(fallback, object.x, object.height / 2, object.z,
      object.width, object.height, object.depth, object.color);
    mesh.name = object.id;
    upperAppearance.decorate(object, mesh, fallback);
    if (object.kind === "wall") upperShell.add(fallback);
    else assets.register(`upper:${object.id}`, upstairs, fallback, object);
  }
  const upperLabels = upperFloors.filter(f => ["primary-bedroom", "upper-bedroom-west", "upper-bedroom-south", "upper-bath", "walk-in-closet"].includes(f.id))
    .map(f => { const item = label(f.label, f.x, f.z, Math.min(3, f.width)); upstairs.add(item); return item; });
  const upperMarkers: THREE.Mesh[] = [];
  for (const destination of upperDestinations) {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 32), material(0x2e7666));
    marker.rotation.x = Math.PI / 2;
    marker.position.set(destination.x, 0.045, destination.z);
    marker.userData.destination = destination.id;
    upstairs.add(marker);
    upperMarkers.push(marker);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(marker.position);
    hit.userData.destination = destination.id;
    upstairs.add(hit);
    upperMarkers.push(hit);
  }
  let displayedLevel: FloorLevel = "ground";
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
  const tripCue = new THREE.Group();
  box(tripCue, 5.7, 0.04, 9.72, 0.75, 0.06, 0.08, 0x9c8668);
  const tripCueSlot = assets.register("fall:trip-cue", scene, tripCue);
  const balcony = new THREE.Group();
  balcony.name = "balcony-animation-set";
  balcony.visible = false;
  scene.add(balcony);
  box(balcony, BALCONY.x, -0.1, BALCONY.z + 1.4, 5, 0.2, 6.5, 0xd1c8b7);
  box(balcony, BALCONY.x, BALCONY.height - 0.12, BALCONY.z,
    BALCONY.width, 0.24, BALCONY.depth, 0xd9cbb5);
  for (const direction of [-1, 1]) {
    const side = BALCONY.x + direction * (BALCONY.width / 2 - 0.08);
    box(balcony, side, BALCONY.height / 2 - 0.12, BALCONY.z - 1.3,
      0.18, BALCONY.height - 0.24, 0.18, 0x6e746e);
    box(balcony, side, BALCONY.height + 0.9, BALCONY.z, 0.07, 0.07, BALCONY.depth, 0x59675f);
    for (const offset of [-1.3, -0.65, 0, 0.65, 1.3]) {
      box(balcony, side, BALCONY.height + 0.45, BALCONY.z + offset, 0.045, 0.9, 0.045, 0x59675f);
    }
  }
  box(balcony, BALCONY.x, BALCONY.height + 0.45, BALCONY.z - BALCONY.depth / 2,
    BALCONY.width, 0.9, 0.08, 0x9caa9c);
  box(balcony, BALCONY.x, BALCONY.height + 0.005, BALCONY.z + BALCONY.depth / 2 - 0.08,
    BALCONY.width, 0.01, 0.16, 0xd89942);
  const balconyLabel = label("BALCONY DEMO", BALCONY.x, BALCONY.z - 1.1, 2);
  balconyLabel.position.y = BALCONY.height + 1.3;
  balcony.add(balconyLabel);
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
    if (figurineModel) {
      figurineModel.visible = true;
      figurineModel.rotation.set(0, 0, 0);
      figurineModel.position.y = 0;
      figurine.add(figurineModel);
    }
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
  const swarmView = new SwarmView(100);
  scene.add(swarmView.group);

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
  let lastSimTime = 0;
  const figurineBounds = new THREE.Box3();
  const eyePosition = new THREE.Vector3();
  const eyeDirection = new THREE.Vector3();
  const eyeRotation = new THREE.Quaternion();
  function updateFirstPerson(simulation: Simulation) {
    const body = robot?.root ?? (subject.locomotion === "rigid" ? figurineModel : null);
    if (robot) robot.getEyePosition(eyePosition);
    else if (body) body.localToWorld(eyePosition.set(0, 1.55 * 0.9, 0.06));
    else eyePosition.set(simulation.position.x, simulation.elevation + 1.2, simulation.position.z);
    if (body) body.getWorldQuaternion(eyeRotation);
    else eyeRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), simulation.heading);
    eyeDirection.set(0, 0, 1).applyQuaternion(eyeRotation);
    firstPersonCamera.position.copy(eyePosition);
    firstPersonCamera.up.set(0, 1, 0).applyQuaternion(eyeRotation);
    firstPersonCamera.lookAt(eyePosition.add(eyeDirection));
  }
  function update(simulation: Simulation) {
    const onUpper = simulation.level === "upper";
    container.dataset.floorLevel = simulation.level;
    container.dataset.elevation = simulation.elevation.toFixed(3);
    container.dataset.heading = simulation.heading.toFixed(4);
    container.dataset.stairControl = simulation.manualStairs ? "manual" : "automatic";
    container.dataset.fallKind = simulation.fallKind;
    container.dataset.fallProgress = simulation.fallProgress.toFixed(3);
    if (simulation.level !== displayedLevel) {
      displayedLevel = simulation.level;
      target.set(onUpper ? 6 : 5.5, onUpper ? FLOOR_RISE : 0, onUpper ? 13 : 11);
      if (cameraMode === "wide") setView(topView);
      if (onUpper) swarmView.setVisible(false);
    }
    groundGroup.visible = !onUpper || simulation.onStairs;
    upstairs.visible = onUpper || simulation.onStairs;
    upperAppearance.setInterior(cameraMode === "first-person");
    upperLabels.forEach(item => { item.visible = showRoomLabels && cameraMode === "wide"; });
    figurine.visible = !onUpper && showFigurineReference && subject.locomotion !== "rigid";
    appearance.setInterior(cameraMode === "first-person");
    resident.position.set(simulation.position.x, 0, simulation.position.z);
    resident.rotation.y = simulation.heading;
    halo.position.y = simulation.elevation + 0.03;
    routeLine.position.y = onUpper ? FLOOR_RISE : 0;
    debugGroup.position.y = onUpper ? FLOOR_RISE : 0;
    fallZone.visible = simulation.patioFallEnabled || (simulation.isFalling && simulation.fallKind === "patio");
    tripCueSlot.visible = simulation.isFalling && simulation.fallKind === "trip";
    balcony.visible = simulation.isFalling && simulation.fallKind === "balcony";
    labels.forEach(roomLabel => { roomLabel.visible = showRoomLabels && cameraMode === "wide"; });
    halo.visible = !simulation.isFalling && cameraMode === "wide";
    if (figurineModel && subject.locomotion === "rigid") {
      figurineModel.position.y = 0;
      if (simulation.isFalling) {
        const { pitch, roll } = fallOrientation(simulation.fallKind, simulation.fallProgress, simulation.injuryProgress);
        figurineModel.rotation.set(pitch, 0, roll);
        figurineModel.updateMatrixWorld(true);
        figurineBounds.setFromObject(figurineModel);
        figurineModel.position.y = -figurineBounds.min.y + simulation.elevation;
      } else { figurineModel.rotation.set(0, 0, 0); figurineModel.position.y = simulation.elevation; }
    }
    if (robot) {
      robot.root.rotation.x = 0;
      const approachingBalcony = simulation.isFalling && simulation.fallKind === "balcony"
        && simulation.fallElapsed < BALCONY_APPROACH;
      if (simulation.isFalling && !approachingBalcony) {
        const stance = lerpStance(UPRIGHT, subject.stance ?? UPRIGHT, hunch);
        const { pitch, roll } = poseFall(robot, stance, simulation.gaitPhase,
          simulation.fallStartedAt, subject.motion, simulation.gaitBlend, simulation.fallProgress,
          simulation.injuryProgress, simulation.fallKind);
        robot.root.rotation.set(pitch, 0, roll);
        robot.settleOnGround(simulation.elevation);
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
        robot.settleOnGround(bob + simulation.elevation);
      } else {
        const stance = lerpStance(UPRIGHT, subject.stance ?? UPRIGHT, hunch);
        const { bob } = pose(robot, stance, simulation.gaitPhase, simulation.time,
          1, simulation.onStairs ? { ...subject.motion, kneeLift: Math.max(0.5, subject.motion.kneeLift) } : subject.motion, simulation.gaitBlend);
        robot.root.rotation.z = 0;
        robot.settleOnGround(bob + simulation.elevation);
      }
    }

    if (revision !== simulation.revision) {
      revision = simulation.revision;
      clearGroup(obstructionGroup);
      clearGroup(debugGroup);
      for (const object of simulation.level === "ground" ? scenarioObjects(simulation.scenario) : []) {
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
    routeLine.visible = cameraMode === "wide";
    if (controls.enabled) controls.update();
    updateThirdPerson(simulation, robot?.height ?? (subject.locomotion === "rigid" ? 1.55 : 1.3));
    updateFirstPerson(simulation);
    const activeBody = robot?.root ?? (subject.locomotion === "rigid" ? figurineModel : null);
    if (activeBody) activeBody.visible = cameraMode !== "first-person";
    balconyLabel.visible = cameraMode !== "first-person";
    const showDebug = debugGroup.visible;
    if (cameraMode !== "wide") debugGroup.visible = false;
    renderer.render(scene, cameraMode === "first-person" ? firstPersonCamera
      : cameraMode === "third-person" ? thirdPersonCamera : camera);
    debugGroup.visible = showDebug;
  }
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  widePane.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY };
  });
  widePane.addEventListener("pointerup", (event) => {
    if (cameraMode !== "wide") return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
    const rect = widePane.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(displayedLevel === "upper" ? upperMarkers : markerMeshes)[0];
    if (hit) onDestination(hit.object.userData.destination);
  });
  widePane.addEventListener("wheel", event => {
    if (cameraMode !== "third-person") return;
    event.preventDefault();
    zoomFollow(Math.sign(event.deltaY) * 0.35);
  }, { passive: false });
  const observer = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect();
    renderer.setSize(width, height);
    for (const viewCamera of [camera, firstPersonCamera, thirdPersonCamera]) {
      viewCamera.aspect = width / Math.max(1, height);
      viewCamera.updateProjectionMatrix();
    }
    if (cameraMode === "wide") setView(topView);
  });
  observer.observe(container);
  return {
    assets,
    update,
    setView,
    setCameraMode,
    cameraMode: () => cameraMode,
    isTopView: () => topView,
    zoomFollow,
    setSubject,
    subjects: SUBJECTS,
    figurineReady,
    setFigurineVisible: (visible: boolean) => {
      showFigurineReference = visible;
      figurine.visible = visible && subject.locomotion !== "rigid";
    },
    setSkin: (id: string) => robot?.setSkin(id),
    swarm: {
      toggle: () => { swarmView.setVisible(!swarmView.visible); return swarmView.visible; },
      visible: () => swarmView.visible,
      setCount: (n: number) => swarmView.setCount(n),
      reset: () => swarmView.reset(),
      stats: () => ({
        agents: swarmView.swarm.agents.length,
        falls: swarmView.swarm.totalFalls,
      }),
      setScenario: (s: Scenario) => swarmView.setScenario(s),
    },
    liveries: LIVERIES,
    setDebug: (value: boolean) => (debugGroup.visible = value),
    setLabels: (value: boolean) => { showRoomLabels = value; },
  };
}
