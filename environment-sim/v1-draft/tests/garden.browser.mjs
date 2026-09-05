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
  await page.locator('[data-destination="garden"]').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Arrived · garden', undefined, { timeout: 60000 })
  await page.screenshot({ path: '.artifacts/garden-wide.png', fullPage: true })
  await page.locator('#third-person').click()
  await page.screenshot({ path: '.artifacts/garden-third-person.png', fullPage: true })
  await page.locator('#first-person').click()
  await page.locator('[data-destination="living"]').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Arrived · living room', undefined, { timeout: 60000 })
  assert.equal(await page.locator('#scene').getAttribute('data-camera-mode'), 'first-person')
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(errors, [])
  console.log('Garden checks passed: outdoor arrival, return indoors, camera switching, mobile overflow, no page errors.')
} finally {
  await browser.close()
}
