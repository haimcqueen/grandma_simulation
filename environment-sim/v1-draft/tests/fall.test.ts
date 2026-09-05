import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from '../src/simulation.ts'
import { patioFallZone, contains } from '../src/environment.ts'
import { subjectById } from '../src/robot/subjects.ts'
import { BALCONY, BALCONY_APPROACH, BALCONY_AIR_TIME, BALCONY_DURATION, FALL_DURATION, FALL_SCENARIOS, fallOrientation, poseFall } from '../src/robot/fall.ts'

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

test('balcony animation walks off the deck, drops, and settles into an injured pose', () => {
  const demo = new Simulation()
  assert.equal(demo.playFall('balcony'), true)
  assert.equal(demo.elevation, BALCONY.height)
  const start = demo.position.z
  demo.advance(BALCONY_APPROACH / 2)
  assert.ok(demo.position.z > start)
  assert.equal(demo.elevation, BALCONY.height)
  assert.equal(demo.fallProgress, 0)
  demo.advance(BALCONY_APPROACH / 2 + BALCONY_AIR_TIME / 2)
  assert.ok(demo.elevation > 0 && demo.elevation < BALCONY.height)
  assert.ok(demo.position.z > BALCONY.z + BALCONY.depth / 2)
  assert.ok(demo.fallProgress > 0)
  demo.advance(BALCONY_DURATION)
  assert.equal(demo.status, 'fallen')
  assert.ok(demo.elevation < 1e-10)
  assert.equal(demo.injuryProgress, 1)
  assert.equal(demo.events.filter(event => event.type === 'fallCompleted').length, 1)
})

test('balcony pause freezes elevation, position, and injury animation; replay restarts them', () => {
  const demo = new Simulation()
  demo.playFall('balcony')
  demo.advance(BALCONY_APPROACH + 0.3)
  demo.paused = true
  const frozen = [demo.elevation, demo.position.z, demo.fallElapsed, demo.injuryProgress]
  demo.advance(20)
  assert.deepEqual([demo.elevation, demo.position.z, demo.fallElapsed, demo.injuryProgress], frozen)
  demo.playFall('balcony')
  assert.equal(demo.paused, false)
  assert.equal(demo.elevation, BALCONY.height)
  assert.equal(demo.fallElapsed, 0)
  demo.reset()
  assert.equal(demo.elevation, 0)
  assert.equal(demo.isFalling, false)
})

test('grandma figurine supports explicit falls while quadrupeds reject the biped sequence', () => {
  const demo = new Simulation()
  demo.setSubject(subjectById('grandma-figurine'))
  assert.equal(demo.playFall('balcony'), true)
  demo.advance(BALCONY_DURATION + 1)
  assert.equal(demo.status, 'fallen')
  assert.equal(demo.subject.id, 'grandma-figurine')
  demo.setSubject(subjectById('dog'))
  const position = { ...demo.position }
  assert.equal(demo.playFall('balcony'), false)
  assert.deepEqual(demo.position, position)
  assert.equal(demo.status, 'idle')
})

test('post-impact pose draws the knees and arms inward', () => {
  const subject = subjectById('grandma')
  const joints = new Map<string, number>()
  const robot = { set: (name: string, angle: number) => joints.set(name, angle) }
  poseFall(robot, subject.stance!, 0.3, 1, subject.motion, 1, 1, 0)
  const extendedKnee = joints.get('left_knee_joint')!
  const extendedElbow = joints.get('left_elbow_joint')!
  const injured = poseFall(robot, subject.stance!, 0.3, 1, subject.motion, 1, 1, 1)
  assert.ok(joints.get('left_knee_joint')! > extendedKnee)
  assert.ok(joints.get('left_elbow_joint')! < extendedElbow)
  assert.ok(injured.roll < -0.8)
})

test('each situation has distinct motion and completes once with repeatable replay', () => {
  const outcomes = new Set<string>()
  for (const scenario of FALL_SCENARIOS) {
    const sim = new Simulation()
    assert.equal(sim.playFall(scenario.id), true)
    sim.advance(scenario.duration * 0.5)
    const halfway = [sim.position.x, sim.position.z, sim.elevation, sim.fallProgress]
    sim.paused = true
    sim.advance(10)
    assert.deepEqual([sim.position.x, sim.position.z, sim.elevation, sim.fallProgress], halfway)
    sim.paused = false
    sim.advance(scenario.duration + 2)
    assert.equal(sim.status, 'fallen', scenario.id)
    assert.ok(Math.abs(sim.elevation) < 1e-9, scenario.id)
    assert.equal(sim.events.filter(e => e.type === 'fallCompleted').length, 1)
    const orientation = fallOrientation(scenario.id, 0.65)
    outcomes.add(JSON.stringify([halfway, orientation]))
    sim.playFall(scenario.id)
    sim.advance(scenario.duration * 0.5)
    assert.deepEqual([sim.position.x, sim.position.z, sim.elevation, sim.fallProgress], halfway)
  }
  assert.equal(outcomes.size, FALL_SCENARIOS.length)
  assert.ok(fallOrientation('patio', 0.9).pitch < 0)
  assert.ok(fallOrientation('trip', 0.9).pitch > 0)
  assert.ok(Math.abs(fallOrientation('sideways', 0.9).roll) > 1.4)
  assert.ok(fallOrientation('stairs', 0.9).pitch > Math.PI * 2)
})

test('all situation poses remain finite for every articulated biped and the figurine', () => {
  for (const id of ['grandma', 'adult', 'toddler', 'grandma-figurine']) {
    for (const scenario of FALL_SCENARIOS) {
      const sim = new Simulation()
      sim.setSubject(subjectById(id))
      assert.equal(sim.playFall(scenario.id), true)
      for (let i = 0; i < 6; i++) {
        sim.advance(scenario.duration / 5)
        if (sim.subject.stance) poseFall({ set: (_name, angle) => assert.ok(Number.isFinite(angle)) }, sim.subject.stance, sim.gaitPhase, sim.time, sim.subject.motion, sim.gaitBlend, sim.fallProgress, sim.injuryProgress, scenario.id)
        const orientation = fallOrientation(scenario.id, sim.fallProgress, sim.injuryProgress)
        assert.ok([sim.position.x, sim.position.z, sim.elevation, orientation.pitch, orientation.roll].every(Number.isFinite))
      }
    }
  }
})
