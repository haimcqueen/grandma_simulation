import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeMeshes } from "../scene-resources";
import { loadRobotResident } from "../robot-resident";
import { defaultRobotAssets } from "../robot-assets";
import type { Posture } from "../posture";
import type { RoomFall } from "../falls";

/** Human bones consume the existing G1 pose. No independent animation clock or clips. */
const mapping = [
  ["Hips", "pelvis"],
  ["Spine02", "waist_pitch_joint"],
  ["Head", "head_joint"],
  ["LeftUpLeg", "left_hip_yaw_joint", "LeftLeg", "left_knee_joint"],
  ["LeftLeg", "left_knee_joint", "LeftFoot", "left_ankle_pitch_joint"],
  ["LeftFoot", "left_ankle_roll_joint"],
  ["RightUpLeg", "right_hip_yaw_joint", "RightLeg", "right_knee_joint"],
  ["RightLeg", "right_knee_joint", "RightFoot", "right_ankle_pitch_joint"],
  ["RightFoot", "right_ankle_roll_joint"],
  ["LeftArm", "left_shoulder_yaw_joint", "LeftForeArm", "left_elbow_joint"],
  ["LeftForeArm", "left_elbow_joint", "LeftHand", "left_wrist_roll_joint"],
  ["LeftHand", "left_wrist_yaw_joint"],
  ["RightArm", "right_shoulder_yaw_joint", "RightForeArm", "right_elbow_joint"],
  ["RightForeArm", "right_elbow_joint", "RightHand", "right_wrist_roll_joint"],
  ["RightHand", "right_wrist_yaw_joint"],
] as const;

export async function loadGrandmaResident(initialPosture: Posture = "grandma", url = "/characters/grandma-idle.glb") {
  const results = await Promise.allSettled([
    new GLTFLoader().loadAsync(url), loadRobotResident(initialPosture, defaultRobotAssets.g1),
  ]);
  if (results[0].status === "rejected" || results[1].status === "rejected") {
    if (results[0].status === "fulfilled") disposeMeshes(results[0].value.scene, true);
    if (results[1].status === "fulfilled") results[1].value.dispose();
    throw new Error("Grandma or her Unitree motion driver could not load.");
  }
  const rig = results[0].value.scene, driver = results[1].value;
  const root = new THREE.Group(); root.name = "grandma-unitree-motion"; root.add(rig);
  // The driver remains outside the rendered scene; its own adapter owns all gait/fall logic.
  const source = driver.robot.root;
  const requireNode = (parent: THREE.Object3D, name: string) => {
    const node = parent.getObjectByName(name);
    if (!node) throw new Error(`Retargeting requires joint ${name}`);
    return node;
  };
  try {
    const referenceHeight = new THREE.Box3().setFromObject(driver.root).getSize(new THREE.Vector3()).y;
    for (const name of driver.robot.jointNames) driver.robot.set(name, 0);
    driver.robot.setNode("head_joint", [0, 1, 0], 0);
    source.rotation.set(0, 0, 0); source.updateMatrixWorld(true); root.updateMatrixWorld(true);
    // Align the human T-pose limbs with the robot's neutral limb directions first.
    const bindings = mapping.map(([boneName, jointName, childName, nextJoint]) => {
      const bone = requireNode(rig, boneName), joint = requireNode(source, jointName);
      if (childName && nextJoint) {
        const from = requireNode(rig, childName).getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
        const to = requireNode(source, nextJoint).getWorldPosition(new THREE.Vector3()).sub(joint.getWorldPosition(new THREE.Vector3())).normalize();
        const desired = new THREE.Quaternion().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
        bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
        root.updateMatrixWorld(true);
      }
      return { bone, joint, sourceRestInverse: joint.getWorldQuaternion(new THREE.Quaternion()).invert(), targetRest: bone.getWorldQuaternion(new THREE.Quaternion()) };
    });
    rig.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true; child.receiveShadow = true; child.frustumCulled = false;
      }
    });
    const rootRotation = new THREE.Quaternion(), desired = new THREE.Quaternion(), parentInverse = new THREE.Quaternion();
    const bounds = new THREE.Box3(), rootPosition = new THREE.Vector3();
    let fall: RoomFall | null = null;
    const vertex = new THREE.Vector3();
    const transferPose = () => {
      source.updateMatrixWorld(true); root.updateMatrixWorld(true);
      root.getWorldQuaternion(rootRotation);
      for (const binding of bindings) {
        binding.joint.getWorldQuaternion(desired).multiply(binding.sourceRestInverse).multiply(binding.targetRest).premultiply(rootRotation);
        binding.bone.parent!.getWorldQuaternion(parentInverse).invert();
        binding.bone.quaternion.copy(parentInverse.multiply(desired)).normalize();
        binding.bone.updateMatrixWorld(true);
      }
      // Pose-aware skin bounds keep soles (or the body during a fall) on the active floor.
      rig.position.y = 0; root.updateMatrixWorld(true);
      bounds.setFromObject(rig, true); root.getWorldPosition(rootPosition);
      rig.position.y += rootPosition.y - bounds.min.y;
      root.updateMatrixWorld(true);
      // The human is one skinned mesh, so use posed vertices rather than a whole-body
      // box to find the parts directly over the teammate's furniture support.
      const support = fall?.obstacle?.support;
      if (support) {
        let lift = 0;
        rig.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          for (let index = 0; index < child.geometry.attributes.position.count; index++) {
            child.getVertexPosition(index, vertex).applyMatrix4(child.matrixWorld);
            if (Math.abs(vertex.x - support.x) <= support.width / 2 && Math.abs(vertex.z - support.z) <= support.depth / 2)
              lift = Math.max(lift, support.top + 0.012 - vertex.y);
          }
        });
        rig.position.y += lift;
        root.updateMatrixWorld(true);
      }
    };
    driver.update(0, 0, false, false); transferPose();
    bounds.setFromObject(rig, true);
    const posedHeight = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(posedHeight) || posedHeight <= 0) throw new Error("Invalid grandma geometry");
    rig.scale.multiplyScalar(referenceHeight / posedHeight); transferPose();
    const head = requireNode(rig, "Head");
    return {
      root, driver,
      metadata: { height: referenceHeight, model: "Grandma", animation: "unitree-retargeted" },
      setMotion: driver.setMotion,
      setFall(next: RoomFall | null) { fall = next; driver.setFall(next); },
      getEyePosition(target: THREE.Vector3) { head.getWorldPosition(target); target.y += referenceHeight * 0.035; return target; },
      update(time: number, distance: number, walking: boolean, paused: boolean) {
        driver.update(time, distance, walking, paused); transferPose();
      },
      dispose() { driver.dispose(); disposeMeshes(root, true); },
    };
  } catch (error) { driver.dispose(); disposeMeshes(root, true); throw error; }
}
