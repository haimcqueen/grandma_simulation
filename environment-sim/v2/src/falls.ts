import { GROUND_FALL_DURATIONS, groundFallFrame, poseFall } from "../../v1-draft/src/robot/fall-motion";

/** Room-local demos. No patio, balcony or stair coordinates are imported. */
export const roomFalls = [
  { id: "trip", label: "Trip forward", description: "Lose footing, pitch forward and brace with the hands." },
  { id: "patio", label: "Slip backward", description: "Feet slide forward as the body falls backward." },
  { id: "sideways", label: "Lose balance sideways", description: "Sway sideways and land on the hip and shoulder." },
] as const;
export type RoomFallKind = typeof roomFalls[number]["id"];
export type RoomFall = { kind: RoomFallKind; elapsed: number; autoRecover?: boolean; obstacle?: { travel: number; lateral?: number; solidId?: string } };
export const RECOVERY_REST = 1.1;
export const RECOVERY_DURATION = 3.8;
export const roomFallFrame = (fall: RoomFall) => {
  const frame = groundFallFrame(fall.kind, fall.elapsed);
  if (fall.obstacle && fall.kind === "trip") {
    const movement = frame.forward / 0.65;
    frame.forward = movement * fall.obstacle.travel;
    const stepAside = Math.min(1, frame.progress / 0.4);
    frame.lateral = stepAside * stepAside * (3 - 2 * stepAside) * (fall.obstacle.lateral ?? 0);
    frame.elevation = 0;
    if (frame.progress < 0.3) frame.stage = "Foot catches the ottoman";
  }
  const recovery = fall.autoRecover
    ? Math.max(0, Math.min(1, (fall.elapsed - roomFallDuration(fall.kind) - RECOVERY_REST) / RECOVERY_DURATION)) : 0;
  return { ...frame, recovery, stage: recovery > 0
    ? recovery < 0.35 ? "Bracing to get up" : recovery < 0.7 ? "Pushing up onto one knee" : "Standing and finding balance"
    : frame.stage };
};
export const roomFallTotalDuration = (fall: RoomFall) => roomFallDuration(fall.kind)
  + (fall.autoRecover ? RECOVERY_REST + RECOVERY_DURATION : 0);

/** Grounded recovery: brace, kneel, then extend the legs. No world/renderer dependency. */
export function poseRoomRecovery(...args: Parameters<typeof poseFall>) {
  const [robot, stance, phase, time, motion, , recovery, , kind = "trip"] = args;
  const lying = new Map<string, number>();
  const orientation = poseFall({ set: (name, angle) => lying.set(name, angle) }, stance, phase, time, motion, 0, 1, 0, kind);
  const standing = new Map<string, number>();
  poseFall({ set: (name, angle) => standing.set(name, angle) }, stance, phase, time, motion, 0, 0, 0, kind);
  const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const brace = smooth(recovery / 0.35);
  const kneel = smooth((recovery - 0.35) / 0.35);
  const stand = smooth((recovery - 0.7) / 0.3);
  const supported = new Map<string, number>([["waist_pitch_joint", 0.35]]);
  for (const side of ["left", "right"]) {
    supported.set(`${side}_hip_pitch_joint`, side === "left" ? -1.1 : -0.65);
    supported.set(`${side}_knee_joint`, side === "left" ? 1.55 : 1.8);
    supported.set(`${side}_ankle_pitch_joint`, -0.55);
    supported.set(`${side}_shoulder_pitch_joint`, -0.85);
    supported.set(`${side}_elbow_joint`, -1.0);
  }
  for (const [name, start] of lying) {
    const crouched = start + ((supported.get(name) ?? start) - start) * brace;
    robot.set(name, crouched + ((standing.get(name) ?? 0) - crouched) * stand);
  }
  return { pitch: (orientation.pitch * (1 - kneel) + 0.28 * kneel) * (1 - stand),
    roll: orientation.roll * (1 - kneel) * (1 - stand) };
}
export const roomFallDuration = (kind: RoomFallKind) => GROUND_FALL_DURATIONS[kind];
