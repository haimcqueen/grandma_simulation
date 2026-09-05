import { pose } from './gait'
import type { Stance } from './stance'
import type { MotionProfile } from './motion'

export const FALL_DURATION = 1.6
export const BALCONY = { x: 14, z: 8, width: 3.4, depth: 3, height: 2.8 }
export const BALCONY_APPROACH = 1.8
export const BALCONY_AIR_TIME = Math.sqrt(2 * BALCONY.height / 9.81)
export const BALCONY_DURATION = BALCONY_APPROACH + BALCONY_AIR_TIME + 1.5
export type FallKind = 'patio' | 'balcony'

export function balconyFrame(elapsed: number) {
  const approach = Math.min(1, Math.max(0, elapsed / BALCONY_APPROACH))
  const airborne = Math.max(0, Math.min(BALCONY_AIR_TIME, elapsed - BALCONY_APPROACH))
  const landing = Math.max(0, elapsed - BALCONY_APPROACH - BALCONY_AIR_TIME)
  return {
    x: BALCONY.x,
    z: BALCONY.z + 0.1 + approach * 1.8 + airborne * 1.3,
    elevation: Math.max(0, BALCONY.height - 0.5 * 9.81 * airborne * airborne),
    poseProgress: Math.min(1, airborne / BALCONY_AIR_TIME),
    injuryProgress: Math.min(1, landing / 1.2),
    stage: elapsed < BALCONY_APPROACH ? 'Approaching the edge'
      : landing === 0 ? 'Falling from the balcony'
      : landing < 0.25 ? 'Impact' : 'Injured on the ground',
  }
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
  return {
    pitch: 0.14 * brace * (1 - collapse) + Math.PI / 2 * collapse - curl * 0.18,
    roll: -0.10 * collapse - curl * 0.95,
  }
}
