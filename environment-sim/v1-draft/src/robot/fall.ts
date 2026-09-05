import { pose } from './gait'
import type { Stance } from './stance'
import type { MotionProfile } from './motion'

export const FALL_DURATION = 1.6

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
  return {
    pitch: 0.14 * brace * (1 - collapse) + Math.PI / 2 * collapse,
    roll: -0.10 * collapse,
  }
}
