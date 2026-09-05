import { STOOPED, UPRIGHT, TODDLING, type Stance } from './stance'
import { BABY_CRAWL, TROT, type CrawlStyle } from './crawl'
import { CAUTIOUS, ADULT_MOTION, TODDLER_MOTION, CRAWLING_MOTION, DOG_MOTION, type MotionProfile } from './motion'

/**
 * A subject is a body plus how it moves. Swapping subject changes the mesh,
 * the gait, the posture and the speed together — otherwise you get a baby
 * that walks at an adult's pace, which is the mistake worth avoiding.
 *
 * Speeds are scenario parameters. Only the older-adult figure is sourced.
 */
export interface Subject {
  id: string
  label: string
  asset: string                       // basename under /robot/
  locomotion: 'biped' | 'quadruped' | 'rigid'
  stance?: Stance
  crawl?: CrawlStyle
  speedMps: number
  motion: MotionProfile
  /** planner clearance — a crawling infant needs less room than a walker */
  clearanceM: number
  /** comfortable overhead reach from the floor */
  reachM: number
  note: string
}

export const SUBJECTS: Subject[] = [
  {
    id: 'grandma', label: 'OLDER ADULT', asset: 'g1',
    locomotion: 'biped', stance: STOOPED,
    speedMps: 0.77, clearanceM: 0.34, reachM: 1.55,
    motion: CAUTIOUS,
    note: '0.77 m/s ≈ mean comfortable gait of mobility-limited over-65s '
        + '(Age and Ageing, 2026). Posture and reach are scenario values.',
  },
  {
    id: 'adult', label: 'ADULT', asset: 'h1',
    locomotion: 'biped', stance: UPRIGHT,
    speedMps: 1.30, clearanceM: 0.36, reachM: 2.05,
    motion: ADULT_MOTION,
    note: 'The body the house was dimensioned for. All values chosen.',
  },
  {
    id: 'baby', label: 'INFANT · CRAWLING', asset: 'go2',
    locomotion: 'quadruped', crawl: BABY_CRAWL,
    speedMps: 0.28, clearanceM: 0.22, reachM: 0.72,
    motion: CRAWLING_MOTION,
    note: 'Crawling infant. Low reach envelope means floor-level hazards are '
        + 'in range and worktop-level ones are not. All values chosen.',
  },
  {
    id: 'toddler', label: 'TODDLER · WALKING', asset: 'g1',
    locomotion: 'biped', stance: TODDLING,
    speedMps: 0.55, clearanceM: 0.26, reachM: 0.95,
    motion: TODDLER_MOTION,
    note: 'Unsteady upright walking. Body is a scaled G1 stand-in, not an '
        + 'anthropometric child model.',
  },
  {
    id: 'dog', label: 'DOG', asset: 'go2',
    locomotion: 'quadruped', crawl: TROT,
    speedMps: 1.10, clearanceM: 0.24, reachM: 0.55,
    motion: DOG_MOTION,
    note: 'Pets are a documented fall hazard in the homes of older adults.',
  },
  {
    id: 'grandma-figurine', label: 'GRANDMA FIGURINE', asset: 'grandmother',
    locomotion: 'rigid',
    speedMps: 0.77, clearanceM: 0.34, reachM: 1.55,
    motion: CAUTIOUS,
    note: 'Your imported grandma, controllable with the cautious movement preset. '
        + 'The unrigged body moves and turns as one piece; limbs are not animated.',
  },
]

export const subjectById = (id: string) =>
  SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
