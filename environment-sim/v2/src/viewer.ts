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
import { loadRobotResident } from "./robot-resident";
import type { House } from "./house";
import { buildStairConnection, disposeStairConnection } from "./stair-environment";
import type { Simulation } from "./simulation";
import { postures, type Posture } from "./posture";
import { defaultRobotAssets, type RobotAsset } from "./robot-assets";
import { RoomHazardView } from "./hazard-view";
import { buildHouseMap } from "./house-map";

export class Viewer {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.03, 100);
  readonly controls: OrbitControls;
  readonly topCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly topControls: OrbitControls;
  readonly topScene = new THREE.Scene();
  get activeCamera() { return this.view === "map" ? this.topCamera : this.camera; }
  private topSpan = 10;
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
  readonly floorRepairs = new THREE.Scene();
  readonly roomObjects = new THREE.Group();
  readonly hazards = new RoomHazardView();
  hazardPropsVisible = true;
  get asset() { return this.worldAsset; }
  house?: House;
  floorView = "auto";
  private houseWorlds = new Map<string, { world: Awaited<ReturnType<typeof loadWorld>>; asset: WorldAsset; floorY: number }>();
  readonly stairs = new THREE.Group();
  private visibleFloor = "";
  world?: Awaited<ReturnType<typeof loadWorld>>;
  mode: "fixture" | "world" | "world-simulation" = "fixture";
  readonly navigationMap = new THREE.Group();
  readonly mapConnections = new THREE.Group();
  animatedResident?: Awaited<ReturnType<typeof loadAnimatedResident | typeof loadRobotResident>>;
  view: "overview" | "interior" | "follow" | "first" | "top" | "side" | "map" = "overview";
  debugVisible = false;
  worldDepth = true;
  cutawayHeight = 1.8;
  cutawayEnabled = true;
  private cutawayKey = "";
  private readonly roomBounds = new THREE.Box3();
  private revision = -1;
  private loadRevision = 0;
  private residentRevision = 0;
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
    this.renderer.localClippingEnabled = true;
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
    this.topCamera.up.set(0, 0, -1);
    this.topControls = new OrbitControls(this.topCamera, this.renderer.domElement);
    this.topControls.enableRotate = false;
    this.topControls.screenSpacePanning = true;
    this.topControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.topControls.touches.ONE = THREE.TOUCH.PAN;
    this.topControls.minZoom = 0.5;
    this.topControls.maxZoom = 8;
    this.topControls.enabled = false;
    this.topScene.background = new THREE.Color("#edece5");
    this.topScene.add(new THREE.HemisphereLight(0xfff9e8, 0x7b8b7a, 2.3));
    this.topScene.add(this.mapConnections);
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
      const hit = this.world.raycast(ray)[0];
      if (hit) {
        this.marker.root.position.copy(hit.point);
        this.marker.root.visible = true;
        this.onSurface?.(hit.point);
      }
    });
    this.setView("overview");
    this.resize();
  }
  /** Pick the visible floor, rejecting furniture and unverified surfaces. */
  pickMovementTarget(clientX: number, clientY: number) {
    if (this.mode === "world") return null;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), this.activeCamera);
    if (this.view === "map" || this.mode === "fixture") {
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.environment.floorY), new THREE.Vector3());
      return hit ? { point: { x: hit.x, z: hit.z }, floor: this.house?.floors.find(floor => floor.environment.id === this.environment.id)?.id ?? "ground" } : null;
    }
    const floors = this.house ? this.house.floors : [{ id: "ground", environment: this.environment }];
    const candidates = floors.flatMap(floor => {
      const world = this.houseWorlds.get(floor.id)?.world ?? this.world;
      if (!world?.splats.visible) return [];
      const cut = world.cutawayState;
      const hit = world.raycast(ray).find(hit => {
        if (cut.ceilingHeight !== null && hit.point.y > cut.ceilingHeight) return false;
        const [x, z, limit] = cut.frontEquation;
        return !(cut.frontEnabled && hit.point.y > floor.environment.floorY + 0.65 && hit.point.x * x + hit.point.z * z > limit);
      });
      return hit ? [{ hit, floor }] : [];
    }).sort((a, b) => a.hit.distance - b.hit.distance);
    if (this.house && this.stairs.visible) {
      const authored = ray.intersectObject(this.stairs, true).find(hit => {
        if (!hit.object.visible || !(hit.object instanceof THREE.Mesh)) return false;
        const material = hit.object.material as THREE.Material;
        return !(material.clippingPlanes ?? []).some(plane => plane.distanceToPoint(hit.point) < 0);
      });
      if (authored) {
        const floor = this.house.floors.find(floor => floor.id === authored.object.userData.navigationFloor);
        if (!floor && (!candidates[0] || authored.distance < candidates[0].hit.distance)) return null;
        if (floor && (this.floorView === "all" || floor.environment.id === this.environment.id || this.floorView === floor.id)) candidates.push({ hit: authored, floor });
      }
    }
    candidates.sort((a, b) => a.hit.distance - b.hit.distance);
    const nearest = candidates[0];
    if (!nearest) return null;
    const point = { x: nearest.hit.point.x, z: nearest.hit.point.z };
    if (Math.abs(nearest.hit.point.y - floorHeightAt(nearest.floor.environment, point)) > 0.18) return null;
    return { point, floor: nearest.floor.id };
  }
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, Math.max(height, 1));
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.resizeTopCamera();
  }
  private resizeTopCamera() {
    const aspect = this.camera.aspect;
    this.topCamera.left = -this.topSpan * aspect / 2;
    this.topCamera.right = this.topSpan * aspect / 2;
    this.topCamera.top = this.topSpan / 2;
    this.topCamera.bottom = -this.topSpan / 2;
    this.topCamera.updateProjectionMatrix();
  }
  private refreshDestinationMarkers() {
    this.hazards.setEnvironment(this.environment);
    (this.mode === "world-simulation" ? this.overlayScene : this.scene).add(this.hazards.root);
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
    if ((view === "map" || view === "top" || view === "side") && this.mode === "world") return;
    if (view === "first" || view === "follow") { this.floorView = "auto"; this.visibleFloor = ""; }
    this.view = view;
    this.controls.enabled = view !== "map" && view !== "first";
    this.controls.enableRotate = view !== "top";
    this.topControls.enabled = view === "map";
    if (view === "map") {
      this.floorView = "auto"; this.visibleFloor = "";
      this.attachSimulation(this.topScene);
      if (this.mode === "world-simulation") this.topScene.add(this.navigationMap);
      else { this.topScene.add(this.fixture.root); this.fixture.wallGroup.visible = false; }
      const bounds = this.mode === "world-simulation"
        ? new THREE.Box3().setFromObject(this.navigationMap)
        : new THREE.Box3().setFromObject(this.fixture.root);
      if (this.house) bounds.union(new THREE.Box3().setFromObject(this.mapConnections));
      if (bounds.isEmpty()) bounds.setFromCenterAndSize(new THREE.Vector3(this.environment.floor.x, 0, this.environment.floor.z), new THREE.Vector3(this.environment.floor.width, 1, this.environment.floor.depth));
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      this.topSpan = Math.max(size.z, size.x / this.camera.aspect, 3) * 1.35;
      this.topCamera.zoom = 1;
      this.topCamera.position.set(center.x, bounds.max.y + 25, center.z);
      this.topControls.target.set(center.x, this.environment.floorY, center.z);
      this.resizeTopCamera();
      this.topControls.update();
      return;
    }
    this.scene.add(this.fixture.root);
    this.overlayScene.add(this.navigationMap);
    if (this.mode === "fixture") this.attachSimulation(this.scene);
    if (this.mode === "world-simulation") {
      this.camera.fov = 65;
      if (view === "overview" || view === "top" || view === "side") {
        const center = this.roomBounds.getCenter(new THREE.Vector3());
        const size = this.roomBounds.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.z);
        const framing = Math.max(1, 0.9 / this.camera.aspect);
        this.camera.fov = 38;
        this.controls.target.set(center.x, this.house ? center.y : this.environment.floorY + 0.5, center.z);
        const offset = view === "top" ? new THREE.Vector3(0, span * 1.55, 0.001)
          : view === "side" ? new THREE.Vector3(span * 0.1, span * 0.42, span * 1.45)
          : new THREE.Vector3(span * 0.85, span * 1.05, span * 1.05);
        this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(framing));
      } else {
        if (this.house) {
          this.camera.position.fromArray(this.worldAsset!.camera.position);
          this.controls.target.fromArray(this.worldAsset!.camera.target);
        } else {
          this.camera.position.set(0, 1.6, 1.4);
          this.controls.target.set(1, 1, -2);
        }
      }
      this.attachSimulation(this.overlayScene);
    } else if (this.mode === "world") {
      this.camera.fov = 65;
      this.camera.position.fromArray(this.worldAsset!.camera.position);
      this.controls.target.fromArray(this.worldAsset!.camera.target);
    } else {
      this.camera.fov = 48;
      this.fixture.wallGroup.visible = view === "interior" || view === "follow" || view === "first";
      if (view === "top") {
        this.camera.position.set(4, 17, 4.501);
        this.controls.target.set(4, 0, 4.5);
      } else if (view === "overview" || view === "side") {
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
    parent.add(this.resident.root, this.dynamic, this.route, this.debug, this.destinations, this.hazards.root, this.roomObjects);
  }
  async loadResident(assets: ResidentAssets) {
    return this.replaceResident(() => loadAnimatedResident(assets));
  }
  async loadRobot(posture: Posture = "grandma", asset: RobotAsset = defaultRobotAssets[postures[posture].asset as keyof typeof defaultRobotAssets]) {
    return this.replaceResident(() => loadRobotResident(posture, asset));
  }
  private async replaceResident(load: () => Promise<NonNullable<Viewer["animatedResident"]>>) {
    const revision = ++this.residentRevision;
    const resident = await load();
    if (revision !== this.residentRevision) { resident.dispose(); return; }
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
    disposeMeshes(this.mapConnections, true);
    this.mapConnections.clear();
    const floor = this.house?.floors.find(floor => floor.environment.id === environment.id);
    if (this.house && floor) this.mapConnections.add(buildHouseMap(this.house, floor.id));
    this.setView("interior");
  }
  private clearHouse() {
    disposeMeshes(this.mapConnections, true); this.mapConnections.clear();
    for (const entry of this.houseWorlds.values()) {
      this.worldScene.remove(entry.world.splats);
      this.overlayScene.remove(entry.world.depth, entry.world.wire);
      if (entry.world !== this.world) entry.world.dispose();
    }
    this.houseWorlds.clear(); this.house = undefined; this.floorView = "auto"; this.visibleFloor = "";
    this.stairs.removeFromParent(); disposeStairConnection(this.stairs); this.stairs.clear();
  }
  async showHouse(house: House) {
    const revision = ++this.loadRevision;
    const results = await Promise.allSettled(house.floors.map(floor => loadWorld(floor.world)));
    if (revision !== this.loadRevision || results.some(result => result.status === "rejected")) {
      for (const result of results) if (result.status === "fulfilled") result.value.dispose();
      if (revision !== this.loadRevision) return false;
      throw new Error("A house floor could not load. The existing room is still available.");
    }
    const { SparkRenderer } = await import("@sparkjsdev/spark");
    if (revision !== this.loadRevision) {
      for (const result of results) if (result.status === "fulfilled") result.value.dispose();
      return false;
    }
    this.clearHouse();
    if (this.world) { this.worldScene.remove(this.world.splats, this.world.cutaway); this.overlayScene.remove(this.world.depth, this.world.wire); this.world.dispose(); }
    this.house = house;
    house.floors.forEach((floor, i) => {
      const world = (results[i] as PromiseFulfilledResult<Awaited<ReturnType<typeof loadWorld>>>).value;
      this.houseWorlds.set(floor.id, { world, asset: floor.world, floorY: floor.environment.floorY });
      this.worldScene.add(world.splats); this.overlayScene.add(world.depth, world.wire);
    });
    if (!this.spark) { this.spark = new SparkRenderer({ renderer: this.renderer }); this.worldScene.add(this.spark); }
    for (const link of house.connections) this.stairs.add(buildStairConnection(link));
    this.overlayScene.add(this.stairs);
    this.useHouseFloor(house.floors[0].id);
    this.activateWorldSimulation(house.floors[0].environment);
    return true;
  }
  private useHouseFloor(id: string) {
    const entry = this.houseWorlds.get(id)!;
    this.world = entry.world; this.worldAsset = entry.asset; this.cutawayKey = "";
    this.roomBounds.setFromObject(entry.world.collider);
  }
  setFloorView(id: string) {
    if (!this.house || !["auto", "all", ...this.house.floors.map(floor => floor.id)].includes(id)) return;
    this.floorView = id; this.visibleFloor = "";
    if (id !== "auto" && ["first", "follow", "map"].includes(this.view)) this.setView("overview");
  }
  showFixture() {
    this.clearHouse();
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
    this.clearHouse();
    if (this.world) {
      this.worldScene.remove(this.world.splats, this.world.cutaway);
      this.overlayScene.remove(this.world.depth, this.world.wire);
      this.world.dispose();
    }
    this.world = loaded;
    this.roomBounds.setFromObject(loaded.collider);
    this.cutawayKey = "";
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
    if (this.house && this.mode === "world-simulation") {
      if (this.environment.id !== simulation.environment.id) {
        const view = this.view;
        this.useHouseFloor(simulation.floorId);
        this.activateWorldSimulation(simulation.environment);
        this.setView(view);
      }
      const selection = simulation.floorJourney?.phase === "stairs" ? "all" : this.floorView === "auto" ? simulation.floorId : this.floorView;
      for (const [id, entry] of this.houseWorlds) {
        const visible = selection === "all" || id === selection;
        entry.world.splats.visible = visible;
        entry.world.depth.visible = visible && this.worldDepth;
        entry.world.wire.visible = visible && this.debugVisible;
      }
      this.stairs.visible = this.view !== "map";
      if (this.visibleFloor !== selection) {
        this.visibleFloor = selection;
        this.roomBounds.makeEmpty();
        for (const [id, entry] of this.houseWorlds) if (selection === "all" || id === selection)
          this.roomBounds.union(new THREE.Box3().setFromObject(entry.world.collider));
        if (selection === "all") this.roomBounds.union(new THREE.Box3().setFromObject(this.stairs));
        else this.stairs.traverse(child => {
          if (child instanceof THREE.Mesh && child.userData.architecture && Math.abs(child.userData.floorY - this.house!.floors.find(f => f.id === selection)!.environment.floorY) < .1)
            this.roomBounds.union(new THREE.Box3().setFromObject(child));
        });
        if (["top", "side", "overview"].includes(this.view)) this.setView(this.view);
      }
    }
    this.hazards.root.visible = this.hazardPropsVisible && this.mode !== "world";
    this.hazards.showZones(this.view === "map" || this.debugVisible);
    const cut = this.mode === "world-simulation" && this.cutawayEnabled &&
      (this.view === "top" || this.view === "side" || this.view === "overview");
    (this.worldScene.background as THREE.Color).set(cut ? "#edece5" : "#29372f");
    const entries = this.house ? [...this.houseWorlds.values()] : this.world ? [{world: this.world, floorY: this.environment.floorY}] : [];
    const cutawayKey = `${cut}:${this.cutawayHeight}`;
    for (const {world, floorY} of entries) {
      if (cutawayKey !== this.cutawayKey) world.setCutaway(cut ? floorY + this.cutawayHeight : null);
      const focus = new THREE.Vector3(simulation.position.x, simulation.elevation + 1.05, simulation.position.z);
      const sightline = focus.clone().sub(this.camera.position);
      const ray = new THREE.Raycaster(this.camera.position, sightline.clone().normalize(), 0, Math.max(0, sightline.length() - 0.3));
      const obstruction = cut && this.view !== "top" ? world.raycast(ray).find(hit => hit.point.y > floorY + 1.0 && hit.point.y < floorY + this.cutawayHeight) : undefined;
      const facing = this.camera.position.clone().sub(focus); facing.y = 0; facing.normalize();
      const frontPoint = obstruction ? obstruction.point.clone().addScaledVector(facing, -0.25) : focus;
      world.setFrontCut(obstruction ? facing : null, frontPoint, floorY);
    }
    if (this.house) {
      const focus = new THREE.Vector3(simulation.position.x, simulation.elevation + 1.05, simulation.position.z);
      const direction = focus.clone().sub(this.camera.position);
      const sightline = new THREE.Raycaster(this.camera.position, direction.clone().normalize(), 0, Math.max(0, direction.length() - .25));
      const selection = simulation.floorJourney?.phase === "stairs" ? "all" : this.floorView === "auto" ? simulation.floorId : this.floorView;
      this.stairs.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !child.userData.architecture) return;
        const floorY = child.userData.floorY as number;
        const floorId = this.house!.floors.find(f => Math.abs(f.environment.floorY - floorY) < .1)?.id;
        child.visible = selection === "all" || selection === floorId || (!cut && child.userData.stairShell);
        if (!child.userData.cutPlane) {
          child.userData.cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), floorY + this.cutawayHeight);
        }
        const material = child.material as THREE.Material;
        child.userData.cutPlane.constant = floorY + this.cutawayHeight;
        if (child.userData.cutEnabled !== cut) { material.clippingPlanes = cut ? [child.userData.cutPlane] : null; material.needsUpdate = true; child.userData.cutEnabled = cut; }
        if (child.visible && cut && this.view !== "top" && !child.userData.navigationFloor) {
          const normal = child.userData.cutawayNormal ? new THREE.Vector3(...child.userData.cutawayNormal).transformDirection(child.matrixWorld) : undefined;
          const toCamera = this.camera.position.clone().sub(child.getWorldPosition(new THREE.Vector3()));
          if ((normal && normal.dot(toCamera) > 0) || sightline.intersectObject(child).length) child.visible = false;
        }
      });
    }
    this.cutawayKey = cutawayKey;
    this.resident.root.position.set(
      simulation.position.x,
      simulation.elevation,
      simulation.position.z,
    );
    const desired = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      simulation.heading,
    );
    if (!simulation.paused) this.resident.root.quaternion.slerp(desired, 0.18);
    if (this.animatedResident && "setMotion" in this.animatedResident)
      this.animatedResident.setMotion(simulation.posture, simulation.gaitPhase, simulation.hunch, simulation.skin);
    if (this.animatedResident && "setFall" in this.animatedResident)
      this.animatedResident.setFall(simulation.fall);
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
    const activeFloorVisible = !this.house || this.visibleFloor === "all" || this.visibleFloor === simulation.floorId;
    this.hazards.root.visible = this.hazardPropsVisible && this.mode !== "world" && activeFloorVisible && !simulation.floorJourney;
    this.dynamic.visible = activeFloorVisible;
    this.destinations.visible = activeFloorVisible;
    this.debug.visible = this.debugVisible && activeFloorVisible;
    this.navigationMap.visible = this.mode === "world-simulation" && activeFloorVisible && (this.debugVisible || this.view === "map");
    const cells = this.navigationMap.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    if (cells) cells.material.opacity = this.view === "map" ? 0.85 : 0.3;
    const points = [simulation.position, ...simulation.route];
    points.slice(0, 4096).forEach((point, index) => {
      this.routePositions[index * 3] = point.x;
      this.routePositions[index * 3 + 1] =
        floorHeightAt(this.environment, point) + 0.04;
      this.routePositions[index * 3 + 2] = point.z;
    });
    this.route.geometry.attributes.position.needsUpdate = true;
    this.route.geometry.setDrawRange(0, Math.min(points.length, 4096));
    this.route.visible = simulation.route.length > 0 && activeFloorVisible;
    this.resident.root.visible = this.mode !== "world" && this.view !== "first" && (!this.house || this.visibleFloor === "all" || this.visibleFloor === simulation.floorId);
    this.camera.up.set(0, 1, 0);
    if (this.mode !== "world" && this.view === "first") {
      const eyeHeight = this.animatedResident?.metadata.height ?? 1.6;
      this.camera.position.set(simulation.position.x,
        simulation.elevation + eyeHeight * 0.9,
        simulation.position.z);
      this.controls.target.copy(this.camera.position).add(new THREE.Vector3(
        Math.sin(simulation.heading), -0.08, Math.cos(simulation.heading),
      ));
      if (this.animatedResident && "robot" in this.animatedResident) {
        const robot = this.animatedResident.robot;
        robot.getEyePosition(this.camera.position);
        const orientation = robot.root.getWorldQuaternion(new THREE.Quaternion());
        this.camera.up.set(0, 1, 0).applyQuaternion(orientation);
        this.controls.target.copy(this.camera.position).add(new THREE.Vector3(0, 0, 1).applyQuaternion(orientation));
      }
      this.camera.lookAt(this.controls.target);
    }
    if (this.mode !== "world" && this.view === "follow") {
      const target = new THREE.Vector3(
        simulation.position.x,
        simulation.elevation + 1.1,
        simulation.position.z,
      );
      const desiredCamera = target.clone().add(new THREE.Vector3(
        -Math.sin(simulation.heading) * 1.8, 0.55, -Math.cos(simulation.heading) * 1.8,
      ));
      if (this.mode === "world-simulation" && this.world) {
        const direction = desiredCamera.clone().sub(target);
        const ray = new THREE.Raycaster(target, direction.clone().normalize(), 0, direction.length());
        const hits = this.house
          ? [...this.houseWorlds.values()].filter(entry => entry.world.splats.visible).flatMap(entry => entry.world.raycast(ray))
          : this.world.raycast(ray);
        if (this.house) hits.push(...ray.intersectObject(this.stairs, true).filter(hit => hit.object.visible));
        const hit = hits.sort((a, b) => a.distance - b.distance)[0];
        if (hit) desiredCamera.copy(target).addScaledVector(direction.normalize(), Math.max(0.15, hit.distance - 0.15));
      }
      this.camera.position.lerp(desiredCamera, 0.08);
      this.controls.target.lerp(target, 0.08);
    }
    if (this.view === "map") {
      this.topControls.update();
      this.renderer.autoClear = true;
      this.renderer.render(this.topScene, this.topCamera);
    } else if (this.mode === "fixture") {
      if (this.view !== "first") this.controls.update();
      this.renderer.autoClear = true;
      this.renderer.render(this.scene, this.camera);
    } else if (this.world) {
      if (this.view !== "first") this.controls.update();
      // The collider only writes depth after splat color is complete, so it cannot cut holes in the backdrop.
      this.renderer.autoClear = true;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.render(this.worldScene, this.camera);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      if (!this.house) { this.world.depth.visible = this.worldDepth; this.world.wire.visible = this.debugVisible; }
      this.renderer.render(this.floorRepairs, this.camera);
      this.renderer.render(this.overlayScene, this.camera);
      this.renderer.autoClear = true;
    }
  }
  dispose() {
    disposeMeshes(this.floorRepairs, true);
    this.floorRepairs.clear();
    disposeMeshes(this.roomObjects, true);
    this.roomObjects.clear();
    this.hazards.dispose();
    this.loadRevision++;
    this.residentRevision++;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.topControls.dispose();
    disposeMeshes(this.topScene);
    this.clearHouse();
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
