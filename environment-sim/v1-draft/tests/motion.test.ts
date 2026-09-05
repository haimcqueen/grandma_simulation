import test from 'node:test'
import assert from 'node:assert/strict'
import { Simulation } from '../src/simulation.ts'
import { SUBJECTS, subjectById } from '../src/robot/subjects.ts'
import { angleDifference, stepCycle } from '../src/robot/motion.ts'
import { pose } from '../src/robot/gait.ts'
import { isWalkable } from '../src/environment.ts'

test('autonomous turns respect the selected turn rate and brake before arrival', () => {
  for (const subject of SUBJECTS) {
    const simulation = new Simulation()
    simulation.setSubject(subject)
    simulation.heading = Math.PI
    simulation.requestDestination('kitchen')
    let peakSpeed = 0
    let braked = false
    for (let frame = 0; frame < 60 * 120 && simulation.status === 'walking'; frame++) {
      const heading = simulation.heading
      const previousSpeed = simulation.currentSpeed
      simulation.advance(1 / 60)
      assert.ok(Math.abs(angleDifference(simulation.heading, heading)) <= subject.motion.turnRate / 60 + 1e-10)
      assert.ok(isWalkable(simulation.position, simulation.obstacles))
      peakSpeed = Math.max(peakSpeed, simulation.currentSpeed)
      if (previousSpeed > simulation.currentSpeed && simulation.currentSpeed > 0) braked = true
    }
    assert.equal(simulation.status, 'arrived', subject.id)
    assert.ok(peakSpeed > subject.speedMps * 0.8, subject.id)
    assert.ok(braked, subject.id)
    assert.equal(simulation.currentSpeed, 0)
  }
})

test('manual collision stops actual gait travel and never tunnels on a long frame', () => {
  const simulation = new Simulation()
  simulation.setManual(true)
  simulation.drive(1, 0, 60)
  assert.ok(isWalkable(simulation.position, simulation.obstacles))
  const distance = simulation.distance
  const phase = simulation.gaitPhase
  simulation.drive(1, 0, 1)
  assert.equal(simulation.distance, distance)
  assert.equal(simulation.gaitPhase, phase)
  assert.equal(simulation.currentSpeed, 0)
  assert.equal(simulation.status, 'idle')
})

test('pause preserves the entire gait and idle settles without restarting the cycle', () => {
  const simulation = new Simulation()
  simulation.setManual(true)
  simulation.drive(1, 0, 0.5)
  simulation.advance(0.5)
  simulation.paused = true
  const paused = [simulation.gaitPhase, simulation.gaitBlend, simulation.heading, simulation.time]
  simulation.drive(1, 1, 1)
  simulation.advance(1)
  assert.deepEqual([simulation.gaitPhase, simulation.gaitBlend, simulation.heading, simulation.time], paused)
  simulation.paused = false
  simulation.drive(0, 0, 2)
  assert.equal(simulation.currentSpeed, 0)
  assert.ok(simulation.gaitBlend < 0.001)
  assert.ok(simulation.gaitPhase >= paused[0])
})

test('backward steps reverse the cycle and cover less ground', () => {
  const forward = new Simulation()
  const backward = new Simulation()
  forward.setManual(true)
  backward.setManual(true)
  forward.drive(1, 0, 1)
  backward.drive(-1, 0, 1)
  assert.ok(backward.gaitPhase < 0)
  assert.ok(backward.distance < forward.distance)
})

test('cautious biped gait has longer double support and lower foot lift', () => {
  const grandma = subjectById('grandma')
  const adult = subjectById('adult')
  let doubleSupport = 0
  for (let sample = 0; sample < 1000; sample++) {
    const left = stepCycle(sample / 1000, grandma.motion.stanceRatio)
    const right = stepCycle(sample / 1000 + 0.5, grandma.motion.stanceRatio)
    assert.ok(left.lift === 0 || right.lift === 0)
    if (left.lift === 0 && right.lift === 0) doubleSupport++
  }
  assert.ok(doubleSupport >= 350 && doubleSupport <= 370)
  assert.ok(grandma.motion.kneeLift < adult.motion.kneeLift)
  assert.ok(grandma.motion.strideLength < adult.motion.strideLength)
})

test('idle legs do not depend on the last step phase', () => {
  const grandma = subjectById('grandma')
  const sample = (phase: number) => {
    const joints = new Map<string, number>()
    pose({ set: (name, angle) => joints.set(name, angle) }, grandma.stance!, phase, 3, 1, grandma.motion, 0)
    return joints
  }
  assert.deepEqual(sample(0.2), sample(0.7))
})

test('elapsed time chunks produce the same route motion', () => {
  const single = new Simulation()
  const stepped = new Simulation()
  single.requestDestination('kitchen')
  stepped.requestDestination('kitchen')
  single.advance(2)
  for (let frame = 0; frame < 120; frame++) stepped.advance(1 / 60)
  assert.ok(Math.abs(single.distance - stepped.distance) < 1e-10)
  assert.ok(Math.abs(single.gaitPhase - stepped.gaitPhase) < 1e-10)
})
