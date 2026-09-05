import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from '../src/simulation.ts'

const drive = (s: Simulation, f: number, t: number, secs: number) => {
  for (let i = 0; i < secs * 60; i++) { s.drive(f, t, 1/60); s.advance(1/60) }
}

test('arrows move the resident and accumulate distance for the gait', () => {
  const s = new Simulation(); s.setManual(true)
  const from = { ...s.position }
  // Speed ramps in via the subject's motion profile, so allow time to reach it
  // rather than assuming instant velocity.
  drive(s, 1, 0, 3)
  assert.ok(Math.hypot(s.position.x-from.x, s.position.z-from.z) > 0.5)
  assert.ok(s.distance > 0.5, 'distance drives the walk cycle')
})

test('speed ramps in and out rather than snapping', () => {
  const s = new Simulation(); s.setManual(true)
  drive(s, 1, 0, 0.1)
  const early = s.distance
  drive(s, 1, 0, 0.4)
  const later = s.distance - early
  assert.ok(later > early * 2, 'still accelerating after the first tenth of a second')

  drive(s, 1, 0, 3)
  const cruising = s.distance
  drive(s, 0, 0, 1)                       // release the key
  assert.ok(s.distance > cruising, 'decelerates over a distance, does not stop dead')
})

test('turning changes heading without translating', () => {
  const s = new Simulation(); s.setManual(true)
  const from = { ...s.position }
  drive(s, 0, 1, 0.5)
  assert.ok(Math.abs(s.heading) > 0.5)
  assert.equal(s.position.x, from.x)
})

test('manual drive cannot walk through walls the planner respects', () => {
  const s = new Simulation(); s.setManual(true)
  drive(s, 1, 0, 60)                       // 54 m forward — far past any wall
  const inside = Math.abs(s.position.x) < 40 && Math.abs(s.position.z) < 40
  assert.ok(inside, `escaped the house at ${JSON.stringify(s.position)}`)
})

test('choosing a destination releases manual control', () => {
  const s = new Simulation(); s.setManual(true)
  assert.equal(s.manual, true)
  s.requestDestination('kitchen' as never)
  assert.equal(s.manual, false)
  assert.ok(['walking','blocked'].includes(s.status))
})

test('reset restores autonomous mode', () => {
  const s = new Simulation(); s.setManual(true); drive(s, 1, 0, 1)
  s.reset()
  assert.equal(s.manual, false)
  assert.equal(s.distance, 0)
})

test('paused freezes manual movement too', () => {
  const s = new Simulation(); s.setManual(true); s.paused = true
  const from = { ...s.position }
  drive(s, 1, 0, 1)
  assert.deepEqual(s.position, from)
})
