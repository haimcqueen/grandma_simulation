import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { SparkRenderer } from "@sparkjsdev/spark";
import { buildFixture } from "./fixture-scene";
import { createResident } from "./character";
import { disposeMeshes, loadWorld } from "./world-loader";
import { scenarioObjects } from "./environment";
import type { Environment, WorldAsset } from "./contracts";
import { floorHeightAt } from "./navigation-grid";
import { loadAnimatedResident, type ResidentAssets } from "./animated-resident";
import type { Simulation } from "./simulation";

export class Viewer {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.03, 100);
  readonly controls: OrbitControls;
  readonly scene = new THREE.Scene();
  readonly worldScene = new THREE.Scene();
  readonly overlayScene = new THREE.Scene();
  readonly fixture: ReturnType<typeof buildFixture>;
  readonly resident = createResident();
  readonly marker = createResident();
  readonly dynamic = new THREE.Group();
  readonly route = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x3c8b70 }),
  );
  readonly debug = new THREE.Group();
  readonly destinations = new THREE.Group();
  get asset() { return this.worldAsset; }
  world?: Awaited<ReturnType<typeof loadWorld>>;
  mode: "fixture" | "world" | "world-simulation" = "fixture";
  readonly navigationMap = new THREE.Group();
  animatedResident?: Awaited<ReturnType<typeof loadAnimatedResident>>;
  view: "overview" | "interior" | "follow" = "overview";
  debugVisible = false;
  worldDepth = true;
  private revision = -1;
  private loadRevision = 0;
  private resizeObserver: ResizeObserver;
  private spark?: SparkRenderer;
  private worldAsset?: WorldAsset;
  private routePositions = new Float32Array(4096 * 3);
  onSurface?: (point: THREE.Vector3) => void;
  constructor(
    readonly container: HTMLElement,
    public environment: Environment,
  ) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "House simulation. Drag to orbit and scroll to zoom.",
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 32;
    this.scene.background = new THREE.Color("#edece5");
    this.worldScene.background = new THREE.Color("#29372f");
    this.fixture = buildFixture(environment);
    this.scene.add(this.navigationMap);
    this.scene.add(
      this.fixture.root,
      this.resident.root,
      this.dynamic,
      this.route,
      this.debug,
    );
    this.route.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.routePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.route.frustumCulled = false;
    for (const scene of [this.scene, this.overlayScene]) {
      scene.add(new THREE.HemisphereLight(0xfff9e8, 0x7b8b7a, 2.3));
      const light = new THREE.DirectionalLight(0xfff5dd, 3);
      light.position.set(0, 9, -3);
      if (scene === this.scene) {
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        Object.assign(light.shadow.camera, {
          left: -12,
          right: 12,
          top: 12,
          bottom: -12,
          near: 0.1,
          far: 35,
        });
        light.shadow.normalBias = 0.025;
      }
      scene.add(light);
    }
    this.overlayScene.add(this.marker.root);
    this.marker.root.visible = false;
    this.refreshDestinationMarkers();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    let pointer = { x: 0, y: 0 };
    this.renderer.domElement.addEventListener("pointerdown", (event) => {
      pointer = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener("pointerup", (event) => {
      if (
        this.mode !== "world" ||
        !this.world ||
        Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4
      )
        return;
      const bounds = this.renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = ray.intersectObject(this.world.collider, true)[0];
      if (hit) {
        this.marker.root.position.copy(hit.point);
        this.marker.root.visible = true;
        this.onSurface?.(hit.point);
      }
    });
    this.setView("overview");
    this.resize();
  }
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, Math.max(height, 1));
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
  private refreshDestinationMarkers() {
    disposeMeshes(this.destinations);
    this.destinations.clear();
    for (const destination of this.environment.destinations) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.22, 40),
        new THREE.MeshBasicMaterial({ color: 0x79b89e, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(destination.x, floorHeightAt(this.environment, destination) + 0.045, destination.z);
      ring.name = destination.id;
      this.destinations.add(ring);
    }
    (this.mode === "world-simulation" ? this.overlayScene : this.scene).add(this.destinations);
  }
  setView(view: Viewer["view"]) {
    this.view = view;
    if (this.mode === "world-simulation") {
      this.camera.fov = 65;
      if (view === "overview") {
        this.camera.position.set(0.1, 1.75, 1.8);
        this.controls.target.set(0.9, 1, -1.5);
      } else {
        this.camera.position.set(0, 1.6, 1.4);
        this.controls.target.set(1, 1, -2);
      }
      this.attachSimulation(this.overlayScene);
    } else if (this.mode === "world") {
      this.camera.fov = 65;
      this.camera.position.fromArray(this.worldAsset!.camera.position);
      this.controls.target.fromArray(this.worldAsset!.camera.target);
    } else {
      this.camera.fov = 48;
      this.fixture.wallGroup.visible = view !== "overview";
      if (view === "overview") {
        this.camera.position.set(13, 14, -10);
        this.controls.target.set(4, 0, 4.4);
      } else {
        this.camera.position.set(4, 1.65, 0.5);
        this.controls.target.set(4, 1.2, 6);
      }
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  private attachSimulation(parent: THREE.Object3D) {
    parent.add(this.resident.root, this.dynamic, this.route, this.debug, this.destinations);
  }
  async loadResident(assets: ResidentAssets) {
    const revision = this.loadRevision;
    const resident = await loadAnimatedResident(assets);
    if (revision !== this.loadRevision) { resident.dispose(); return; }
    this.animatedResident?.dispose();
    disposeMeshes(this.resident.root);
    this.resident.root.clear();
    this.resident.root.add(resident.root);
    this.animatedResident = resident;
  }
  activateWorldSimulation(environment: Environment) {
    this.environment = environment;
    this.mode = "world-simulation";
    this.revision = -1;
    this.fixture.root.visible = false;
    this.marker.root.visible = false;
    this.navigationMap.visible = false;
    this.overlayScene.add(this.navigationMap);
    this.refreshDestinationMarkers();
    disposeMeshes(this.navigationMap);
    this.navigationMap.clear();
    const grid = environment.navigation!;
    const count = grid.walkable.filter(Boolean).length;
    const cells = new THREE.InstancedMesh(
      new THREE.BoxGeometry(grid.cell * 0.98, 0.025, grid.cell * 0.98),
      new THREE.MeshBasicMaterial({ color: 0x86b5a4, transparent: true, opacity: 0.3, depthWrite: false }),
      count,
    );
    const matrix = new THREE.Matrix4();
    let index = 0;
    grid.walkable.forEach((valid, key) => {
      if (!valid) return;
      matrix.makeTranslation(
        grid.origin.x + ((key % grid.columns) + 0.5) * grid.cell,
        grid.floorHeights[key] + 0.025,
        grid.origin.z + (Math.floor(key / grid.columns) + 0.5) * grid.cell,
      );
      cells.setMatrixAt(index++, matrix);
    });
    this.navigationMap.add(cells);
    this.setView("interior");
  }
  showFixture() {
    this.loadRevision++;
    this.mode = "fixture";
    this.fixture.root.visible = true;
    this.navigationMap.visible = false;
    this.attachSimulation(this.scene);
    this.refreshDestinationMarkers();
    this.revision = -1;
    this.setView("overview");
  }
  async showWorld(asset: WorldAsset) {
    const revision = ++this.loadRevision;
    const loaded = await loadWorld(asset);
    const { SparkRenderer } = await import("@sparkjsdev/spark");
    if (revision !== this.loadRevision) {
      loaded.dispose();
      return false;
    }
    if (this.world) {
      this.worldScene.remove(this.world.splats);
      this.overlayScene.remove(this.world.depth, this.world.wire);
      this.world.dispose();
    }
    this.world = loaded;
    this.worldAsset = asset;
    if (!this.spark) {
      this.spark = new SparkRenderer({ renderer: this.renderer });
      this.worldScene.add(this.spark);
    }
    this.worldScene.add(loaded.splats);
    this.overlayScene.add(loaded.depth, loaded.wire);
    this.mode = "world";
    this.attachSimulation(this.scene);
    this.navigationMap.visible = false;
    this.setView("interior");
    this.camera.position.fromArray(asset.camera.position);
    this.controls.target.fromArray(asset.camera.target);
    this.controls.update();
    const floor = loaded.floorAt(0, 1, 0);
    this.marker.root.visible = !!floor;
    if (floor) this.marker.root.position.copy(floor);
    return true;
  }
  update(simulation: Simulation) {
    this.resident.root.position.set(
      simulation.position.x,
      floorHeightAt(this.environment, simulation.position),
      simulation.position.z,
    );
    const desired = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      simulation.heading,
    );
    this.resident.root.quaternion.slerp(desired, 0.18);
    if (this.animatedResident)
      this.animatedResident.update(
        simulation.time,
        simulation.distance,
        simulation.status === "walking",
        simulation.paused,
        simulation.profile.speed,
      );
    else
      this.resident.animate(
        simulation.distance,
        simulation.status === "walking",
      );
    if (this.revision !== simulation.revision) {
      this.revision = simulation.revision;
      disposeMeshes(this.dynamic);
      this.dynamic.clear();
      disposeMeshes(this.debug);
      this.debug.clear();
      for (const object of scenarioObjects(
        this.environment,
        simulation.scenario,
      )) {
        const mesh = this.fixture.createObstruction(object);
        mesh.position.y = floorHeightAt(this.environment, object);
        this.dynamic.add(mesh);
      }
      for (const object of simulation.obstacles) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(
            object.width + simulation.profile.radius * 2,
            0.05,
            object.depth + simulation.profile.radius * 2,
          ),
          new THREE.MeshBasicMaterial({ color: 0xcb894f, wireframe: true }),
        );
        mesh.position.set(object.x, this.environment.floorY + 0.07, object.z);
        mesh.name = object.id;
        this.debug.add(mesh);
      }
    }
    this.debug.visible = this.debugVisible;
    this.navigationMap.visible = this.mode === "world-simulation" && this.debugVisible;
    const points = [simulation.position, ...simulation.route];
    points.slice(0, 4096).forEach((point, index) => {
      this.routePositions[index * 3] = point.x;
      this.routePositions[index * 3 + 1] =
        floorHeightAt(this.environment, point) + 0.04;
      this.routePositions[index * 3 + 2] = point.z;
    });
    this.route.geometry.attributes.position.needsUpdate = true;
    this.route.geometry.setDrawRange(0, Math.min(points.length, 4096));
    this.route.visible = simulation.route.length > 0;
    if (this.mode !== "world" && this.view === "follow") {
      const target = new THREE.Vector3(
        simulation.position.x,
        floorHeightAt(this.environment, simulation.position) + 1.1,
        simulation.position.z,
      );
      const desiredCamera = target.clone().add(new THREE.Vector3(0, 0.55, 1.8));
      if (this.mode === "world-simulation" && this.world) {
        const direction = desiredCamera.clone().sub(target);
        const ray = new THREE.Raycaster(target, direction.clone().normalize(), 0, direction.length());
        const hit = ray.intersectObject(this.world.collider, true)[0];
        if (hit) desiredCamera.copy(target).addScaledVector(direction.normalize(), Math.max(0.15, hit.distance - 0.15));
      }
      this.camera.position.lerp(desiredCamera, 0.08);
      this.controls.target.lerp(target, 0.08);
    }
    this.controls.update();
    if (this.mode === "fixture") {
      this.renderer.autoClear = true;
      this.renderer.render(this.scene, this.camera);
    } else if (this.world) {
      // The collider only writes depth after splat color is complete, so it cannot cut holes in the backdrop.
      this.renderer.autoClear = true;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.render(this.worldScene, this.camera);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.world.depth.visible = this.worldDepth;
      this.world.wire.visible = this.debugVisible;
      this.renderer.render(this.overlayScene, this.camera);
      this.renderer.autoClear = true;
    }
  }
  dispose() {
    this.loadRevision++;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.world?.dispose();
    this.animatedResident?.dispose();
    this.spark?.dispose();
    disposeMeshes(this.scene);
    disposeMeshes(this.marker.root);
    this.route.geometry.dispose();
    this.route.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
