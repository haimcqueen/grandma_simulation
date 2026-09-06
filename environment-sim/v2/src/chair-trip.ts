import { poseFall } from "../../v1-draft/src/robot/fall-motion";

export const CHAIR_TRIP_DURATION = 3.6;
export type ChairTrip = { retreat: number; lateral: number };
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * t * (t * (t * 6 - 15) + 10); };

export function chairTripFrame(elapsed: number, trip: ChairTrip) {
  const progress = Math.max(0, Math.min(1, elapsed / CHAIR_TRIP_DURATION));
  return { progress, forward: -trip.retreat * smooth((progress - 0.32) / 0.53),
    lateral: trip.lateral * smooth((progress - 0.48) / 0.4),
    stage: progress < 0.13 ? "Foot catches the chair leg"
      : progress < 0.35 ? "Reaching for the chair"
      : progress < 0.5 ? "Trying to regain balance"
      : progress < 0.75 ? "Losing balance · Bracing for impact"
      : progress < 0.91 ? "Landing on the side" : "Settling after the fall" };
}

/** Asymmetric reach, a failed recovery step, then a braced side landing.
 * Ends at the shared sideways pose so any host can use the existing get-up track.
 */
export function poseChairTrip(...args: Parameters<typeof poseFall>) {
  const [robot, stance, phase, time, motion, , progress] = args;
  const standing = new Map<string, number>();
  poseFall({ set: (name, value) => standing.set(name, value) }, stance, phase, time, motion, 0, 0, 0, "sideways");
  const lying = new Map<string, number>();
  const end = poseFall({ set: (name, value) => lying.set(name, value) }, stance, phase, time, motion, 0, 1, 0, "sideways");
  const key = (at: number, pitch: number, roll: number, joints: Record<string, number>) => ({ at, pitch, roll, joints: new Map([...standing, ...Object.entries(joints)]) });
  const reach = {
    waist_pitch_joint: 0.3, waist_roll_joint: 0.06,
    left_shoulder_pitch_joint: -1.5, right_shoulder_pitch_joint: -0.8,
    left_shoulder_roll_joint: 0.18, right_shoulder_roll_joint: -0.5,
    left_elbow_joint: 0.38, right_elbow_joint: 0.9,
    left_hip_pitch_joint: -0.55, right_hip_pitch_joint: -0.2,
    left_knee_joint: 1.15, right_knee_joint: 0.65,
    left_ankle_pitch_joint: -0.4, right_ankle_pitch_joint: -0.3,
  };
  const frames = [
    { at: 0, pitch: 0, roll: 0, joints: standing },
    key(0.13, 0.18, 0.06, { ...reach, left_shoulder_pitch_joint: -0.75, left_knee_joint: 0.95 }),
    key(0.32, 0.3, 0.1, reach),
    key(0.47, 0.12, -0.06, { ...reach, waist_pitch_joint: 0.18, left_knee_joint: 1.4, right_knee_joint: 0.85,
      right_shoulder_pitch_joint: -1.05, right_shoulder_roll_joint: -0.85 }),
    key(0.64, 0.24, -0.65, { ...reach, left_shoulder_roll_joint: 0.9, right_shoulder_pitch_joint: -0.4,
      left_hip_pitch_joint: -0.65, right_hip_pitch_joint: -0.6, left_knee_joint: 1.5, right_knee_joint: 1.25 }),
    { at: 0.86, ...end, joints: lying },
    { at: 0.92, pitch: end.pitch + 0.025, roll: end.roll + 0.045, joints: lying },
    { at: 1, ...end, joints: lying },
  ];
  const p = Math.max(0, Math.min(1, progress));
  const i = frames.findIndex((frame, index) => index > 0 && p <= frame.at);
  const a = frames[i - 1], b = frames[i];
  const blend = smooth((p - a.at) / (b.at - a.at));
  for (const [name, angle] of a.joints) robot.set(name, angle + (b.joints.get(name)! - angle) * blend);
  return { pitch: a.pitch + (b.pitch - a.pitch) * blend, roll: a.roll + (b.roll - a.roll) * blend };
}
