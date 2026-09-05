import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FACTORY, liveryById, materialFor, type Livery } from './livery'

interface JointMeta { axis: [number, number, number]; lower: number; upper: number }

/**
 * The G1, baked to a single GLB with its joint hierarchy intact.
 * No urdf-loader, no runtime STL fetching, Y-up already applied at bake time —
 * the three things that kept failing.
 */
export class Robot {
  root = new THREE.Group()
  private nodes = new Map<string, THREE.Object3D>()
  private meta: Record<string, JointMeta> = {}
  private rest = new Map<string, THREE.Quaternion>()
  meshCount = 0
  private meshes: THREE.Mesh[] = []
  private livery: Livery = FACTORY
  /** Distance from the model origin down to the soles — measured, not guessed. */
  floorOffset = 0
  height = 0

  async load(glb = '/g1/g1.glb', meta = '/g1/g1.joints.json') {
    const [gltf, m] = await Promise.all([
      new GLTFLoader().loadAsync(glb),
      fetch(meta).then(r => r.json()) as Promise<Record<string, JointMeta>>,
    ])
    this.meta = m
    gltf.scene.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) { this.meshes.push(mesh); this.meshCount++ }
      if (o.name) this.nodes.set(o.name, o)
    })
    this.setSkin(this.livery)

    for (const name of Object.keys(m)) {
      const n = this.nodes.get(name)
      if (n) this.rest.set(name, n.quaternion.clone())
    }
    const bb = new THREE.Box3().setFromObject(gltf.scene)
    this.floorOffset = -bb.min.y
    this.height = bb.max.y - bb.min.y

    this.root.add(gltf.scene)
    return this
  }

  /** Rotate a joint about its URDF axis, relative to the baked rest pose. */
  set(name: string, angle: number) {
    const n = this.nodes.get(name), jm = this.meta[name], r = this.rest.get(name)
    if (!n || !jm || !r) return
    const a = THREE.MathUtils.clamp(angle, jm.lower, jm.upper)
    const axis = new THREE.Vector3(...jm.axis).normalize()
    n.quaternion.copy(r).multiply(new THREE.Quaternion().setFromAxisAngle(axis, a))
  }

  /** Swap appearance without reloading geometry. */
  setSkin(livery: Livery | string) {
    this.livery = typeof livery === 'string' ? liveryById(livery) : livery
    for (const mesh of this.meshes) {
      const link = (mesh.name || mesh.parent?.name || '')
      mesh.material = materialFor(this.livery, link)
      mesh.castShadow = !this.livery.wireframe
      mesh.receiveShadow = !this.livery.wireframe
    }
    return this
  }
  get skin() { return this.livery.id }

  private _box = new THREE.Box3()
  private eyeBounds = new THREE.Box3()

  getEyePosition(target: THREE.Vector3) {
    this.root.updateMatrixWorld(true)
    const head = this.nodes.get('head_link_visual')
    if (head) {
      this.eyeBounds.setFromObject(head).getCenter(target)
      return target
    }
    return this.root.localToWorld(target.set(0, this.height * 0.88 - this.floorOffset, 0.18))
  }

  /**
   * Place the model so its lowest point rests on y = 0, measured AFTER posing.
   * Rest-pose bounds are not enough: flexing the knees lifts the soles toward
   * the pelvis, and a crawling quadruped is carried by its hands. Measuring
   * each frame is exact for any body, stance and gait, with no fudge factor.
   */
  settleOnGround(lift = 0) {
    this.root.position.y = 0
    this.root.updateMatrixWorld(true)
    this._box.setFromObject(this.root)
    if (!isFinite(this._box.min.y)) return
    this.root.position.y = -this._box.min.y + lift
  }

  /** Rotate any node, including fixed joints the URDF does not actuate. */
  setNode(name: string, axis: [number, number, number], angle: number) {
    const n = this.nodes.get(name)
    if (!n) return
    if (!this.rest.has(name)) this.rest.set(name, n.quaternion.clone())
    const r = this.rest.get(name)!
    n.quaternion.copy(r).multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle))
  }

  get jointNames() { return Object.keys(this.meta) }
  has(name: string) { return this.nodes.has(name) }
}
