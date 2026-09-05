import * as THREE from "three";
import { Robot } from "../../v1-draft/src/robot/robot";
import { pose } from "../../v1-draft/src/robot/gait";
import { postures, type Posture } from "./posture";
import { crawl } from "../../v1-draft/src/robot/crawl";
import { lerpStance, UPRIGHT } from "../../v1-draft/src/robot/stance";
import { disposeMeshes } from "./scene-resources";
import type { RobotAsset } from "./robot-assets";
import { poseFall } from "../../v1-draft/src/robot/fall-motion";
import { roomFallFrame, poseRoomRecovery, type RoomFall } from "./falls";

export type UnitreeResident = Awaited<ReturnType<typeof loadRobotResident>>;

/** Feet-origin, +Z-forward visual adapter. The host owns root placement and the clock. */
export async function loadRobotResident(initialPosture: Posture, asset: RobotAsset) {
  const preset = postures[initialPosture];
  const robot = await new Robot().load(asset.modelUrl, asset.jointsUrl);
  const scale = Math.min(1, preset.maxHeight / robot.height);
  robot.root.scale.setScalar(scale);
  robot.height *= scale;
  const root = new THREE.Group();
  root.name = `unitree-${preset.asset}`;
  root.add(robot.root);
  let previousTime = 0;
  let blend = 0;
  let posture: Posture = initialPosture;
  let hunch = 1;
  let phase = 0;
  let postureChanged = true;
  let fall: RoomFall | null = null;
  const worldPosition = new THREE.Vector3();
  pose(robot, postures.grandma.stance, 0, 0, 1, postures.grandma.motion, 0);
  robot.settleOnGround();
  return {
    root,
    robot,
    metadata: { height: robot.height, model: `Unitree ${preset.asset.toUpperCase()}`, asset: preset.asset, maxHeight: preset.maxHeight },
    setFall(next: RoomFall | null) { fall = next; },
    setMotion(nextPosture: Posture, gaitPhase: number, nextHunch = 1, skin = "factory") {
      postureChanged ||= posture !== nextPosture || hunch !== nextHunch;
      hunch = nextHunch;
      if (robot.skin !== skin) robot.setSkin(skin);
      posture = nextPosture;
      phase = gaitPhase;
    },
    update(time: number, distance: number, walking: boolean, paused: boolean) {
      if (paused && !postureChanged) return;
      postureChanged = false;
      if (time < previousTime) blend = 0;
      const delta = Math.max(0, Math.min(time - previousTime, 0.1));
      previousTime = time;
      blend += ((walking ? 1 : 0) - blend) * (1 - Math.exp(-delta * 10));
      const { stance: targetStance, motion, crawl: crawlStyle } = postures[posture];
      const stance = lerpStance(UPRIGHT, targetStance, hunch);
      robot.root.rotation.set(0, 0, 0);
      if (fall) {
        const frame = roomFallFrame(fall);
        const { pitch, roll } = frame.recovery > 0
          ? poseRoomRecovery(robot, stance, phase, time, motion, 0, frame.recovery, 0, fall.kind)
          : poseFall(robot, stance, phase, time, motion, 0, frame.progress, 0, fall.kind);
        robot.root.rotation.set(pitch, 0, roll);
        root.getWorldPosition(worldPosition);
        robot.settleOnGround(worldPosition.y + frame.elevation);
        return;
      }
      const bodyPose = crawlStyle ? crawl(robot, crawlStyle, phase, time, 0, blend)
        : { ...pose(robot, stance, phase, time, 1, motion, blend), roll: 0 };
      const { bob, roll } = bodyPose;
      robot.root.rotation.z = roll;
      root.getWorldPosition(worldPosition);
      robot.settleOnGround(bob);
      robot.root.position.y += worldPosition.y;
    },
    dispose() { disposeMeshes(root); },
  };
}
