/**
 * Feeds ground positions in, gets hazard-zone enter/exit transitions out.
 *
 * This has no dependency on `Simulation`, three.js, or this house's layout —
 * only on the pure catalog/zone data and lookup in hazards.ts. Any simulation
 * model that can report "this entity is at (x, z), representing this
 * condition, this tick" can drive it:
 *
 *   const tracker = new HazardTracker();                  // this house's zones
 *   const tracker = new HazardTracker({ zones: myZones }); // a different one
 *
 *   // once per simulation step, per moving entity:
 *   const hit = tracker.update(entityId, { x, z }, condition);
 *
 *   // or react to transitions instead of polling the return value:
 *   tracker.onEnter = (entityId, hit) => showToast(hit);
 *   tracker.onExit = (entityId, previous) => hideToast(previous);
 */
import { hazardAt, zoneKey, type Condition, type HazardHit, type HazardZone } from "./hazards";

export interface HazardTrackerOptions {
  /** Defaults to this house's hand-placed HAZARD_ZONES. */
  zones?: HazardZone[];
}

interface EntityState {
  key: string | null;
  pending: HazardHit | null;
}

export class HazardTracker {
  private zones?: HazardZone[];
  private stateByEntity = new Map<string, EntityState>();

  /** Fires when an entity newly enters a hazard zone (for this condition). */
  onEnter?: (entityId: string, hit: HazardHit) => void;
  /** Fires when an entity leaves the zone that produced the current pending hit. */
  onExit?: (entityId: string, previous: HazardHit) => void;

  constructor(options: HazardTrackerOptions = {}) {
    this.zones = options.zones;
  }

  private stateFor(entityId: string): EntityState {
    let state = this.stateByEntity.get(entityId);
    if (!state) {
      state = { key: null, pending: null };
      this.stateByEntity.set(entityId, state);
    }
    return state;
  }

  /**
   * Call once per tracked entity per simulation step. Returns the entity's
   * current pending hazard (or null) — the same value `pendingFor` returns.
   */
  update(
    entityId: string,
    point: { x: number; z: number },
    condition: Condition | null,
  ): HazardHit | null {
    const state = this.stateFor(entityId);
    const hit = hazardAt(point, condition, this.zones as HazardZone[] | undefined);
    const key = hit ? zoneKey(hit.zone) : null;
    if (key !== state.key) {
      const previousPending = state.pending;
      const previousKey = state.key;
      state.key = key;
      if (hit) {
        state.pending = hit;
        this.onEnter?.(entityId, hit);
      } else if (previousPending && zoneKey(previousPending.zone) === previousKey) {
        state.pending = null;
        this.onExit?.(entityId, previousPending);
      }
    }
    return state.pending;
  }

  /** The hazard currently flagged for this entity's UI, if any. */
  pendingFor(entityId: string): HazardHit | null {
    return this.stateByEntity.get(entityId)?.pending ?? null;
  }

  /**
   * Clears the popup without forgetting which zone the entity occupies, so
   * it won't immediately re-trigger until the entity leaves and re-enters.
   */
  dismiss(entityId: string) {
    const state = this.stateByEntity.get(entityId);
    if (state) state.pending = null;
  }

  /** Forgets an entity entirely — its next update() re-evaluates from scratch. */
  reset(entityId: string) {
    this.stateByEntity.delete(entityId);
  }
}
