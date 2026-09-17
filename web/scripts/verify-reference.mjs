import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.dirname(web)
const baseline = 'c9a9fe373cde72c77ff7f2dabde17fb79dce89b3'
const url = process.env.COMPARISON_URL || 'http://localhost:3020'
const output = path.resolve(process.argv[2] || process.env.COMPARISON_EVIDENCE || 'reference-verification')
assert(process.env.PLAYWRIGHT_MODULE, 'Set PLAYWRIGHT_MODULE to an installed Playwright module')
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE)
await mkdir(output, { recursive: true })

const results = { url, baseline, started: new Date().toISOString(), checks: [], viewports: [] }
const check = (name, passed, detail) => results.checks.push({ name, passed: Boolean(passed), detail })
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const original = file => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: repo, maxBuffer: 128 * 1024 * 1024 })
const parseGlb = bytes => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
}
const unchanged = [
  'web/src/scene/Scene.tsx', 'web/src/scene/Env.tsx', 'web/src/styles.css',
  'web/src/data/focusPoints.ts', 'web/src/store.ts', 'web/vite.config.ts', 'web/package.json', 'web/package-lock.json',
]
for (const file of unchanged) {
  const current = await readFile(path.join(repo, file))
  check(`Unchanged ${file}`, current.equals(original(file)), { sha256: sha256(current) })
}
const canvasProps = source => source.match(/<Canvas\b([\s\S]*?)>\s*<color/)?.[1]
const currentApp = await readFile(path.join(web, 'src/App.tsx'), 'utf8')
const initialCanvas = canvasProps(original('web/src/App.tsx').toString())
check('Original Canvas configuration', initialCanvas && canvasProps(currentApp) === initialCanvas)

const modelBytes = await readFile(path.join(web, 'public/models/me.glb'))
const modelHash = sha256(modelBytes)
const model = parseGlb(modelBytes)
const oldModelBytes = original('web/public/models/me.glb')
const oldModel = parseGlb(oldModelBytes)
const requiredNames = ['Camera', 'man', 'focus-0', 'focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5', 'focus-works']
check('Camera, animation carrier, and seven focus anchors', requiredNames.every(name => model.nodes.some(node => node.name === name)))
check('Original authored camera', JSON.stringify(model.cameras) === JSON.stringify(oldModel.cameras), model.cameras)
check('Original animation clip names', JSON.stringify(model.animations.map(clip => clip.name).sort()) === JSON.stringify(['CameraAction', 'manAction']))
check('Conny character replaces the source mesh', !modelBytes.equals(oldModelBytes) && model.nodes.some(node => /Conny/i.test(node.name || '')), { bytes: modelBytes.length, sha256: modelHash })
check('No substituted eye tracking geometry', !model.nodes.some(node => /eye/i.test(node.name || '')))

