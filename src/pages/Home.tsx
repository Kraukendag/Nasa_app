// =============================================================================
//  HOME
// =============================================================================
//  The 3D match, three findings from the data, a map of the site, and the
//  size of the evidence. A judge should get the point within ten seconds.
// =============================================================================

import { lazy, Suspense, useState } from 'react'
import type { Dataset } from '../data'
import { Fig, LitCite, PsiCite, Stat } from '../ui'
import FlammabilityMap from '../components/FlammabilityMap'
import SiliconeChart from '../components/SiliconeChart'

// Three.js is loaded only when a 3D view is on screen.
const MatchScene = lazy(() => import('../components/MatchScene'))
import WebGLErrorBoundary, { isWebGLAvailable } from '../components/WebGLErrorBoundary'
import MatchSceneFallback2D from '../three/MatchSceneFallback2D'

const SITE = [
  ['#/habitat', 'Lunar habitat', 'Five evidence-backed recommendations for a habitat at 30% oxygen and one-sixth gravity.'],
  ['#/lab', 'Experiment Lab', 'Pick a material and the conditions NASA recorded; watch it burn and see how the real tests ended.'],
  ['#/data', 'Data', 'All 1,450 records, profiles of the 14 investigations, and a card for every material tested.'],
  ['#/findings', 'Findings', 'What the data shows, what failed, what surprised, and verified results from beyond PSI.'],
  ['#/ranking', 'Ranking', 'Which investigations matter most for a mission, with every step of the scoring explained.'],
  ['#/questions', 'Research questions', 'Fifty-plus open questions where knowledge about fire in space is still missing.'],
  ['#/search', 'AI search', 'Ask in your own words; a small AI model in your browser finds the closest records, findings and questions.'],
  ['#/pipeline', 'Pipeline', 'How the data was built, and where AI did the work: reading a 144-page NASA report.'],
]

