import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from '../src/simulation.ts'
import { subjectById } from '../src/robot/subjects.ts'
import { FALL_DURATION } from '../src/robot/fall.ts'

// Walking to the patio passes right through the loose_rug zone first
// (high severity for an older adult), well before the patio itself.
function walkToPatio(simulation: Simulation) {
  simulation.requestDestination('patio')
  for (let frame = 0; frame < 60 * 60 && simulation.status === 'walking'; frame++) {
    simulation.advance(1 / 60)
  }
}

test('hazard falls are opt-in and separate from the patio demo', () => {
  const normal = new Simulation()
  walkToPatio(normal)
  assert.equal(normal.status, 'arrived')

  const demo = new Simulation()
  demo.setHazardFall(true)
  walkToPatio(demo)
  assert.equal(demo.status, 'falling')
  assert.equal(demo.currentSpeed, 0)
  assert.equal(demo.route.length, 0)
  assert.ok(demo.events.some(event =>
    event.type === 'fallStarted' && event.ids.includes('loose_rug')))
  demo.advance(FALL_DURATION + 1)
  assert.equal(demo.status, 'fallen')
  assert.equal(demo.fallProgress, 1)
  assert.ok(demo.events.some(event =>
    event.type === 'fallCompleted' && event.ids.includes('loose_rug')))
})

test('a low or medium severity hazard does not trigger a fall', () => {
  // Grandma's kitchen route only crosses medium/low severity hazards
  // (hot items, small objects, cookware storage, drawers) -- none high
  // enough to stumble.
  const demo = new Simulation()
  demo.setHazardFall(true)
  demo.requestDestination('kitchen')
  for (let frame = 0; frame < 60 * 60 && demo.status === 'walking'; frame++) {
    demo.advance(1 / 60)
  }
  assert.equal(demo.status, 'arrived')
})

test('the same zone does not trigger a fall for a subject it is not high-severity for', () => {
  // loose_rug is only "medium" for a toddler, not high/critical.
  const demo = new Simulation()
  demo.setSubject(subjectById('toddler'))
  demo.setHazardFall(true)
  walkToPatio(demo)
  assert.equal(demo.status, 'arrived')
})

test('quadrupeds do not fall even at a critical hazard for their condition', () => {
  // missing_baby_gate is critical for the toddler condition, and the
  // crawling infant carries that condition too -- but it is quadruped, so
  // the biped-only fall demo must never trigger for it.
  const demo = new Simulation()
  demo.setSubject(subjectById('baby'))
  demo.setHazardFall(true)
  demo.position = { x: 3.7, z: 13.2 }
  demo.setManual(true)
  demo.drive(1, 0, 0.1)
  assert.equal(demo.isFalling, false)
})

test('pause freezes a hazard fall; reset stands the robot up', () => {
  const demo = new Simulation()
  demo.setHazardFall(true)
  walkToPatio(demo)
  assert.equal(demo.status, 'falling')
  demo.advance(0.4)
  demo.paused = true
  const progress = demo.fallProgress
  demo.advance(3)
  assert.equal(demo.fallProgress, progress)
  demo.paused = false
  demo.reset()
  assert.equal(demo.status, 'idle')
  assert.equal(demo.fallProgress, 0)
  assert.equal(demo.hazardFallEnabled, true)
})

test('switching away from a hazard-fallen robot clears its fall state', () => {
  const demo = new Simulation()
  demo.setHazardFall(true)
  walkToPatio(demo)
  assert.equal(demo.status, 'falling')
  demo.setSubject(subjectById('grandma-figurine'))
  assert.equal(demo.status, 'idle')
  assert.equal(demo.fallProgress, 0)
})
