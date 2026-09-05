import type {
  CharacterProfile, ConditionSpec, Finding, SimEvent, Vec3,
} from './types'

const d2 = (a: Vec3, b: Vec3) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2

/** Deterministic PRNG so runs are comparable across a reset (brief §3). */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Walker {
  id: string
  profileId: string
  pos: Vec3
  /** 1 = steady, 0 = modelled loss of balance. A scenario variable. */
  balance: number
}

/**
 * Advances hazard exposure for walkers positioned by workstream B.
 * This module does NOT move anyone and does NOT own a render loop —
 * it consumes positions and emits events (brief §3, one time source).
 */
export class ScenarioRunner {
  /** exposed so callers can draw the same reproducible stream */
  random() { return this.rand() }
  events: SimEvent[] = []
  tSim = 0
  private inZone = new Map<string, string>()      // walkerId -> conditionId
  private exposures = new Map<string, number>()
  private exhaustions = new Map<string, number>()
  private traversals = new Map<string, number>()
  /** reserved for stochastic scenario variants; keeps runs reproducible */
  private rand: () => number

  private conditions: ConditionSpec[]
  private profiles: Record<string, CharacterProfile>
  private seed: number

  constructor(conditions: ConditionSpec[], profiles: Record<string, CharacterProfile>, seed = 1) {
    this.conditions = conditions; this.profiles = profiles; this.seed = seed
    this.rand = mulberry(seed)
  }

  private conditionFor(w: Walker): ConditionSpec | null {
    const p = this.profiles[w.profileId]
    if (!p) return null
    let best: ConditionSpec | null = null, bd = Infinity
    for (const c of this.conditions) {
      if (!c.appliesTo.includes(w.profileId)) continue
      const dd = d2(w.pos, c.pos)
      if (dd < c.radius ** 2 && dd < bd) { bd = dd; best = c }
    }
    return best
  }

  /** Called once per fixed simulation step by the owning app loop. */
  advance(dt: number, walkers: Walker[]) {
    this.tSim += dt
    for (const w of walkers) {
      const p = this.profiles[w.profileId]
      if (!p) continue
      const c = this.conditionFor(w)
      const was = this.inZone.get(w.id)

      if (c && was !== c.id) {
        this.inZone.set(w.id, c.id)
        this.exposures.set(c.id, (this.exposures.get(c.id) ?? 0) + 1)
        this.traversals.set(c.id, (this.traversals.get(c.id) ?? 0) + 1)
        this.emit('hazardExposureStarted', w, c.id)
        if (c.height !== undefined && c.height > p.reachM)
          this.emit('reachExceeded', w, c.id)
      } else if (!c && was) {
        this.inZone.delete(w.id)
        this.emit('hazardExposureEnded', w, was)
      }

      if (c) w.balance -= c.balanceDrainPerSec * dt
      else w.balance = Math.min(1, w.balance + p.recoveryPerSec * dt)

      if (w.balance <= 0) {
        w.balance = 1
        const id = c?.id ?? was ?? 'unattributed'
        this.exhaustions.set(id, (this.exhaustions.get(id) ?? 0) + 1)
        this.emit('balanceMarginExhausted', w, id)
      }
    }
  }

  private emit(type: SimEvent['type'], w: Walker, conditionId: string) {
    this.events.push({
      type, tSim: this.tSim, characterId: w.id,
      profileId: w.profileId, conditionId, at: { ...w.pos },
    })
  }

  /** Observations under stated assumptions. Deliberately not a risk score. */
  findings(): Finding[] {
    return this.conditions
      .map(c => {
        const ex = this.exposures.get(c.id) ?? 0
        const ha = this.exhaustions.get(c.id) ?? 0
        const tr = this.traversals.get(c.id) ?? 0
        const who = c.appliesTo.map(id => this.profiles[id]?.label ?? id).join(' and ')
        return {
          conditionId: c.id,
          label: c.label,
          provenance: c.provenance,
          observation: ex === 0
            ? 'Not encountered on the routes simulated — no observation available.'
            : `${ha} of ${ex} modelled traversals by ${who} ended with the balance margin exhausted.`,
          assumptions: [
            `Zone is ${c.provenance.replace('-', ' ')}; not automatically detected from geometry or imagery.`,
            `Balance drain of ${c.balanceDrainPerSec}/s inside a ${c.radius} m radius is a chosen demonstration parameter, not a calibrated rate.`,
            'Balance margin is a scenario device; it is not a biomechanical model and predicts nothing about a real person.',
          ],
          evidence: { exposures: ex, exhaustions: ha, traversals: tr },
          rationale: c.rationale,
        }
      })
      .sort((a, b) => b.evidence.exhaustions - a.evidence.exhaustions)
  }

  /** Restores a clean comparable run (brief §3). */
  reset(seed = this.seed) {
    this.events = []; this.tSim = 0
    this.inZone.clear(); this.exposures.clear()
    this.exhaustions.clear(); this.traversals.clear()
    this.rand = mulberry(seed)
  }
}
