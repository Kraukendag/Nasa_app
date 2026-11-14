// =============================================================================
//  DATA · MATERIALS  ("Discover Materials")
// =============================================================================
//  One card for every material and fuel that was actually tested -- never for
//  one that was not. Each card says how it behaved in microgravity, the lowest
//  oxygen at which it kept burning, the attempts that failed, what the
//  normal-gravity reference shows where one exists, verified results from
//  outside PSI (LUCI, Saffire IV-VI) kept visibly separate, which mission
//  environments its tests cover, and how much evidence stands behind it.
//
//  Safety statements are only those the data supports. In particular nothing
//  here claims a material "does not burn on Earth but burns in space" unless a
//  test shows it; the one clear gravity reversal in this data (silicone) runs
//  the other way.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'
import type { MaterialCard } from '../../types'
import { OUTCOME_MEANINGS } from '../../outcomes'

const STATES = ['solid', 'liquid', 'gas', 'smoke', 'aerosol']
const rng = (r: { min: number; max: number } | null, unit: string) =>
  r ? (r.min === r.max ? `${+r.min.toFixed(2)}${unit}` : `${+r.min.toFixed(2)}–${+r.max.toFixed(2)}${unit}`) : null

export default function Materials({ data, onShowRows }: { data: Dataset; onShowRows: (material: string) => void }) {
  const [state, setState] = useState('solid')
  const [only, setOnly] = useState<'all' | 'outcomes' | 'gravity'>('all')
  const [sort, setSort] = useState<'tests' | 'name'>('tests')
  const cards = useMemo(() => data.materials
    .filter((m) => m.fuel_state === state)
    .filter((m) => only === 'all' || (only === 'outcomes' ? Object.keys(m.outcome_classes).length > 0 : m.has_1g_reference))
    .sort((a, b) => (sort === 'tests' ? b.test_count - a.test_count : a.name.localeCompare(b.name))), [data.materials, state, only, sort])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATES.map((s) => (
          <button key={s} onClick={() => setState(s)} className={`chip capitalize ${state === s ? 'chip-on' : ''}`}>
            {s} <span className="num text-[12px] text-mute">{data.materials.filter((m) => m.fuel_state === s).length}</span>
          </button>
        ))}
        <span className="w-px h-5 bg-rule mx-1" />
        {([['all', 'All'], ['outcomes', 'Has recorded outcomes'], ['gravity', 'Tested in both 0 g and 1 g']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnly(k)} className={`chip ${only === k ? 'chip-on' : ''}`}>{l}</button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as 'tests' | 'name')} className="field !w-auto !py-1 ml-auto" aria-label="Sort">
          <option value="tests">Most tested first</option><option value="name">A–Z</option>
        </select>
      </div>

      {state === 'solid' && (
        <p className="small text-ink2 max-w-4xl">
          <b className="text-ink">Why microgravity results matter for material screening.</b> Spacecraft materials are approved
          with NASA-STD-6001 Test 1: a sample burned upward in normal gravity. BASS-II set out to “bridge the gap between the
          normal gravity NASA-STD-6001 Test #1 method, ground-based microgravity tests, and actual material flammability in
          microgravity” (PSI-25 record). The oxygen limits and 0 g vs 1 g rows on these cards show where that gap is visible.
        </p>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((m) => <Card key={m.id} m={m} data={data} onShowRows={() => onShowRows(m.name)} />)}
      </div>
      {!cards.length && <p className="caption">No materials match these filters.</p>}

      <section className="wash p-5">
        <h3 className="h3">Materials with no tests here</h3>
        <p className="small text-ink2 mt-2">
          Electronics, wiring insulation, foams and packaging appear in no table in this dataset, so they have no card.
          That absence is listed among the <a href="#/questions">research questions</a> rather than filled in.
        </p>
      </section>
    </div>
  )
}

