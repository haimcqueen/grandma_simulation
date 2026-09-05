import g1 from "../../v1-draft/public/robot/g1.glb?url";
import g1Joints from "../../v1-draft/public/robot/g1.joints.json?url";
import h1 from "../../v1-draft/public/robot/h1.glb?url";
import h1Joints from "../../v1-draft/public/robot/h1.joints.json?url";
import go2 from "../../v1-draft/public/robot/go2.glb?url";
import go2Joints from "../../v1-draft/public/robot/go2.joints.json?url";

export type RobotAsset = { modelUrl: string; jointsUrl: string };
export type RobotAssetMap = Record<"g1" | "h1" | "go2", RobotAsset>;

/** Vite-specific defaults. Other hosts can pass ordinary URLs to the adapter. */
export const defaultRobotAssets: RobotAssetMap = {
  g1: { modelUrl: g1, jointsUrl: g1Joints },
  h1: { modelUrl: h1, jointsUrl: h1Joints },
  go2: { modelUrl: go2, jointsUrl: go2Joints },
};