export default function Home({ data }: { data: Dataset }) {
  const [lit, setLit] = useState(false)
  const [gravityOn, setGravityOn] = useState(true)
  // 2D schematic when the device has no WebGL, when 3D fails, or on request.
  const [use2D, setUse2D] = useState(() => !isWebGLAvailable().webgl1)
  const withOutcome = data.tests.filter((t) => t.normalized.outcome_class).length
  const bc = data.findings.bass2_counts
  const f = data.findings
  const pmmaTests = data.tests.filter((t) => t.psi_id === 'PSI-25' && t.normalized.material === 'PMMA')
  const noHighlight = new Set<string>()
  const pmmaCard = data.materials.find((m) => m.id === 'PMMA|solid')?.lowest_sustained_o2
  const example = data.tests.find((t) => t.psi_id === 'PSI-25' && t.test_number === (pmmaCard?.test ?? 'O4'))
  const examplePage = (example?.normalized.outcome_source ?? '').match(/p\. (\d+)/)?.[1]
  const pmma = data.materials.find((m) => m.id === 'PMMA|solid')?.lowest_sustained_o2

  return (
    <div className="enter">
      {/* ---------------- Hero ---------------- */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-12 grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <p className="eyebrow">NASA Space Apps Challenge 2026 · Flame in Freefall</p>
          <h1 className="h1 mt-3">Earth's fire test can misjudge a material in space, in both directions</h1>
          <p className="lede mt-5 max-w-xl">
            Spacecraft materials are approved by burning them in normal gravity. NASA results show that test can be wrong both
            ways: a cellulose fuel kept burning at 14% oxygen in spacecraft-like airflow, below its 16.5% Earth limit, while
            silicone burned on Earth but barely in space. In orbit, PMMA kept burning at just {pmma ? `${pmma.o2}%` : 'low'} oxygen.
          </p>
          <p className="text-ink2 mt-4 max-w-xl">
            Micro Flamma brings together {data.tests.length.toLocaleString()} NASA records, including {bc.observations} test
            observations that AI helped extract from a NASA report ({bc.endings_report} of them say how the test ended), to show
            what was measured, what it means for a lunar habitat, and what is still unknown.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <a href="#/habitat" className="btn btn-primary no-underline hover:no-underline">What it means for a lunar habitat</a>
            <a href="#/lab" className="btn no-underline hover:no-underline">Open the Experiment Lab</a>
          </div>
        </div>

        <figure className="figure">
          <div className="viewport h-[360px] sm:h-[440px] rounded-none">
            <Suspense fallback={<div className="h-full grid place-items-center text-slate-400 text-sm">Loading 3D view…</div>}>
              {use2D ? <MatchSceneFallback2D lit={lit} gravityOn={gravityOn} /> : (
                <WebGLErrorBoundary fallback={<MatchSceneFallback2D lit={lit} gravityOn={gravityOn} />} onError={() => setUse2D(true)}>
                  <MatchScene lit={lit} gravityOn={gravityOn} onContextLost={() => setUse2D(true)} />
                </WebGLErrorBoundary>
              )}
            </Suspense>
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setLit((v) => !v)} className="px-4 py-2 rounded-md text-sm font-medium bg-white text-ink hover:bg-slate-100">
                {lit ? 'Put out' : 'Strike the match'}
              </button>
              <div className="flex rounded-md overflow-hidden border border-white/20 text-sm">
                <button onClick={() => setGravityOn(true)} className={`px-3 py-2 ${gravityOn ? 'bg-white text-ink' : 'text-slate-200 hover:bg-white/10'}`}>Gravity on (1 g)</button>
                <button onClick={() => setGravityOn(false)} className={`px-3 py-2 ${!gravityOn ? 'bg-white text-ink' : 'text-slate-200 hover:bg-white/10'}`}>Microgravity</button>
              </div>
              <button onClick={() => setUse2D((v) => !v)}
                      className="px-3 py-2 rounded-md text-sm text-slate-200 border border-white/20 hover:bg-white/10">
                {use2D ? 'Switch to 3D WebGL' : 'Switch to 2D schematic'}
              </button>
            </div>
          </div>
          <figcaption className="figcap">
            <b>Fig. 1.</b> {gravityOn
              ? 'With gravity, buoyancy stretches the flame into a rising teardrop that glows yellow with soot.'
              : 'Without gravity nothing rises and oxygen arrives only by diffusion: the flame is smaller, dimmer and rounder, wrapped around the burning wood.'}
            {' '}Drag to rotate. Illustration; there is no slider for Moon or Mars gravity because NASA's PSI holds no partial-gravity combustion data.
          </figcaption>
        </figure>
      </section>

      {/* ---------------- The evidence: data first ---------------- */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 pb-12">
        <h2 className="h2">The evidence, straight from NASA's tables</h2>
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <Fig n={2} caption={<>Every BASS-II PMMA test by oxygen and airflow, marked by how it ended. The lowest oxygen with an
            established flame was {pmma ? `${pmma.o2}% (test ${pmma.test})` : 'not recorded'}. No boundary is fitted: the points are the evidence.</>}
               source="PSI-25 BASS-II table; endings from NASA/TM-20210011385 App. A.">
            <div className="p-3 sm:p-4">
              <FlammabilityMap tests={pmmaTests} highlight={noHighlight} selectedO2={null} selectedFlow={null} />
            </div>
          </Fig>
          <Fig n={3} caption={<>The same four silicone samples burned in microgravity and at 1 g. In space all four left about 0 cm
            burned; on Earth two burned completely. Earth testing misjudged this material. Caveat: four samples, all near the oxygen
            limit (21.5–22.1% O₂).</>} source="PSI-99 SAFFIRE-II, samples 2-1 to 2-4, burn-length columns.">
            <div className="p-3 sm:p-4"><SiliconeChart data={data} /></div>
          </Fig>
        </div>
      </section>

      {/* ---------------- Where AI did the work ---------------- */}
      <section className="border-t border-rule bg-card">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12 grid lg:grid-cols-[1fr_1.2fr] gap-10">
          <div>
            <p className="eyebrow">The AI part</p>
            <h2 className="h2 mt-1">AI turned a 144-page NASA report into data</h2>
            <p className="text-ink2 mt-3">
              BASS-II, the largest solid-fuel experiment here, records the conditions of every test but not how it ended. The
              endings existed only as notes in the report's test tables. AI read those pages and transcribed {bc.observations}{' '}
              observations word for word, each with its page; written rules then sorted {bc.endings_report} of them into endings.
              Without this step the oxygen-limit chart above could not exist.
            </p>
            <ul className="mt-4 space-y-1.5 small text-ink2">
              <li><b className="text-ink">Checked:</b> the PSI table's own airflow notes agree on {f.cross_check.agree} of {f.cross_check.checked} tests; 10 of 10 rows spot-checked against the PDF.</li>
              <li><b className="text-ink">Not invented:</b> AI created no values; it transcribed and sorted. NASA's words are shown beside every ending.</li>
              <li><b className="text-ink">In the browser:</b> an AI search finds records and questions by meaning, entirely offline. It only retrieves; it never writes answers.</li>
            </ul>
            <a href="#/pipeline" className="inline-block mt-4">See the full pipeline and the checks →</a>
          </div>
          <figure className="figure self-start">
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
              <div className="p-4 bg-wash/50">
                <p className="caption font-medium text-ink2">NASA report, test {example?.test_number}, p. {examplePage}</p>
                <blockquote className="small mt-2 border-l-2 border-accent pl-3">“{example?.normalized.outcome_text}”</blockquote>
              </div>
              <div className="p-4">
                <p className="caption font-medium text-ink2">Row on this site</p>
                <dl className="small mt-2 space-y-1 num">
                  <div>direction: {example?.normalized.flow_direction}</div>
                  <div>O₂: {example?.normalized.o2_percent}%</div>
                  <div>ending: {example?.normalized.outcome}</div>
                </dl>
              </div>
            </div>
            <figcaption className="figcap"><b>Fig. 4.</b> One of {bc.observations} transcriptions: the report's note (left) becomes a
              searchable, citable row (right). <span className="text-mute">Source: NASA/TM-20210011385, Appendix A.</span></figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------- Findings ---------------- */}
      <section className="border-y border-rule bg-card">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
          <h2 className="h2">Three things the data shows</h2>
          <ol className="grid md:grid-cols-3 gap-8 mt-7">
            {data.findings.key_insights.map((k, i) => (
              <li key={k.id} className="md:border-l md:border-rule md:pl-6 first:md:border-l-0 first:md:pl-0">
                <div className="num text-accent text-sm">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="font-serif text-[21px] leading-snug font-semibold mt-1">{k.headline}</h3>
                <p className="text-ink2 mt-3">{k.detail}</p>
                <div className="mt-3 space-y-1">
                  <PsiCite data={data} psi={k.psi_id} />
                  {k.lit.filter((l) => l !== 'BASS2_TM').map((l) => <div key={l}><LitCite data={data} keyName={l} /></div>)}
                </div>
              </li>
            ))}
          </ol>
          <a href="#/findings" className="inline-block mt-8">All findings, negative results and coverage gaps</a>
        </div>
      </section>

      {/* ---------------- Site map ---------------- */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
        <h2 className="h2">What is inside</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-7 mt-7">
          {SITE.map(([href, title, text]) => (
            <a key={href} href={href} className="group no-underline hover:no-underline block">
              <div className="h3 text-ink group-hover:text-accent transition-colors">{title}</div>
              <p className="text-ink2 mt-1.5">{text}</p>
            </a>
          ))}
        </div>
      </section>

      {/* ---------------- Evidence ---------------- */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 pb-16">
        <div className="card p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
          <Stat value={data.tests.length.toLocaleString()} label="records from 14 PSI tables" />
          <Stat value={withOutcome} label="tests with a recorded ending" />
          <Stat value={`${bc.observations} / ${bc.endings_report}`} label="observations / endings AI extracted from NASA's BASS-II report" />
          <Stat value={`${data.literature.points.length} + ${data.literature.saffire_iv_vi.length}`} label="measured results + test conditions from NASA work beyond PSI" />
          <Stat value={data.findings.research_questions.length} label="open research questions" />
        </div>
      </section>
    </div>
  )
}
