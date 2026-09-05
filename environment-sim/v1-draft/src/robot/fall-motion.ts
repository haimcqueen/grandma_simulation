import { pose } from './gait'
import type { Stance } from './stance'
import type { MotionProfile } from './motion'

/** Authored joint poses and relative motion only; no house coordinates or renderer. */
export type FallKind = 'patio' | 'balcony' | 'trip' | 'sideways' | 'stairs'
export type GroundFallKind = 'patio' | 'trip' | 'sideways'
export const GROUND_FALL_DURATIONS = { patio: 1.6, trip: 1.9, sideways: 2.2 } as const

export function groundFallFrame(kind: GroundFallKind, elapsed: number) {
  const duration = GROUND_FALL_DURATIONS[kind]
  const progress = Math.min(1, Math.max(0, elapsed / duration))
  const motion = smooth((progress - 0.15) / 0.75)
  return {
    progress,
    injuryProgress: Math.min(1, Math.max(0, (elapsed - duration) / 1.2)),
    forward: kind === 'patio' ? -0.5 * motion : kind === 'trip' ? 0.65 * motion : 0,
    lateral: kind === 'sideways' ? 0.48 * motion : 0,
    elevation: 0,
    stage: progress < 0.2 ? (kind === 'trip' ? 'Foot catches the rug' : kind === 'patio' ? 'Feet slipping forward' : 'Losing balance')
      : progress < 0.8 ? (kind === 'patio' ? 'Falling backward' : kind === 'sideways' ? 'Falling onto the side' : 'Bracing with the hands')
      : progress < 1 ? 'Impact and settling' : 'Resting after the fall',
  }
}

export function fallOrientation(kind: FallKind, progress: number, injuryProgress = 0) {
  const collapse = smooth((progress - 0.2) / 0.7)
  const brace = smooth(progress / 0.4)
  const curl = smooth(injuryProgress)
  if (kind === 'patio') return { pitch: -Math.PI / 2 * collapse + curl * 0.12, roll: 0.12 * collapse }
  if (kind === 'sideways') return { pitch: 0.16 * collapse, roll: -Math.PI / 2 * collapse + curl * 0.12 }
  if (kind === 'stairs') return { pitch: (Math.PI * 2 + Math.PI / 2) * collapse - curl * 0.18, roll: Math.sin(collapse * Math.PI) * 0.35 - curl * 0.5 }
  return { pitch: 0.14 * brace * (1 - collapse) + Math.PI / 2 * collapse - curl * 0.18, roll: -0.1 * collapse - curl * 0.95 }
}

const smooth = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function poseFall(
  robot: { set(name: string, angle: number): void },
  stance: Stance,
  phase: number,
  time: number,
  motion: MotionProfile,
  gaitBlend: number,
  progress: number,
  injuryProgress = 0,
  kind: FallKind = 'trip',
) {
  const initial = new Map<string, number>()
  pose({ set: (name, angle) => initial.set(name, angle) }, stance, phase, time, 1, motion, gaitBlend)
  const brace = smooth(progress / 0.4)
  const collapse = smooth((progress - 0.2) / 0.7)
  const targets = new Map<string, number>([
    ['waist_pitch_joint', 0.12 + Math.sin(collapse * Math.PI) * 0.35],
    ['waist_roll_joint', 0],
    ['waist_yaw_joint', 0],
  ])
  for (const side of ['left', 'right']) {
    const direction = side === 'left' ? 1 : -1
    targets.set(`${side}_hip_pitch_joint`, -0.16)
    targets.set(`${side}_knee_joint`, 0.28 + Math.sin(collapse * Math.PI) * 0.8)
    targets.set(`${side}_ankle_pitch_joint`, -0.12)
    targets.set(`${side}_hip_roll_joint`, direction * 0.06)
    targets.set(`${side}_ankle_roll_joint`, 0)
    targets.set(`${side}_shoulder_pitch_joint`, -1.3)
    targets.set(`${side}_shoulder_roll_joint`, direction * 0.35)
    targets.set(`${side}_elbow_joint`, -0.55)
    if (kind === 'patio') {
      targets.set(`${side}_hip_pitch_joint`, -0.7)
      targets.set(`${side}_knee_joint`, 0.8)
      targets.set(`${side}_shoulder_pitch_joint`, 0.6)
      targets.set(`${side}_shoulder_roll_joint`, direction * 0.8)
    } else if (kind === 'sideways') {
      targets.set(`${side}_hip_roll_joint`, direction * 0.25)
      targets.set(`${side}_shoulder_roll_joint`, direction * (side === 'left' ? 1.2 : 0.35))
      targets.set(`${side}_shoulder_pitch_joint`, -0.25)
    } else if (kind === 'stairs') {
      targets.set(`${side}_hip_pitch_joint`, -0.85)
      targets.set(`${side}_knee_joint`, 1.25)
      targets.set(`${side}_elbow_joint`, -1.35)
      targets.set(`${side}_shoulder_pitch_joint`, -0.6)
    }
  }
  for (const [name, initialAngle] of initial) {
    const target = targets.get(name) ?? initialAngle
    robot.set(name, initialAngle + (target - initialAngle) * brace)
  }
  const curl = smooth(injuryProgress)
  if (curl > 0) {
    for (const side of ['left', 'right']) {
      robot.set(`${side}_hip_pitch_joint`, -0.16 - curl * 0.8)
      robot.set(`${side}_knee_joint`, 0.28 + curl * 1.1)
      robot.set(`${side}_shoulder_pitch_joint`, -1.3 + curl * 0.75)
      robot.set(`${side}_elbow_joint`, -0.55 - curl * 0.8)
    }
    robot.set('waist_pitch_joint', 0.12 + curl * 0.2)
  }
  return fallOrientation(kind, progress, injuryProgress)
}
