/**
 * Postural offsets applied on top of the gait — the difference between a robot
 * walking and a person walking. Every value is a scenario choice, not a
 * measured anthropometric; they are shaped after the described features of
 * age-related posture (thoracic kyphosis, hip/knee flexion contracture,
 * protracted shoulders, forward head), not fitted to any dataset.
 */
export interface Stance {
  id: string
  label: string
  waistPitch: number      // thoracic kyphosis — forward spine flexion (rad)
  waistRoll: number       // lateral lean, often asymmetric with age
  hipFlex: number         // standing hip flexion — cannot fully extend
  kneeFlex: number        // standing knee flexion — knees never lock
  ankleComp: number       // ankle compensates to keep the sole flat
  shoulderProtract: number// rounded / forward shoulders
  shoulderAbduct: number  // arms held wider for balance
  elbowFlex: number       // arms carried bent
  headForward: number     // forward head carriage (applied to the neck node)
  stepScale: number       // stride length multiplier
  cadenceScale: number    // step frequency multiplier
  bobScale: number        // vertical travel per step
}

export const UPRIGHT: Stance = {
  id: 'upright', label: 'Nominal',
  waistPitch: 0, waistRoll: 0, hipFlex: 0, kneeFlex: 0.10, ankleComp: 0,
  shoulderProtract: 0, shoulderAbduct: 0.16, elbowFlex: -0.25, headForward: 0,
  stepScale: 1, cadenceScale: 1, bobScale: 1,
}

/** Stooped, flexed, short-stepped. */
export const STOOPED: Stance = {
  id: 'stooped', label: 'Stooped',
  waistPitch: 0.42,          // ~24° forward — pronounced but still ambulatory
  waistRoll: 0.04,
  hipFlex: 0.20,
  kneeFlex: 0.26,
  ankleComp: -0.16,
  shoulderProtract: 0.34,
  shoulderAbduct: 0.26,
  elbowFlex: -0.62,
  headForward: 0.30,
  stepScale: 0.62,           // short shuffling steps
  cadenceScale: 0.88,
  bobScale: 0.45,            // feet stay low to the floor
}

/** Small, wide, high-cadence. */
export const TODDLING: Stance = {
  id: 'toddling', label: 'Toddling',
  waistPitch: 0.10, waistRoll: 0.10, hipFlex: 0.14, kneeFlex: 0.22, ankleComp: -0.06,
  shoulderProtract: -0.20, shoulderAbduct: 0.72, elbowFlex: -0.90, headForward: 0.08,
  stepScale: 0.55, cadenceScale: 1.7, bobScale: 0.8,
}

export const STANCES = [UPRIGHT, STOOPED, TODDLING]

/** Blend between stances so you can dial severity live. */
export function lerpStance(a: Stance, b: Stance, t: number): Stance {
  const k = Math.max(0, Math.min(1, t))
  const m = (x: number, y: number) => x + (y - x) * k
  return {
    id: `${a.id}->${b.id}`, label: `${Math.round(k * 100)}% ${b.label}`,
    waistPitch: m(a.waistPitch, b.waistPitch), waistRoll: m(a.waistRoll, b.waistRoll),
    hipFlex: m(a.hipFlex, b.hipFlex), kneeFlex: m(a.kneeFlex, b.kneeFlex),
    ankleComp: m(a.ankleComp, b.ankleComp),
    shoulderProtract: m(a.shoulderProtract, b.shoulderProtract),
    shoulderAbduct: m(a.shoulderAbduct, b.shoulderAbduct),
    elbowFlex: m(a.elbowFlex, b.elbowFlex), headForward: m(a.headForward, b.headForward),
    stepScale: m(a.stepScale, b.stepScale), cadenceScale: m(a.cadenceScale, b.cadenceScale),
    bobScale: m(a.bobScale, b.bobScale),
  }
}
