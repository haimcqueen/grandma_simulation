import * as THREE from 'three'
import {
  isWalkable, objects, scenarioObjects, floors,
  type HouseObject, type Scenario,
} from '../environment'

/**
 * Many-agent mode. One hero robot is rendered as a full GLB elsewhere; these
 * are instanced silhouettes, which is the only way 500 bodies hold 60 fps.
 *
 * Falls are NOT a prediction. An agent's balance margin drains where the local
 * clearance is tight — geometry, measured by probing isWalkable at increasing
 * radii. Tight passages therefore accumulate falls. That is a demonstration
 * device for showing where a house pinches, not a model of human balance.
 */

export interface SwarmAgent {
  x: number; z: number
  heading: number
  speed: number
  balance: number
  /** metres of free space measured around the agent, refreshed periodically */
  clearance: number
  /** >0 while toppling or lying down */
  fallT: number
  fallen: boolean
  hue: number
  probeIn: number
  turnIn: number
}

export interface FallMark { x: number; z: number; age: number }

const TAU = Math.PI * 2
const CLEAR_PROBES = [0.30, 0.45, 0.62, 0.85]

export class Swarm {
  agents: SwarmAgent[] = []
  falls: FallMark[] = []
  totalFalls = 0
  scenario: Scenario = 'clear'
  private obstacles: HouseObject[] = objects

  constructor(public count: number, private rand = Math.random) {
    for (let i = 0; i < count; i++) this.agents.push(this.spawnAgent())
  }

  setScenario(scenario: Scenario) {
    this.scenario = scenario
    this.obstacles = [...objects, ...scenarioObjects(scenario)]
  }

  /** Random point on any floor region that is actually walkable. */
  private findFreeSpot(): { x: number; z: number } {
    for (let tries = 0; tries < 40; tries++) {
      const f = floors[Math.floor(this.rand() * floors.length)]
      const p = {
        x: f.x + (this.rand() - 0.5) * f.width,
        z: f.z + (this.rand() - 0.5) * f.depth,
      }
      if (isWalkable(p, this.obstacles)) return p
    }
    return { x: floors[0].x, z: floors[0].z }
  }

  private spawnAgent(): SwarmAgent {
    const p = this.findFreeSpot()
    return {
      x: p.x, z: p.z,
      heading: this.rand() * TAU,
      speed: 0.6 + this.rand() * 1.1,
      balance: 1,
      clearance: 0.85,
      fallT: 0, fallen: false,
      hue: this.rand(),
      probeIn: this.rand() * 0.8,
      turnIn: this.rand() * 1.5,
    }
  }

  /** How much open space is around a point, in metres, coarsely. */
  private measureClearance(x: number, z: number): number {
    let best = CLEAR_PROBES[0]
    for (const r of CLEAR_PROBES) {
      let open = true
      for (let a = 0; a < 8 && open; a++) {
        const th = (a / 8) * TAU
        if (!isWalkable({ x: x + Math.cos(th) * r, z: z + Math.sin(th) * r }, this.obstacles))
          open = false
      }
      if (!open) break
      best = r
    }
    return best
  }

  step(dt: number) {
    for (const a of this.agents) {
      if (a.fallT > 0) {
        a.fallT -= dt
        if (a.fallT <= 0) Object.assign(a, this.spawnAgent())
        continue
      }

      // steering: wander, and turn away from what we cannot walk into
      a.turnIn -= dt
      if (a.turnIn <= 0) {
        a.heading += (this.rand() - 0.5) * 1.2
        a.turnIn = 0.6 + this.rand() * 1.8
      }

      const travel = a.speed * dt
      const nx = a.x + Math.sin(a.heading) * travel
      const nz = a.z + Math.cos(a.heading) * travel
      if (isWalkable({ x: nx, z: nz }, this.obstacles)) {
        a.x = nx; a.z = nz
      } else {
        a.heading += 1.6 + this.rand() * 1.4     // bounce off
        a.turnIn = 0.4
      }

      // clearance probe is the expensive part, so stagger it across agents
      a.probeIn -= dt
      if (a.probeIn <= 0) {
        a.clearance = this.measureClearance(a.x, a.z)
        a.probeIn = 0.5 + this.rand() * 0.7
      }

      // tight space drains the margin; open floor restores it
      const tight = Math.max(0, 0.85 - a.clearance) / 0.85     // 0 open .. 1 pinched
      a.balance += (tight > 0.25 ? -tight * 0.85 : 0.35) * dt
      a.balance = Math.min(1, a.balance)

      if (a.balance <= 0) {
        a.balance = 1
        a.fallT = 2.4
        a.fallen = true
        this.totalFalls++
        this.falls.push({ x: a.x, z: a.z, age: 0 })
        if (this.falls.length > 900) this.falls.shift()
      }
    }

    for (const f of this.falls) f.age += dt
  }

  reset() {
    this.falls = []
    this.totalFalls = 0
    this.agents = this.agents.map(() => this.spawnAgent())
  }
}
