import type { AssetTransform, WorldAsset } from "./contracts";

/** Reject malformed runtime configuration before handing URLs or transforms to loaders. */
export function parseWorldAsset(input: unknown): WorldAsset {
  if (!input || typeof input !== "object")
    throw new Error("World manifest must be a JSON object.");
  const value = input as Record<string, unknown>;
  const text = (key: string) => {
    if (typeof value[key] !== "string" || !value[key])
      throw new Error(`World manifest needs ${key}.`);
    return value[key] as string;
  };
  const tuple = (input: unknown, length: number): number[] => {
    if (
      !Array.isArray(input) ||
      input.length !== length ||
      !input.every((item) => typeof item === "number" && Number.isFinite(item))
    )
      throw new Error("World transform or camera coordinates are invalid.");
    return input;
  };
  const transform = (input: unknown): AssetTransform => {
    if (!input || typeof input !== "object")
      throw new Error("World transform is missing.");
    const transform = input as Record<string, unknown>;
    if (
      typeof transform.scale !== "number" ||
      !Number.isFinite(transform.scale) ||
      transform.scale <= 0
    )
      throw new Error("World scale must be positive.");
    const quaternion = tuple(
      transform.quaternion,
      4,
    ) as AssetTransform["quaternion"];
    if (Math.abs(Math.hypot(...quaternion) - 1) > 0.001)
      throw new Error("World quaternion must be normalized.");
    return {
      position: tuple(transform.position, 3) as AssetTransform["position"],
      quaternion,
      scale: transform.scale,
    };
  };
  const url = (key: string) => {
    const path = text(key);
    if (!path.startsWith("/") && !/^https?:\/\//.test(path))
      throw new Error(
        `World ${key} must use HTTP or an absolute application path.`,
      );
    return path;
  };
  if (
    value.metricStatus !== "unverified" &&
    value.metricStatus !== "calibrated"
  )
    throw new Error("World metricStatus is required.");
  if (!value.camera || typeof value.camera !== "object")
    throw new Error("World camera is missing.");
  const camera = value.camera as Record<string, unknown>;
  const cutouts = value.cutouts === undefined ? undefined : (() => {
    if (!Array.isArray(value.cutouts) || value.cutouts.length > 8) throw new Error("At most eight world cutouts are supported.");
    return value.cutouts.map((cut: {min: unknown; max: unknown; yaw?: number}) => {
      const min = tuple(cut.min, 3) as [number, number, number], max = tuple(cut.max, 3) as [number, number, number];
      if (min.some((v, i) => v >= max[i])) throw new Error("World cutout bounds must have positive volume.");
      if (cut.yaw !== undefined && !Number.isFinite(cut.yaw)) throw new Error("Cutout yaw must be finite.");
      return { min, max, ...(cut.yaw === undefined ? {} : { yaw: cut.yaw }) };
    });
  })();
  return {
    cutouts,
    id: text("id"),
    label: text("label"),
    source: text("source"),
    splatUrl: url("splatUrl"),
    colliderUrl: url("colliderUrl"),
    splatTransform: transform(value.splatTransform),
    colliderTransform: transform(value.colliderTransform),
    metricStatus: value.metricStatus,
    camera: {
      position: tuple(camera.position, 3) as [number, number, number],
      target: tuple(camera.target, 3) as [number, number, number],
    },
  };
}
