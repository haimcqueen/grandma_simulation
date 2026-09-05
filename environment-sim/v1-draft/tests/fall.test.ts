import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from '../src/simulation.ts'
import { patioFallZone, contains } from '../src/environment.ts'
import { subjectById } from '../src/robot/subjects.ts'
import { FALL_DURATION, poseFall } from '../src/robot/fall.ts'

function enterPatio(simulation: Simulation) {
  simulation.requestDestination('patio')
  for (let frame = 0; frame < 60 * 60 && simulation.status === 'walking'; frame++) {
    simulation.advance(1 / 60)
  }
}

test('patio falls are opt-in, trigger in the patch, and finish once', () => {
  const normal = new Simulation()
  enterPatio(normal)
  assert.equal(normal.status, 'arrived')
  const demo = new Simulation()
  demo.setPatioFall(true)
  enterPatio(demo)
  assert.equal(demo.status, 'falling')
  assert.ok(contains(demo.position, patioFallZone))
  assert.equal(demo.currentSpeed, 0)
  assert.equal(demo.route.length, 0)
  demo.advance(FALL_DURATION + 1)
  assert.equal(demo.status, 'fallen')
  assert.equal(demo.fallProgress, 1)
  demo.advance(5)
  assert.equal(demo.events.filter(event => event.type === 'fallCompleted').length, 1)
})

test('pause freezes the fall; controls and replanning cannot stand the robot up', () => {
  const demo = new Simulation()
  demo.setPatioFall(true)
  enterPatio(demo)
  demo.advance(0.4)
  demo.paused = true
  const progress = demo.fallProgress
  demo.advance(3)
  assert.equal(demo.fallProgress, progress)
  demo.paused = false
  const position = { ...demo.position }
  demo.setManual(true)
  demo.drive(1, 1, 1)
  demo.requestDestination('kitchen')
  demo.setScenario('cart')
  assert.equal(demo.status, 'falling')
  assert.deepEqual(demo.position, position)
  demo.advance(3)
  demo.setPatioFall(false)
  demo.requestDestination('living')
  assert.equal(demo.status, 'fallen')
  demo.reset()
  assert.equal(demo.status, 'idle')
  assert.equal(demo.fallProgress, 0)
})

test('manual translation triggers the fall, but standing or turning alone does not', () => {
  const demo = new Simulation()
  demo.setPatioFall(true)
  demo.position = { x: patioFallZone.x, z: patioFallZone.z }
  demo.setManual(true)
  demo.drive(0, 1, 0.1)
  assert.equal(demo.isFalling, false)
  demo.drive(1, 0, 0.1)
  assert.equal(demo.status, 'falling')
  demo.advance(FALL_DURATION + 0.1)
  assert.equal(demo.status, 'fallen')
})

test('figurine and quadrupeds remain controllable when the biped fall demo is enabled', () => {
  for (const id of ['grandma-figurine', 'baby', 'dog']) {
    const demo = new Simulation()
    demo.setSubject(subjectById(id))
    demo.setPatioFall(true)
    enterPatio(demo)
    assert.equal(demo.status, 'arrived', id)
  }
})

test('switching away from a fallen robot clears its fall state', () => {
  const demo = new Simulation()
  demo.setPatioFall(true)
  enterPatio(demo)
  demo.setSubject(subjectById('grandma-figurine'))
  assert.equal(demo.status, 'idle')
  assert.equal(demo.fallProgress, 0)
  assert.equal(demo.patioFallEnabled, true)
})

test('fall pose starts upright and finishes prone with finite joint angles', () => {
  const subject = subjectById('grandma')
  const joints = new Map<string, number>()
  const robot = { set: (name: string, angle: number) => joints.set(name, angle) }
  const sample = (progress: number) => poseFall(robot, subject.stance!, 0.3, 1,
    subject.motion, 1, progress)
  assert.equal(sample(0).pitch, 0)
  const middle = sample(0.5).pitch
  assert.ok(middle > 0 && middle < Math.PI / 2)
  assert.equal(sample(1).pitch, Math.PI / 2)
  for (const angle of joints.values()) assert.ok(Number.isFinite(angle))
})
