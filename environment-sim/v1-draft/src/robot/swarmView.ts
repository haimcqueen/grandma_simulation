import * as THREE from 'three'
import { Swarm } from './swarm'
import type { Scenario } from '../environment'

const MAX_AGENTS = 500
const MAX_MARKS = 900

/** Readable humanoid silhouette in one geometry — cheap enough to instance. */
function silhouette(): THREE.BufferGeometry {
  const body = new THREE.CapsuleGeometry(0.15, 0.52, 4, 10)
  body.translate(0, 0.46, 0)
  const head = new THREE.SphereGeometry(0.115, 10, 8)
  head.translate(0, 0.92, 0)
  // merged by hand rather than pulling in BufferGeometryUtils
  const geo = new THREE.BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  for (const g of [body, head]) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal')
    const idx = g.getIndex()
    const push = (i: number) => {
      positions.push(p.getX(i), p.getY(i), p.getZ(i))
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    if (idx) for (let i = 0; i < idx.count; i++) push(idx.getX(i))
    else for (let i = 0; i < p.count; i++) push(i)
    g.dispose()
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return geo
}

export class SwarmView {
  group = new THREE.Group()
  swarm: Swarm
  private bodies: THREE.InstancedMesh
  private marks: THREE.InstancedMesh
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3(1, 1, 1)
  private c = new THREE.Color()

  constructor(count = 100) {
    this.swarm = new Swarm(count)

    this.bodies = new THREE.InstancedMesh(
      silhouette(),
      new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.72 }),
      MAX_AGENTS,
    )
    this.bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.bodies.frustumCulled = false
    this.bodies.count = count
    this.group.add(this.bodies)

    const disc = new THREE.CircleGeometry(0.34, 14)
    disc.rotateX(-Math.PI / 2)
    this.marks = new THREE.InstancedMesh(
      disc,
      new THREE.MeshBasicMaterial({
        color: 0xff3b30, transparent: true, opacity: 0.13,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      MAX_MARKS,
    )
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.marks.frustumCulled = false
    this.marks.count = 0
    this.group.add(this.marks)

    this.group.visible = false
  }

  get visible() { return this.group.visible }
  setVisible(on: boolean) { this.group.visible = on }
  setScenario(scenario: Scenario) { this.swarm.setScenario(scenario) }

  setCount(count: number) {
    const next = Math.max(1, Math.min(MAX_AGENTS, count))
    const swarm = this.swarm
    while (swarm.agents.length < next) swarm.agents.push(swarm.agents[0])
    swarm.agents.length = next
    swarm.count = next
    swarm.reset()
    this.bodies.count = next
  }

  reset() { this.swarm.reset(); this.marks.count = 0 }

  update(dt: number) {
    if (!this.group.visible) return
    this.swarm.step(dt)

    const agents = this.swarm.agents
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      let tilt = 0, sink = 0, fade = 1

      if (a.fallT > 0) {
        // 0 -> 1 across the topple, then lie still, then fade out
        const t = 1 - a.fallT / 2.4
        tilt = Math.min(1, t / 0.28) * (Math.PI / 2)
        sink = Math.min(1, t / 0.28) * 0.06
        fade = t > 0.78 ? Math.max(0, 1 - (t - 0.78) / 0.22) : 1
      }

      this.e.set(tilt, a.heading, 0)
      this.q.setFromEuler(this.e)
      this.v.set(a.x, -sink, a.z)
      this.m.compose(this.v, this.q, this.s)
      this.bodies.setMatrixAt(i, this.m)

      // steady blue when composed, red as the margin runs down
      const danger = 1 - a.balance
      this.c.setHSL(
        0.55 - danger * 0.55,
        0.55 + danger * 0.35,
        (0.52 - danger * 0.14) * fade,
      )
      this.bodies.setColorAt(i, this.c)
    }
    this.bodies.instanceMatrix.needsUpdate = true
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true

    const falls = this.swarm.falls
    const n = Math.min(falls.length, MAX_MARKS)
    for (let i = 0; i < n; i++) {
      const f = falls[falls.length - n + i]
      const grow = Math.min(1, f.age / 0.5)
      this.s.setScalar(0.5 + grow * 0.5)
      this.v.set(f.x, 0.02, f.z)
      this.m.compose(this.v, new THREE.Quaternion(), this.s)
      this.marks.setMatrixAt(i, this.m)
    }
    this.s.setScalar(1)
    this.marks.count = n
    this.marks.instanceMatrix.needsUpdate = true
  }
}
