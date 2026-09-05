import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ScenarioRunner, type Walker } from './runner.ts'
import { CONDITIONS, PROFILES } from './fixture.ts'

const walk = (r: ScenarioRunner, w: Walker, secs: number) => {
  for (let i = 0; i < secs * 60; i++) r.advance(1 / 60, [w])
}

/** Read positions from the fixture so tests can't drift when the layout moves. */
const posOf = (id: string) => ({ ...CONDITIONS.find(c => c.id === id)!.pos })
const far = { x: 999, y: 0, z: 999 }

test('happy path: standing in a condition exhausts the margin and yields a finding', () => {
  const r = new ScenarioRunner(CONDITIONS, PROFILES)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: posOf('rug'), balance: 1 }, 10)
  const f = r.findings().find(x => x.conditionId === 'rug')!
  assert.ok(f.evidence.exhaustions > 0)
  assert.match(f.observation, /modelled traversals/)
  assert.equal(f.provenance, 'hand-authored')
  assert.ok(f.assumptions.length >= 3, 'every finding must carry its assumptions')
})

test('reach is compared against the profile, not asserted', () => {
  const r = new ScenarioRunner(CONDITIONS, PROFILES)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: posOf('highshelf'), balance: 1 }, 1)
  assert.ok(r.events.some(e => e.type === 'reachExceeded' && e.conditionId === 'highshelf'))
})

test('unvisited condition reports no observation, NOT a zero score', () => {
  const r = new ScenarioRunner(CONDITIONS, PROFILES)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: far, balance: 1 }, 5)
  const f = r.findings().find(x => x.conditionId === 'rug')!
  assert.match(f.observation, /No observation available|not encountered/i)
  assert.equal(f.evidence.exposures, 0)
})

test('a condition profiled for a child does not fire for an adult', () => {
  const r = new ScenarioRunner(CONDITIONS, PROFILES)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: posOf('undersink'), balance: 1 }, 8)
  assert.equal(r.findings().find(x => x.conditionId === 'undersink')!.evidence.exposures, 0)
})

test('REGRESSION: a transiting walker recovers between passes — weak drains never fire', () => {
  // The earlier bug: a hazard whose drain is too weak relative to transit time
  // silently never appears in the report. Standing still is NOT the same case.
  const transit = (drain: number) => {
    const conds = CONDITIONS.map(c => c.id === 'rug' ? { ...c, balanceDrainPerSec: drain } : c)
    const r = new ScenarioRunner(conds, PROFILES)
    const w: Walker = { id: 'w1', profileId: 'older_adult', pos: { x: posOf('rug').x - 6, y: 0, z: posOf('rug').z }, balance: 1 }
    const speed = PROFILES.older_adult.speedMps
    for (let lap = 0; lap < 12; lap++) {          // walk past the rug repeatedly
      w.pos.x = posOf('rug').x - 6
      for (let i = 0; i < 20 * 60; i++) { w.pos.x += speed / 60; r.advance(1 / 60, [w]) }
    }
    return r.findings().find(x => x.conditionId === 'rug')!
  }

  const weak = transit(0.10)
  assert.ok(weak.evidence.exposures > 0, 'exposure is still recorded')
  assert.equal(weak.evidence.exhaustions, 0,
    'drain too weak relative to transit time — hazard is invisible in the report')

  const real = transit(0.38)
  assert.ok(real.evidence.exhaustions > 0, 'the authored value does fire on transit')
})

test('reset restores a comparable run', () => {
  const r = new ScenarioRunner(CONDITIONS, PROFILES)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: posOf('rug'), balance: 1 }, 6)
  const before = r.findings().find(x => x.conditionId === 'rug')!.evidence.exhaustions
  r.reset()
  assert.equal(r.events.length, 0)
  assert.equal(r.tSim, 0)
  walk(r, { id: 'w1', profileId: 'older_adult', pos: posOf('rug'), balance: 1 }, 6)
  assert.equal(r.findings().find(x => x.conditionId === 'rug')!.evidence.exhaustions, before)
})
