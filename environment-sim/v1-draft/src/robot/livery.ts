import * as THREE from 'three'

/**
 * Skins. STL and DAE carry no materials, so appearance is assigned per link by
 * name. Add an entry here and it is selectable everywhere — no mesh editing.
 *
 * `match` is tested against the lowercased link name; first match wins, and
 * `base` is the fallback for everything else.
 */
export interface Livery {
  id: string
  label: string
  base: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  parts?: { match: RegExp; material: THREE.Material }[]
  /** drawn as edges instead of solid surfaces */
  wireframe?: boolean
}

const std = (color: number, roughness = 0.35, metalness = 0.15) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

const alpha = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })

/** Factory-accurate Unitree: white shell, black head/hands/ankles, grey joints. */
export const FACTORY: Livery = {
  id: 'factory', label: 'Factory',
  base: std(0xf4f6f8, 0.30, 0.12),
  parts: [
    { match: /head|hand|ankle_roll|logo|foot|calf/, material: std(0x14181d, 0.42, 0.35) },
    { match: /hip_roll|hip_yaw|shoulder_roll|shoulder_yaw|elbow|wrist|waist_yaw|thigh/,
      material: std(0x8b949c, 0.38, 0.55) },
  ],
}

/** Matte dark — reads well against a bright interior. */
export const SLATE: Livery = {
  id: 'slate', label: 'Slate',
  base: std(0x39424a, 0.62, 0.10),
  parts: [{ match: /head|hand|foot|ankle_roll/, material: std(0x1b2026, 0.55, 0.25) }],
}

/** Translucent — for ghosted instances, overlays, or many-at-once. */
export const GHOST: Livery = {
  id: 'ghost', label: 'Ghost',
  base: alpha(0x4fd8ff, 0.20),
}

/** Placeholder aesthetic: edges only, matches unfilled object slots. */
export const WIRE: Livery = {
  id: 'wire', label: 'Wireframe',
  base: new THREE.MeshBasicMaterial({ color: 0x4fd8ff, wireframe: true, transparent: true, opacity: 0.55 }),
  wireframe: true,
}

/** High-visibility, for the moment a subject is flagged. */
export const ALERT: Livery = {
  id: 'alert', label: 'Alert',
  base: std(0xff3b30, 0.45, 0.05),
  parts: [{ match: /head|hand|foot/, material: std(0x7a1109, 0.5, 0.1) }],
}

export const LIVERIES: Livery[] = [FACTORY, SLATE, GHOST, WIRE, ALERT]
export const liveryById = (id: string) => LIVERIES.find((l) => l.id === id) ?? FACTORY

/** Pick the material for one link under a livery. */
export function materialFor(livery: Livery, linkName: string): THREE.Material {
  const n = linkName.toLowerCase()
  for (const part of livery.parts ?? []) if (part.match.test(n)) return part.material
  return livery.base
}