const authorIdentity = /About Sen|Sen Zheng|郑越升|HOTSAR|坏打印机|Bad Printer|小郑还挺忙|ZOOOP|Based in Shenzhen/i
const expectedRepositories = [
  'Airway-Management-Assistant', 'speciesOT', 'job-search-2026-2027-starter', 'scgen-cellot-autoresearch',
]
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' })
    const page = await context.newPage()
    const result = { name, width, height, errors: [], failedRequests: [], samples: [], works: [] }
    results.viewports.push(result)
    page.on('pageerror', error => result.errors.push({ source: 'page', message: error.message }))
    page.on('console', message => { if (message.type() === 'error') result.errors.push({ source: 'console', message: message.text(), location: message.location() }) })
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }))
    page.on('response', response => { if (response.status() >= 400) result.failedRequests.push({ url: response.url(), status: response.status() }) })
    await page.addInitScript(() => {
      window.referenceFrame = null
      window.__THREE_DEVTOOLS__ = new EventTarget()
      window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
        if (!detail.isWebGLRenderer) return
        const render = detail.render
        detail.render = function (scene, camera) {
          if (scene.getObjectByName?.('Camera') && camera.isPerspectiveCamera) {
            window.referenceFrame = {
              camera: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov,
              man: scene.getObjectByName('man')?.quaternion.toArray(),
            }
          }
          return render.call(this, scene, camera)
        }
      })
    })
    try {
      const modelResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/models/me.glb'), { timeout: 60000 })
      await page.goto(url)
      const response = await modelResponse
      check(`${name}: served prepared model`, response.ok() && sha256(await response.body()) === modelHash)
      await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 60000 })
      await page.waitForFunction(() => window.referenceFrame?.man, undefined, { timeout: 30000 })
      await page.mouse.move(width / 2, height / 2)
      const copy = await page.locator('body').innerText()
      check(`${name}: Conny identity`, /Conny/i.test(await page.title()) && /Conny/i.test(await page.locator('h1').innerText()))
      check(`${name}: no source author's personal biography`, !authorIdentity.test(copy))
      check(`${name}: five timeline entries`, await page.locator('[data-point]').count() === 5)

      for (const point of ['hero', 'focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5', 'works']) {
        await page.evaluate(point => {
          const target = point === 'hero' ? 0 : point === 'works'
            ? document.querySelector('.wk-gallery').getBoundingClientRect().top + scrollY + innerWidth
            : document.querySelector(`[data-point="${point}"]`).getBoundingClientRect().top + scrollY - innerHeight * 0.3
          scrollTo({ top: target, behavior: 'instant' })
        }, point)
        await page.waitForTimeout(2000)
        const sample = await page.evaluate(() => ({
          frame: window.referenceFrame, scroll: scrollY, width: document.documentElement.scrollWidth, viewport: innerWidth,
          headings: [...document.querySelectorAll('h1,h2,h3')].map(element => element.textContent),
        }))
        result.samples.push({ point, ...sample })
        check(`${name}: ${point} renders with original camera FOV`, Math.abs(sample.frame.fov - 22.89519204617112) < 0.00001, sample.frame)
        check(`${name}: ${point} has no horizontal overflow`, sample.width <= sample.viewport + 1, { width: sample.width, viewport: sample.viewport })
        await page.screenshot({ path: path.join(output, `${name}-${point}.png`) })
      }
      check(`${name}: camera moves through native scroll stops`, result.samples.slice(1).every((sample, index) => distance(sample.frame.camera, result.samples[index].frame.camera) > 0.01))
      check(`${name}: manAction turns character in works`, distance(result.samples[0].frame.man, result.samples.at(-1).frame.man) > 0.1)

      const cards = page.locator('.wk-card')
      check(`${name}: four real works`, await cards.count() === 4 && await page.locator('.wk-line-btn').count() === 4)
      for (let index = 0; index < 4; index++) {
        await page.evaluate(index => {
          const card = document.querySelectorAll('.wk-card')[index]
          if (innerWidth <= 640) {
            scrollTo({ top: card.getBoundingClientRect().top + scrollY, behavior: 'instant' })
          } else {
            const gallery = document.querySelector('.wk-gallery')
            const track = document.querySelector('.wk-track')
            const relativeLeft = card.getBoundingClientRect().left - track.getBoundingClientRect().left
            scrollTo({ top: gallery.getBoundingClientRect().top + scrollY + relativeLeft, behavior: 'instant' })
          }
        }, index)
        await page.waitForTimeout(500)
        const before = await page.evaluate(() => ({ scroll: scrollY, overflow: document.body.style.overflow }))
        await cards.nth(index).locator('.wk-line-btn').click()
        const modal = page.locator('.wk-detail')
        await modal.waitFor({ state: 'visible' })
        await page.waitForTimeout(500)
        const detail = await modal.evaluate(element => ({
          title: element.querySelector('.wk-detail-title')?.textContent,
          content: element.querySelector('.wk-md')?.textContent,
          href: element.querySelector('a.wk-detail-link')?.href,
          placeholder: Boolean(element.querySelector('.wk-detail-ph-img, .wk-detail-link.is-ph, .wk-detail-banner.is-ph')),
          locked: document.body.style.overflow === 'hidden',
          brokenImages: [...element.querySelectorAll('img')].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
        }))
        result.works.push(detail)
        check(`${name}: work ${index + 1} has authored detail and repository CTA`, detail.content?.length > 100 && !detail.placeholder && !authorIdentity.test(detail.content) && detail.href === `https://github.com/JunyiZhou-Conny/${expectedRepositories[index]}`, detail)
        check(`${name}: work ${index + 1} images load and modal locks scroll`, detail.brokenImages.length === 0 && detail.locked)
        await page.screenshot({ path: path.join(output, `${name}-work-${index + 1}.png`) })
        if (index % 2) await page.keyboard.press('Escape')
        else await page.locator('.wk-detail-close').click()
        await modal.waitFor({ state: 'detached' })
        const after = await page.evaluate(() => ({ scroll: scrollY, overflow: document.body.style.overflow }))
        await page.mouse.wheel(0, -100)
        await page.waitForTimeout(400)
        const scroll = await page.evaluate(() => scrollY)
        check(`${name}: work ${index + 1} closes and restores native scroll`, before.overflow === after.overflow && Math.abs(before.scroll - after.scroll) < 2 && scroll < after.scroll - 20, { before, after, scroll })
      }
      const brokenImages = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src))
      check(`${name}: all page images load`, brokenImages.length === 0, brokenImages)
    } catch (error) {
      check(`${name}: browser sequence completes`, false, error.stack)
      await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {})
    } finally {
      check(`${name}: no runtime errors`, result.errors.length === 0, result.errors)
      check(`${name}: no failed asset requests`, result.failedRequests.length === 0, result.failedRequests)
      await context.close()
    }
  }
} finally {
  await browser.close()
  results.finished = new Date().toISOString()
  results.passed = results.checks.every(item => item.passed)
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ passed: results.passed, checks: results.checks.length, failures: results.checks.filter(item => !item.passed), output }, null, 2))
}
if (!results.passed) process.exitCode = 1
