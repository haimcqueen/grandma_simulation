/**
 * Quadruped crawl for the Go2 — the infant subject.
 *
 * A crawling baby is not a trotting dog: the gait is a lateral crawl with
 * three limbs loaded at any moment, low and slow, with the trunk rocking.
 * Diagonal trot is available for comparison but reads as "dog", not "baby".
 *
 * These are demonstration values shaped after the described pattern of infant
 * hands-and-knees crawling. They are not fitted to motion-capture data.
 */

interface Poseable {
  set(joint: string, angle: number): void
}

export interface CrawlStyle {
  id: string
  label: string
  /** phase offsets per leg, in cycles: FL, FR, RL, RR */
  offsets: [number, number, number, number]
  reach: number       // fore/aft limb swing
  lift: number        // how high a limb clears the floor
  /** fraction of the cycle a limb is LOADED. 0.75 keeps three limbs down. */
  duty: number
  crouch: number      // standing height reduction
  sway: number        // lateral trunk rock
}

/** Lateral-sequence crawl: RL → FL → RR → FR. Three limbs down at all times. */
export const BABY_CRAWL: CrawlStyle = {
  id: 'crawl', label: 'Crawling',
  offsets: [0.25, 0.75, 0.0, 0.5],
  reach: 0.42, lift: 0.34, crouch: 0.30, sway: 0.055, duty: 0.78,
}

/** Diagonal pairs — a dog's trot. */
export const TROT: CrawlStyle = {
  id: 'trot', label: 'Trotting',
  offsets: [0, 0.5, 0.5, 0], reach: 0.34, lift: 0.26, crouch: 0.06, sway: 0.02, duty: 0.5,
}

const LEGS = ['FL', 'FR', 'RL', 'RR'] as const

const noise = (t: number, k: number) => Math.sin(t * k) * Math.sin(t * k * 1.7 + 1.3)

/**
 * `phase` advances with distance travelled to synchronize the cycle with travel.
 * Returns trunk offsets for the caller to apply.
 */
export function crawl(r: Poseable, style: CrawlStyle, phase: number, t: number, wobble = 0, blend = 1) {
  const activity = Math.max(0, Math.min(1, blend))
  const wob = 0.2 + wobble
  const TAU = Math.PI * 2

  LEGS.forEach((leg, i) => {
    const front = i < 2
    const left = leg[1] === 'L'
    // local cycle position; a limb is airborne only for (1 - duty) of it
    const local = (((phase + style.offsets[i]) % 1) + 1) % 1
    const air = 1 - style.duty
    const airborne = local < air
    // lift arcs up and back down within the swing window only
    const lift = airborne ? Math.sin((local / air) * Math.PI) : 0
    // fore/aft: swing forward while airborne, drive back while loaded
    const swing = airborne
      ? -1 + 2 * (local / air)
      : 1 - 2 * ((local - air) / style.duty)

    // hips splay outward — a crawling infant is wide-based, not narrow like a dog
    r.set(`${leg}_hip_joint`, (left ? 1 : -1) * (0.12 + style.crouch * 0.25)
      + noise(t, 3.3) * 0.03 * wob)

    // thigh drives the fore/aft reach; front limbs reach further than the rear
    r.set(`${leg}_thigh_joint`,
      0.82 + style.crouch + swing * style.reach * (front ? 1 : 0.78) * activity)

    // calf folds to clear the floor, then extends to take load
    r.set(`${leg}_calf_joint`,
      -1.55 - style.crouch * 0.9 - lift * style.lift * activity)
  })

  return {
    bob: Math.abs(Math.sin(phase * TAU * 2)) * 0.012 * activity,
    roll: Math.sin(phase * TAU) * style.sway * activity,
    drop: style.crouch * 0.16,
  }
}
