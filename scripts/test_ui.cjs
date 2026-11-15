// =============================================================================
//  WEBSITE SMOKE TEST (Playwright)
// =============================================================================
//  Opens every page in a real browser (desktop and phone size) and fails if a
//  page crashes, logs an error, scrolls sideways, or the AI search reaches the
//  internet. Also checks a shared Lab link restores its settings.
//
//      npm run build && npx vite preview --port 4173 &
//      npm run test:ui
// =============================================================================
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const PAGES = ['home', 'habitat', 'lab', 'data', 'findings', 'ranking', 'questions', 'pipeline', 'search', 'about']

;(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const fails = []
  for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', devices['Pixel 5']]]) {
    const ctx = await browser.newContext(opts)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => fails.push(`${name}: page error ${e.message.slice(0, 160)}`))
    page.on('console', (m) => { if (m.type() === 'error') fails.push(`${name}: console ${m.text().slice(0, 160)}`) })
    for (const p of PAGES) {
      await page.goto(`${BASE}/#/${p}`)
      await page.waitForTimeout(p === 'lab' || p === 'home' ? 2500 : 900)
      const h1 = await page.locator('h1').first().innerText().catch(() => '')
      if (!h1) fails.push(`${name} ${p}: no heading rendered`)
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      const vw = await page.evaluate(() => window.innerWidth)
      if (sw > vw + 1) fails.push(`${name} ${p}: scrolls sideways (${sw} > ${vw})`)
      console.log(`  ${name.padEnd(7)} ${p.padEnd(9)} ok`)
    }
    await ctx.close()
  }
  // A shared Lab link restores its settings.
  {
    const page = await browser.newPage()
    const link = encodeURIComponent(JSON.stringify({ s: 'solid', m: 'SIBAL', c: { flow: '1.01' } }))
    await page.goto(`${BASE}/#/lab/${link}`); await page.waitForTimeout(2500)
    const label = await page.locator('section.card h3').first().innerText().catch(() => '')
    if (!/flamelets/i.test(label)) fails.push(`shared Lab link did not restore SIBAL at 1.01 cm/s (got "${label}")`)
    else console.log('  shared Lab link restores settings: ok')
    await page.close()
  }
  // The AI search answers without any request leaving the site.
  {
    const page = await browser.newPage()
    const outside = []
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) outside.push(u) })
    await page.goto(`${BASE}/#/search`); await page.waitForTimeout(800)
    await page.fill('input[aria-label="Search question"]', 'flames that went out when the airflow was turned down')
    await page.click('form button.btn-primary')
    await page.waitForSelector('ol li a', { timeout: 120000 }).catch(() => fails.push('AI search returned no results'))
    if (outside.length) fails.push(`AI search contacted other sites: ${outside.join(', ')}`)
    else console.log('  AI search offline: ok')
    await page.close()
  }
  // No WebGL at all (getContext returns null): Home and Lab still render, as 2D schematics.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/i.test(String(type)) ? null : orig.call(this, type, ...rest)
      }
    })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
    for (const p of ['home', 'lab']) {
      await page.goto(`${BASE}/#/${p}`); await page.waitForTimeout(2000)
      const h1 = await page.locator('h1').first().innerText().catch(() => '')
      const svg = await page.locator('svg[aria-label^="2D schematic"]').count()
      if (!h1 || !svg) fails.push(`no WebGL: ${p} did not render its 2D schematic (heading "${h1}", schematics ${svg})`)
      else console.log(`  no WebGL: ${p} renders 2D schematic: ok`)
    }
    if (errs.length) fails.push(`no WebGL: page errors ${errs.join(' | ')}`)
    await ctx.close()
  }
  // Strict PSI mode is the default; the Lab shows the drawn test's telemetry and the disclosure.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${BASE}/#/lab`); await page.waitForTimeout(2500)
    const pill = await page.getByRole('button', { name: 'Data Mode: 100% NASA PSI Strict' }).filter({ visible: true }).count()
    const hud = await page.locator('text=Empirical PSI Telemetry Overlay').count()
    const badge = await page.locator('text=Visual Regime Reconstruction: Ray-marched GLSL representation driven by discrete NASA PSI test parameters (non-interpolated, non-CFD).').count()
    const doi = await page.locator('text=/DOI 10\\.60555\\//').count()
    if (!pill || !hud || !badge || !doi) fails.push(`strict mode / Lab telemetry missing (pill ${pill}, overlay ${hud}, badge ${badge}, DOI ${doi})`)
    else console.log('  strict mode default, Lab telemetry overlay and disclosure: ok')
    await page.goto(`${BASE}/#/lunar-habitat`); await page.waitForTimeout(800)
    if (!/#\/habitat/.test(page.url())) fails.push(`alias #/lunar-habitat did not redirect (at ${page.url()})`)
    else console.log('  route alias #/lunar-habitat -> #/habitat: ok')
    await page.close()
  }
  // Search still answers (by keywords) when the AI model cannot load.
  {
    const page = await browser.newPage()
    await page.route(/\/(models|ort)\//, (r) => r.abort())
    await page.goto(`${BASE}/#/search`); await page.waitForTimeout(800)
    await page.fill('input[aria-label="Search question"]', 'silicone burned on Earth')
    await page.click('form button.btn-primary')
    const ok = await page.waitForSelector('text=Keyword fallback', { timeout: 20000 }).then(() => true, () => false)
    const n = await page.locator('section:has(h2:has-text("Closest matches")) ol li').count()
    if (!ok || !n) fails.push(`search fallback failed (notice ${ok}, results ${n})`)
    else console.log(`  search keyword fallback with the model blocked: ok (${n} results)`)
    await page.close()
  }
  // A page that crashes must not blank the site: the menu stays and works.
  // (Regression: an old cached tests.json once turned the Pipeline page white.)
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.route(/data\/tests\.json/, async (route) => {
      const res = await route.fetch(); const rows = await res.json()
      for (const r of rows) { delete r.psi_raw_fields; r.raw = {}; if (r.psi_id === 'PSI-25') r.normalized.flow_sequence_cm_s = null }
      await route.fulfill({ response: res, body: JSON.stringify(rows) })
    })
    await page.goto(`${BASE}/#/pipeline`); await page.waitForTimeout(2000)
    const alert = await page.locator('[role=alert]').count()
    const links = await page.locator('header nav a:visible').count()
    await page.locator('header nav a[href="#/findings"]').click().catch(() => {}); await page.waitForTimeout(1000)
    const h1 = await page.locator('h1').first().innerText().catch(() => '')
    if (!alert || links < 5 || h1 !== 'Findings') fails.push(`page crash blanked the site (message ${alert}, menu links ${links}, next page "${h1}")`)
    else console.log('  a crashing page keeps the menu working: ok')
    await page.close()
  }
  // Data requests carry the build id, so no cache can mix old data with new code.
  {
    const page = await browser.newPage(); const urls = []
    page.on('request', (r) => { if (/\/data\/[a-z_]+\.json/.test(r.url())) urls.push(r.url()) })
    await page.goto(`${BASE}/#/pipeline`); await page.waitForTimeout(1500)
    if (!urls.length || urls.some((u) => !/\?v=/.test(u))) fails.push(`data requested without a build id: ${urls.filter((u) => !/\?v=/.test(u)).join(', ')}`)
    else console.log('  data requests carry the build id: ok')
    await page.close()
  }
  await browser.close()
  if (fails.length) { console.log('\nFAILED:\n  ' + fails.join('\n  ')); process.exit(1) }
  console.log('\nAll website checks passed.')
})()
