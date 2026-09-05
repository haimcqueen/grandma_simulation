import { groundFallFrame, GROUND_FALL_DURATIONS, type FallKind } from './fall-motion'
export { poseFall, fallOrientation, type FallKind } from './fall-motion'
import { FLOOR_RISE, STAIR_ROUTE } from '../stairs'

export const FALL_DURATION = GROUND_FALL_DURATIONS.patio
export const BALCONY = { x: 14, z: 8, width: 3.4, depth: 3, height: 2.8 }
export const BALCONY_APPROACH = 1.8
export const BALCONY_AIR_TIME = Math.sqrt(2 * BALCONY.height / 9.81)
export const BALCONY_DURATION = BALCONY_APPROACH + BALCONY_AIR_TIME + 1.5
export const FALL_SCENARIOS: { id: FallKind; label: string; description: string; duration: number }[] = [
  { id: 'balcony', label: 'Fall from balcony', description: 'Approach the edge, drop, brace, and land on the side.', duration: BALCONY_DURATION },
  { id: 'patio', label: 'Slip backward on patio', description: 'Feet slide forward; the body falls backward with arms reaching out.', duration: FALL_DURATION },
  { id: 'trip', label: 'Trip over rug edge', description: 'A foot catches; the body pitches forward and the hands brace.', duration: GROUND_FALL_DURATIONS.trip },
  { id: 'sideways', label: 'Lose balance sideways', description: 'A lateral sway becomes a fall onto the hip and shoulder.', duration: GROUND_FALL_DURATIONS.sideways },
  { id: 'stairs', label: 'Miss a stair and tumble', description: 'Miss a tread on the lower flight, tumble down, and come to rest at the foot.', duration: 3.2 },
]
export const fallDuration = (kind: FallKind) => FALL_SCENARIOS.find(s => s.id === kind)!.duration

/** Deterministic authored tracks; outputs are relative to the scenario's start. */
export function situationFrame(kind: Exclude<FallKind, 'balcony'>, elapsed: number) {
  if (kind !== 'stairs') return groundFallFrame(kind, elapsed)
  const progress = Math.min(1, Math.max(0, elapsed / fallDuration(kind)))
  const motion = smooth((progress - 0.15) / 0.75)
  return {
    progress,
    injuryProgress: Math.min(1, Math.max(0, (elapsed - fallDuration(kind)) / 1.2)),
    forward: 2.25 * motion,
    lateral: 0,
    elevation: FLOOR_RISE / 2 * Math.max(0, 1 - 2.25 * motion / Math.abs(STAIR_ROUTE[2].x - STAIR_ROUTE[1].x)),
    stage: progress < 0.2 ? 'Missing a tread' : progress < 0.8 ? 'Tumbling down the steps'
      : progress < 1 ? 'Impact and settling' : 'Resting after the fall',
  }
}

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
