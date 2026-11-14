// =============================================================================
//  HOME
// =============================================================================
//  The 3D match, three findings from the data, a map of the site, and the
//  size of the evidence. A judge should get the point within ten seconds.
// =============================================================================

import { lazy, Suspense, useState } from 'react'
import type { Dataset } from '../data'
import { LitCite, PsiCite, Stat } from '../ui'

// Three.js is loaded only when a 3D view is on screen.
const MatchScene = lazy(() => import('../components/MatchScene'))

const SITE = [
  ['#/habitat', 'Lunar habitat', 'Five evidence-backed recommendations for a habitat at 30% oxygen and one-sixth gravity.'],
  ['#/lab', 'Experiment Lab', 'Pick a material and the conditions NASA recorded; watch it burn and see how the real tests ended.'],
  ['#/data', 'Data', 'All 1,450 records, profiles of the 14 investigations, and a card for every material tested.'],
  ['#/findings', 'Findings', 'What the data shows, what failed, what surprised, and verified results from beyond PSI.'],
  ['#/ranking', 'Ranking', 'Which investigations matter most for a mission, with every step of the scoring explained.'],
  ['#/questions', 'Research questions', 'Fifty-plus open questions where knowledge about fire in space is still missing.'],
  ['#/pipeline', 'Pipeline', 'How the data was built, and where AI did the work: reading a 144-page NASA report.'],
]

export default function Home({ data }: { data: Dataset }) {
  const [lit, setLit] = useState(false)
  const [gravityOn, setGravityOn] = useState(true)
  const withOutcome = data.tests.filter((t) => t.normalized.outcome_class).length
  const extracted = data.tests.filter((t) => t.psi_id === 'PSI-25' && !!t.normalized.outcome_text && (t.normalized.outcome_source ?? '').startsWith('NASA/TM')).length
  const pmma = data.materials.find((m) => m.id === 'PMMA|solid')?.lowest_sustained_o2

  return (
    <div className="enter">
      {/* ---------------- Hero ---------------- */}
      <section className="max-w-[1400px] mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-12 grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <div>
          <p className="eyebrow">NASA Space Apps Challenge 2026 · Flame in Freefall</p>
          <h1 className="h1 mt-3">Earth's fire test can misjudge a material in space, in both directions</h1>
          <p className="lede mt-5 max-w-xl">
            Spacecraft materials are approved by burning them in normal gravity. In NASA's orbital experiments, PMMA kept
            burning at {pmma ? `${pmma.o2}%` : 'low'} oxygen, and NASA analysis reports flames surviving below the Earth
            oxygen limit in spacecraft-like airflow. Silicone went the other way: it burned on Earth but barely in space.
            Without gravity, hot gas does not rise, and flames behave differently.
          </p>
          <p className="text-ink2 mt-4 max-w-xl">
            Micro Flamma brings together {data.tests.length.toLocaleString()} NASA records, including {extracted} test endings
            that AI helped extract from a NASA report, to show what was measured, what it means for a lunar habitat, and
            what is still unknown.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <a href="#/habitat" className="btn btn-primary no-underline hover:no-underline">What it means for a lunar habitat</a>
            <a href="#/lab" className="btn no-underline hover:no-underline">Open the Experiment Lab</a>
          </div>
        </div>

        <figure className="figure">
          <div className="viewport h-[360px] sm:h-[440px] rounded-none">
            <Suspense fallback={<div className="h-full grid place-items-center text-slate-400 text-sm">Loading 3D view…</div>}>
              <MatchScene lit={lit} gravityOn={gravityOn} />
            </Suspense>
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
              <button onClick={() => setLit((v) => !v)} className="px-4 py-2 rounded-md text-sm font-medium bg-white text-ink hover:bg-slate-100">
                {lit ? 'Put out' : 'Strike the match'}
              </button>
              <div className="flex rounded-md overflow-hidden border border-white/20 text-sm">
                <button onClick={() => setGravityOn(true)} className={`px-3 py-2 ${gravityOn ? 'bg-white text-ink' : 'text-slate-200 hover:bg-white/10'}`}>Gravity on (1 g)</button>
                <button onClick={() => setGravityOn(false)} className={`px-3 py-2 ${!gravityOn ? 'bg-white text-ink' : 'text-slate-200 hover:bg-white/10'}`}>Gravity off (0 g)</button>
              </div>
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
          <Stat value={extracted} label="endings extracted from NASA's BASS-II report" />
          <Stat value={data.literature.saffire_iv_vi.length + data.literature.points.length} label="verified results from beyond PSI" />
          <Stat value={data.findings.research_questions.length} label="open research questions" />
        </div>
      </section>
    </div>
  )
}
