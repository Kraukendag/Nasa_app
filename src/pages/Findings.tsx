// =============================================================================
//  FINDINGS
// =============================================================================
//  What the data shows, in order of importance:
//    1. Key findings          three results a mission planner should know
//    2. Surprises             results that run against expectation
//    3. Beyond PSI            verified results from NASA reports outside the
//                             PSI tables (LUCI, Saffire IV-VI, KC-135), kept
//                             as a separate, cited source type
//    4. What failed           negative knowledge: failed ignitions, sensor
//                             problems, missing records
//    5. Coverage              where tests exist and where none do
//
//  Every statement here was computed by scripts/build_data.py from the rows,
//  or is quoted from a cited NASA document. Nothing is typed in by hand.
// =============================================================================

import type { Dataset } from '../data'
import { Fig, LitCite, Page, PsiCite, Section } from '../ui'

const NEG_TITLES: Record<string, string> = {
  failed_ignition: 'Attempts that never lit',
  unexpected_result: 'Results that ran against expectation',
  instrument_or_record: 'Instrument problems and missing records',
}

export default function Findings({ data }: { data: Dataset }) {
  const f = data.findings
  const lit = data.literature
  const neg = Object.keys(NEG_TITLES).map((k) => [k, f.negative_knowledge.filter((n) => n.category === k)] as const)

  return (
    <Page title="Findings" intro={<>
      What NASA's microgravity combustion records show, what failed, and what has never been tested. Each finding names
      the tests or the document it comes from; results from outside the PSI tables are marked as such.
    </>}>

      <Section title="Key findings">
        <ol className="space-y-5">
          {f.key_insights.map((k, i) => (
            <li key={k.id} className="card p-6 grid sm:grid-cols-[48px_1fr] gap-4">
              <span className="font-serif text-3xl text-accent leading-none">{i + 1}</span>
              <div>
                <h3 className="font-serif text-xl font-semibold">{k.headline}</h3>
                <p className="text-ink2 mt-2">{k.detail}</p>
                <div className="mt-3 flex flex-col gap-1">
                  {k.psi_id && <PsiCite data={data} psi={k.psi_id} />}
                  {k.lit.map((l) => <LitCite key={l} data={data} keyName={l} />)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Surprises in the data">
        <div className="grid md:grid-cols-2 gap-4">
          {f.surprises.map((s) => (
            <article key={s.id} className="card p-5">
              <h3 className="h3">{s.title}</h3>
              <p className="small text-ink2 mt-2">{s.text}</p>
              <p className="caption mt-2 num">
                {String(s.evidence.psi_id ?? '')}{Array.isArray(s.evidence.tests) ? ` · tests ${(s.evidence.tests as string[]).slice(0, 6).join(', ')}${(s.evidence.tests as string[]).length > 6 ? '…' : ''}` : ''}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Beyond PSI: verified results from NASA reports" intro={<>
        The PSI tables stop at 22.2% oxygen for solids and contain no partial-gravity tests. These NASA Technical Reports
        Server documents go further. Their numbers were read from the documents themselves and are kept apart from the
        PSI rows; they are never mixed into PSI counts.
      </>}>
        <div className="space-y-6">
          <Fig n={1} caption={<>Flame spread at simulated lunar gravity (0.16 g) against 1 g, from LUCI, flown on Blue Origin
            New Shepard on 4 February 2025.</>} source={<LitCite data={data} keyName="LUCI" />}>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[520px]">
                <thead><tr><th>Material</th><th>Quantity</th><th className="text-right">0.16 g</th><th className="text-right">1 g</th><th>Change</th></tr></thead>
                <tbody>
                  {lit.points.map((p, i) => (
                    <tr key={i}><td>{p.material}</td><td>{p.quantity}</td>
                      <td className="text-right num">{p.value} {p.unit}</td><td className="text-right num">{p.compare_1g} {p.unit}</td>
                      <td className="num">{Math.round((p.value / p.compare_1g) * 100)}% of the 1 g value</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="px-4 pb-3 pt-1 list-disc pl-8 small text-ink2 space-y-1">{lit.luci_notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </Fig>

          <Fig n={2} caption={<>Saffire IV–VI: large samples burned in uncrewed Cygnus vehicles after leaving the ISS, including
            the first spacecraft fire tests at lunar-habitat-like oxygen and pressure. All in 20 cm/s concurrent flow.</>}
               source={<LitCite data={data} keyName="SAFFIRE_VI_ICES2024" />}>
            <div className="overflow-x-auto">
              <table className="tbl min-w-[560px]">
                <thead><tr><th>Sample</th><th>Material</th><th className="text-right">Length</th><th className="text-right">Pressure</th><th className="text-right">O₂</th></tr></thead>
                <tbody>
                  {lit.saffire_iv_vi.map((r) => (
                    <tr key={r.sample} className={r.o2_percent >= 26 ? 'bg-wash' : ''}>
                      <td className="num">{r.sample}</td><td>{r.material}</td><td className="text-right num">{r.length_cm} cm</td>
                      <td className="text-right num">{r.pressure_kpa} kPa</td><td className="text-right num">{r.o2_percent}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 pb-3 caption">Shaded rows: above the 22.2% O₂ ceiling of every PSI solid-fuel test, near the planned lunar habitat (30% O₂, 70 kPa).</p>
          </Fig>

          <div className="grid md:grid-cols-2 gap-4">
            {lit.statements.map((s, i) => (
              <blockquote key={i} className="card p-5">
                <p className="small text-ink2">{s.text}</p>
                <footer className="mt-2"><LitCite data={data} keyName={s.source} /><span className="caption"> · {s.where}</span></footer>
              </blockquote>
            ))}
          </div>
          <p className="caption">{lit.note}</p>
        </div>
      </Section>

      <Section title="What failed, and what is missing" intro={<>
        Negative results are results. These are attempts that never lit, outcomes nobody expected, and instruments or
        records that did not deliver.
      </>}>
        <div className="space-y-8">
          {neg.map(([k, list]) => list.length > 0 && (
            <div key={k}>
              <h3 className="h3">{NEG_TITLES[k]} <span className="caption num">({list.length})</span></h3>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {list.map((n, i) => (
                  <li key={i} className="py-3 grid md:grid-cols-[1fr_240px] gap-x-6 gap-y-1">
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="small text-ink2">{n.detail}</p>
                    </div>
                    <p className="caption num md:text-right">
                      {n.psi_id}{n.tests.filter(Boolean).length ? ` · ${n.tests.filter(Boolean).slice(0, 4).join(', ')}${n.tests.length > 4 ? '…' : ''}` : ''}
                      {n.source && <><br />{n.source}</>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Where tests exist, and where none do" intro={<>
        Solid-fuel tests in PSI by oxygen level and gravity. Empty cells are hatched: nothing was measured there, so
        nothing can be said.
      </>}>
        <Fig n={3} caption={<>Number of PSI solid-fuel tests in each oxygen band and gravity level. The planned lunar habitat
          sits at about 30% O₂ and 0.16 g: an empty cell for every material.</>} source="computed from the PSI tables">
          <div className="overflow-x-auto p-4">
            <Coverage data={data} />
          </div>
        </Fig>
        <p className="caption mt-3">{f.coverage.pressure_note}</p>
        <h3 className="h3 mt-8">Gaps this dataset cannot fill</h3>
        <ul className="mt-3 list-disc pl-5 space-y-1.5 text-ink2">{f.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        <p className="mt-4"><a href="#/questions">See the research questions these gaps raise →</a></p>
      </Section>
    </Page>
  )
}

function Coverage({ data }: { data: Dataset }) {
  const c = data.findings.coverage
  const materials = Object.keys(c.grid)
  return (
    <table className="text-[13px] border-collapse min-w-[680px]">
      <thead>
        <tr>
          <th className="text-left font-medium text-mute pr-3 pb-2 align-bottom">Material</th>
          {c.gravity.map((g) => <th key={g} colSpan={c.o2_bins.length} className="font-medium text-ink2 pb-1 border-l border-rule px-1">{g}</th>)}
        </tr>
        <tr>
          <th />
          {c.gravity.map((g) => c.o2_bins.map((b, i) => (
            <th key={g + b} className={`font-normal text-[12px] text-mute leading-tight px-0.5 pb-2 ${i === 0 ? 'border-l border-rule' : ''}`}>{b}</th>
          )))}
        </tr>
      </thead>
      <tbody>
        {materials.map((m) => (
          <tr key={m}>
            <td className="pr-3 py-1 whitespace-nowrap">{m}</td>
            {c.gravity.map((g) => c.o2_bins.map((b, i) => {
              const n = c.grid[m].cells[b]?.[g] ?? 0
              return (
                <td key={g + b} className={`text-center py-0.5 px-0.5 ${i === 0 ? 'border-l border-rule' : ''}`}>
                  <span className={`inline-grid place-items-center w-[30px] h-6 rounded-sm num text-[12px] ${n ? 'bg-ink/[0.08] text-ink' : 'hatched text-transparent'}`}
                        title={`${m}, ${b} O₂, ${g}: ${n} tests`}>{n || '0'}</span>
                </td>
              )
            }))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
