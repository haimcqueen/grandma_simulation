import type { CharacterProfile, ConditionSpec } from './types'

/** Shared small fixture (brief §3). Integration aid, not final design. */
export const PROFILES: Record<string, CharacterProfile> = {
  older_adult: {
    id: 'older_adult', label: 'older adult', speedMps: 0.77, clearanceM: 0.45,
    reachM: 1.55, recoveryPerSec: 0.22,
    provenance: 'speed 0.77 m/s ≈ mean comfortable gait of mobility-limited over-65s '
      + '(Age and Ageing, 2026); clearance/reach/recovery are chosen scenario values, uncited.',
  },
  young_child: {
    id: 'young_child', label: 'young child', speedMps: 0.55, clearanceM: 0.28,
    reachM: 0.95, recoveryPerSec: 0.20,
    provenance: 'all values chosen for demonstration; not sourced.',
  },
}

export const CONDITIONS: ConditionSpec[] = [
  { id: 'rug', label: 'Loose rug with curled edge', provenance: 'hand-authored',
    pos: { x: -4.5, y: 0, z: 2.4 }, radius: 1.4, appliesTo: ['older_adult', 'young_child'],
    rationale: 'Unsecured edge on the main route between sofa and hallway.',
    balanceDrainPerSec: 0.38 },
  { id: 'threshold', label: '55 mm threshold lip at bathroom door', provenance: 'hand-authored',
    pos: { x: 2.6, y: 0, z: -1.0 }, radius: 0.7, appliesTo: ['older_adult', 'young_child'],
    rationale: 'Unmarked step crossed in darkness on the night route.',
    balanceDrainPerSec: 0.95 },
  { id: 'hallway', label: 'Unlit hallway', provenance: 'hand-authored',
    pos: { x: -2.0, y: 0, z: -0.5 }, radius: 2.2, appliesTo: ['older_adult'],
    rationale: 'No light source between bedroom and bathroom.',
    balanceDrainPerSec: 0.30 },
  { id: 'highshelf', label: 'Everyday items stored at 1.75 m', provenance: 'hand-authored',
    pos: { x: 5.6, y: 0, z: 4.6 }, radius: 1.0, appliesTo: ['older_adult'], height: 1.75,
    rationale: 'Above comfortable reach; requires a stool daily.',
    balanceDrainPerSec: 0.55 },
  { id: 'undersink', label: 'Cleaning chemicals at 0.4 m, unlatched', provenance: 'hand-authored',
    pos: { x: 6.6, y: 0, z: 1.2 }, radius: 0.9, appliesTo: ['young_child'], height: 0.40,
    rationale: 'Inside child reach envelope behind an unlatched door.',
    balanceDrainPerSec: 0.52 },
]