function Card({ m, data, onShowRows }: { m: MaterialCard; data: Dataset; onShowRows: () => void }) {
  const labels = data.findings.outcome_labels
  const outcomes = Object.entries(m.outcome_classes).sort((a, b) => b[1] - a[1])
  const total = outcomes.reduce((s, [, c]) => s + c, 0)
  const ranges: [string, string | null][] = [
    ['Oxygen', rng(m.o2_range, '%')], ['Airflow', rng(m.flow_range, ' cm/s')],
    ['Pressure', rng(m.pressure_kpa_range, ' kPa')], ['Smoke growth Rt/R₀', rng(m.rt_r0_range, '')],
    ['Burn time', rng(m.burn_time_range, ' s')],
  ]
  const lit = m.literature
  return (
    <article className="card p-5 flex flex-col gap-4">
      <header>
        <h3 className="h3">{m.name}</h3>
        <p className="caption mt-0.5">{m.fuel_state} · {m.test_count} tests · {m.investigations.join(', ')}</p>
        <p className="caption mt-0.5" title={m.confidence.reason}>Evidence: <b className="text-ink2 font-medium">{m.confidence.level}</b> ({m.confidence.reason})</p>
      </header>
      <p className="small text-ink2">{m.summary}</p>
      {m.caveat && <p className="small"><span className="flag flag-warn">Caveat</span> {m.caveat}</p>}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 small">
        {ranges.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="caption">{k}</dt><dd className="num">{v}</dd></div>)}
        {m.geometries.length > 0 && (
          <div className="col-span-2"><dt className="caption">Shapes tested</dt>
            <dd>{m.geometries.join(', ')}{m.dimensions.diameter_mm.length > 0 && <span className="text-mute"> · ⌀ {m.dimensions.diameter_mm.join(', ')} mm</span>}</dd></div>
        )}
      </dl>

      {(m.lowest_sustained_o2 || (m.failed_attempts && m.failed_attempts.length > 0)) && (
        <div>
          <h4 className="caption font-medium text-ink2">Oxygen limit in microgravity</h4>
          {m.lowest_sustained_o2
            ? <p className="small mt-0.5">Kept burning at <b className="num">{m.lowest_sustained_o2.o2}%</b> O₂ (test {m.lowest_sustained_o2.test}).</p>
            : <p className="small mt-0.5">No recorded test sustained a flame.</p>}
          {m.failed_attempts && m.failed_attempts.length > 0 && (
            <p className="caption mt-0.5">Did not sustain a flame: {m.failed_attempts.map((a) => `${a.o2}% (${a.test})`).join(', ')}. Airflow differed between attempts; see the Lab.</p>
          )}
        </div>
      )}

      {outcomes.length > 0 && (
        <div>
          <h4 className="caption font-medium text-ink2 mb-1">Microgravity outcomes ({total})</h4>
          <div className="space-y-1.5">
            {outcomes.slice(0, 4).map(([cls, c]) => (
              <div key={cls} title={OUTCOME_MEANINGS[cls]}>
                <div className="flex justify-between small"><span>{labels[cls] ?? cls}</span><span className="num text-ink2">{c}</span></div>
                <div className="h-1 rounded-full bg-wash overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(c / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.gravity_comparisons.length > 0 && (
        <div className="wash p-3">
          <h4 className="caption font-medium text-ink2 mb-1">Earth (1 g) vs microgravity, same sample</h4>
          {m.gravity_comparisons.map((g) => (
            <div key={g.test} className="small flex gap-2"><span className="num w-9 shrink-0">{g.test}</span><span>0 g: {g.burn_length_0g} · 1 g: {g.burn_length_1g}</span></div>
          ))}
          <div className="caption mt-1">PSI-99 SAFFIRE-II</div>
        </div>
      )}

      {lit && (lit.points.length > 0 || lit.saffire.length > 0) && (
        <div className="border border-dashed border-rule rounded-md p-3">
          <h4 className="caption font-medium text-ink2 mb-1">Beyond PSI (cited literature, not PSI rows)</h4>
          {lit.points.map((p, i) => (
            <p key={i} className="small">{p.quantity} at {p.g} g: <span className="num">{p.value} {p.unit}</span> vs <span className="num">{p.compare_1g} {p.unit}</span> at 1 g <span className="caption">({p.source})</span></p>
          ))}
          {lit.saffire.map((s) => (
            <p key={s.sample} className="small">Saffire {s.sample}: {s.material}, {s.o2_percent}% O₂ at {s.pressure_kpa} kPa, {s.flow_cm_s} cm/s {s.direction} <span className="caption">(ICES-2024)</span></p>
          ))}
        </div>
      )}

      <div>
        <h4 className="caption font-medium text-ink2 mb-1">Mission environments covered by these tests</h4>
        <ul className="space-y-0.5 small">
          {([['iss', 'ISS cabin'], ['lunar_habitat', 'Lunar habitat'], ['spacesuit', 'Spacesuit']] as const).map(([k, l]) => {
            const c = m.mission_context[k]
            const ok = c?.status === 'tested'
            return (
              <li key={k} className="flex gap-1.5" title={c?.note}>
                <span className={ok ? 'text-[#1f7a4d]' : 'text-accent'} aria-hidden>{ok ? '✓' : '✕'}</span>
                <span>{l}</span><span className="caption truncate">{ok ? 'tested' : 'not tested'}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <footer className="mt-auto pt-3 border-t border-rule flex items-center justify-between small">
        <span className="caption">{m.anomaly_count} data-quality flags</span>
        <button onClick={onShowRows} className="text-accent hover:underline">View rows →</button>
      </footer>
    </article>
  )
}
