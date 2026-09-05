import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:5173')
  await page.locator('#subject').selectOption('adult')
  await page.waitForFunction(() => document.querySelector('#speed').value === '1.3')
  await page.locator('#subject').selectOption('grandma')
  await page.waitForFunction(() => document.querySelector('#speed').value === '0.77')
  assert.equal(await page.locator('canvas').count(), 1)
  await page.locator('#first-person').click()
  assert.equal(await page.locator('#first-person').getAttribute('aria-pressed'), 'true')
  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => parseFloat(document.querySelector('#distance').textContent) > 0.2)
  await page.keyboard.up('ArrowUp')
  await page.locator('#pause').click()
  const distance = await page.locator('#distance').innerText()
  await page.screenshot({ path: '.artifacts/first-person.png', fullPage: true })
  await page.locator('#third-person').click()
  assert.equal(await page.locator('#scene').getAttribute('data-camera-mode'), 'third-person')
  assert.equal(await page.locator('#distance').innerText(), distance)
  await page.screenshot({ path: '.artifacts/third-person.png', fullPage: true })
  await page.locator('#orbit').click()
  assert.equal(await page.locator('#scene').getAttribute('data-camera-mode'), 'wide')
  await page.locator('#top').click()
  assert.equal(await page.locator('#top').getAttribute('aria-pressed'), 'true')
  await page.keyboard.press('v')
  await page.waitForFunction(() => document.querySelector('#scene').dataset.cameraMode === 'first-person')
  await page.locator('#subject').selectOption('grandma-figurine')
  await page.waitForFunction(() => document.querySelector('#camera-caption').textContent.includes('GRANDMA FIGURINE'))
  assert.equal(await page.locator('#scene').getAttribute('data-camera-mode'), 'first-person')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(250)
  assert.equal(await page.locator('#scene').getAttribute('data-camera-mode'), 'first-person')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: '.artifacts/camera-mobile.png', fullPage: true })
  await page.locator('#orbit').click()
  assert.equal(await page.locator('#first-person').getAttribute('aria-pressed'), 'false')
  assert.deepEqual(errors, [])
  console.log('Camera checks passed: single-view switching, movement, pause, keyboard modes, grandma, resize, mobile overflow, no page errors.')
} finally {
  await browser.close()
}
