import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? 'chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:5173')
  await page.waitForFunction(() => document.querySelector('#figurine-status')?.textContent.startsWith('Your figurine'))
  await page.locator('#animation-speed').selectOption('0.25')
  await page.locator('#play-fall').click()
  await page.waitForFunction(() => document.querySelector('#fall-stage').textContent === 'Approaching the edge')
  await page.waitForFunction(() => document.querySelector('#fall-stage').textContent === 'Falling from the balcony')
  await page.locator('#pause').click()
  const frozenTime = await page.locator('#elapsed').innerText()
  await page.screenshot({ path: '.artifacts/balcony-airborne.png', fullPage: true })
  await page.waitForTimeout(300)
  assert.equal(await page.locator('#elapsed').innerText(), frozenTime)
  assert.equal(await page.locator('#fall-stage').innerText(), 'Falling from the balcony')
  await page.locator('#animation-speed').selectOption('1')
  await page.locator('#pause').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Robot down · Reset to stand up')
  await page.screenshot({ path: '.artifacts/balcony-injured.png', fullPage: true })
  await page.locator('#play-fall').click()
  assert.equal(await page.locator('#fall-stage').innerText(), 'Approaching the edge')
  await page.locator('#subject').selectOption('grandma-figurine')
  await page.waitForFunction(() => document.querySelector('#motion-note').textContent.startsWith('Controlling your grandma'))
  await page.locator('#play-fall').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Grandma down · Replay or reset')
  await page.screenshot({ path: '.artifacts/balcony-grandma.png', fullPage: true })
  await page.locator('#reset').click()
  assert.equal(await page.locator('#status').innerText(), 'Ready to explore')
  await page.locator('#subject').selectOption('dog')
  await page.waitForFunction(() => document.querySelector('#play-fall').disabled)
  assert.deepEqual(errors, [])
  console.log('Animation browser checks passed: balcony fall, slow motion, pause, injury pose, replay, grandma, reset, no page errors.')
} finally {
  await browser.close()
}
