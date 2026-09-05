/**
 * Workstream C — hazards & scenarios.
 * Renderer-agnostic on purpose: plain {x,y,z}, no three.js import, so A and B
 * can run this against the shared fixture without a splat renderer.
 * Metres, seconds, right-handed Y-up (brief §3).
 */

export interface Vec3 { x: number; y: number; z: number }

/** Where a condition came from. Never conflate these (brief §6). */
export type Provenance =
  | 'hand-authored'      // a human placed this zone
  | 'geometry-derived'   // computed from collider geometry
  | 'model-proposed'     // an LLM/vision system proposed it; UNVERIFIED

export interface ConditionSpec {
  id: string
  label: string
  provenance: Provenance
  pos: Vec3
  radius: number
  /** character profile ids this condition is modelled as affecting */
  appliesTo: string[]
  /** why a human considers this a hazard — shown alongside every finding */
  rationale: string
  /** metres from floor, for reach comparisons */
  height?: number
  /**
   * SCENARIO PARAMETER, NOT A MEASURED QUANTITY.
   * Rate at which the modelled balance margin depletes inside `radius`.
   * Chosen for demonstration; not calibrated against any clinical dataset.
   */
  balanceDrainPerSec: number
}

export interface CharacterProfile {
  id: string
  label: string
  /** metres/second */
  speedMps: number
  /** body clearance for pathing */
  clearanceM: number
  /** comfortable overhead reach */
  reachM: number
  /** balance margin recovered per second on unflagged floor */
  recoveryPerSec: number
  /** where each number came from — cited or invented. Be honest. */
  provenance: string
}

export type SimEventType =
  | 'hazardExposureStarted'
  | 'hazardExposureEnded'
  | 'balanceMarginExhausted'
  | 'reachExceeded'

export interface SimEvent {
  type: SimEventType
  tSim: number
  characterId: string
  profileId: string
  conditionId: string
  at: Vec3
}

/** An observation under stated assumptions — never a prediction (brief §6). */
export interface Finding {
  conditionId: string
  label: string
  provenance: Provenance
  /** what the run actually showed */
  observation: string
  /** the assumptions that produced it */
  assumptions: string[]
  /** raw counts backing the observation */
  evidence: { exposures: number; exhaustions: number; traversals: number }
  rationale: string
}
