export interface MotionProfile {
  acceleration: number
  deceleration: number
  turnRate: number
  strideLength: number
  stanceRatio: number
  kneeLift: number
  armSwing: number
}

export const CAUTIOUS: MotionProfile = {
  acceleration: 0.8, deceleration: 1.2, turnRate: 1.2,
  strideLength: 0.9, stanceRatio: 0.68, kneeLift: 0.18, armSwing: 0.22,
}

export const ADULT_MOTION: MotionProfile = {
  acceleration: 1.6, deceleration: 2.0, turnRate: 2.4,
  strideLength: 1.4, stanceRatio: 0.60, kneeLift: 0.40, armSwing: 0.65,
}

export const TODDLER_MOTION: MotionProfile = {
  acceleration: 0.9, deceleration: 1.3, turnRate: 1.8,
  strideLength: 0.48, stanceRatio: 0.66, kneeLift: 0.30, armSwing: 0.12,
}

export const CRAWLING_MOTION: MotionProfile = {
  acceleration: 0.45, deceleration: 0.8, turnRate: 1.3,
  strideLength: 0.36, stanceRatio: 0.78, kneeLift: 0, armSwing: 0,
}

export const DOG_MOTION: MotionProfile = {
  acceleration: 2.2, deceleration: 2.8, turnRate: 3.0,
  strideLength: 0.85, stanceRatio: 0.5, kneeLift: 0, armSwing: 0,
}

export const approach = (value: number, target: number, change: number) =>
  value + Math.max(-change, Math.min(change, target - value))

export const angleDifference = (target: number, current: number) =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current))

export function stepCycle(phase: number, stanceRatio: number) {
  const local = ((phase % 1) + 1) % 1
  if (local < stanceRatio) return { swing: 1 - 2 * local / stanceRatio, lift: 0 }
  const progress = (local - stanceRatio) / (1 - stanceRatio)
  const eased = progress * progress * (3 - 2 * progress)
  return { swing: -1 + 2 * eased, lift: Math.sin(progress * Math.PI) ** 2 }
}
