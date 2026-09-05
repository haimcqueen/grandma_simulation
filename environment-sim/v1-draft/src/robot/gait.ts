import type { Stance } from './stance'
import { ADULT_MOTION, stepCycle, type MotionProfile } from './motion'

interface Poseable {
  set(joint: string, angle: number): void
  setNode?(name: string, axis: [number, number, number], angle: number): void
}

const noise = (t: number, k: number) => Math.sin(t * k) * Math.sin(t * k * 1.7 + 1.3)

/**
 * Gait = stance (static posture) + step cycle + instability wobble.
 * `phase` advances with travel; stance and swing have separate timing.
 */
export function pose(r: Poseable, s: Stance, phase: number, t: number, stability = 1,
  motion: MotionProfile = ADULT_MOTION, blend = 1) {
  const st = Math.max(0, Math.min(1, stability))
  const decay = 1 - st
  const wob = 0.25 + decay * 1.8
  const activity = Math.max(0, Math.min(1, blend))
  const amp = 0.32 * s.stepScale * (0.5 + 0.5 * st) * activity

  // ── spine: the hunch ──────────────────────────────────────────────────────
  r.set('waist_pitch_joint', s.waistPitch + noise(t, 1.3) * 0.02 * wob)
  r.set('waist_roll_joint',  s.waistRoll  + noise(t, 1.7) * 0.03 * wob)
  r.set('waist_yaw_joint',   noise(t, 1.9) * 0.06 * wob)

  for (const side of ['left', 'right'] as const) {
    const dir = side === 'left' ? 1 : -1
    const { swing, lift } = stepCycle(phase + (side === 'right' ? 0.5 : 0), motion.stanceRatio)
    const hipSwing = -swing * amp
    const kneeLift = lift * motion.kneeLift * activity

    // legs — flexed baseline, so the knees never lock
    r.set(`${side}_hip_pitch_joint`, hipSwing - s.hipFlex)
    r.set(`${side}_knee_joint`, s.kneeFlex + kneeLift)
    r.set(`${side}_ankle_pitch_joint`, s.ankleComp - hipSwing - kneeLift)
    r.set(`${side}_hip_roll_joint`, dir * (0.02 + noise(t, 3.1) * 0.05 * wob))
    r.set(`${side}_ankle_roll_joint`, noise(t, 4.3) * 0.035 * wob)

    // arms — rounded forward, carried bent, barely swinging
    r.set(`${side}_shoulder_pitch_joint`, s.shoulderProtract + swing * amp * motion.armSwing
      + noise(t, 2.2) * 0.10 * wob)
    r.set(`${side}_shoulder_roll_joint`, dir * (s.shoulderAbduct + decay * 0.45))
    r.set(`${side}_elbow_joint`, s.elbowFlex - decay * 0.35)
  }

  // forward head carriage — a fixed joint on the G1, so drive the node directly
  r.setNode?.('head_joint', [0, 1, 0], s.headForward)

  return {
    bob: Math.abs(Math.sin(phase * Math.PI * 2)) * 0.008 * s.bobScale * activity,
    sway: noise(t, 2.6) * 0.03 * wob,
  }
}
