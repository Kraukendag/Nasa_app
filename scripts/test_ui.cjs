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
  await browser.close()
  if (fails.length) { console.log('\nFAILED:\n  ' + fails.join('\n  ')); process.exit(1) }
  console.log('\nAll website checks passed.')
})()
