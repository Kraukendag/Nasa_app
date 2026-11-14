// =============================================================================
//  DATA LIBRARY · MATERIALS VIEW  ("Discover Materials")
// =============================================================================
//  One card for every material and fuel that was actually tested -- never for
//  one that was not. Each card says how it behaved in microgravity, what the
//  normal-gravity reference shows where one exists, which mission environments
//  its tests cover, and how much evidence stands behind it.
//
//  Safety statements are only those the data supports. In particular, nothing
//  here claims a material "does not burn on Earth but burns in space" unless a
//  test shows it; the one clear gravity reversal in this data (silicone) runs
//  the other way.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'
import type { MaterialCard } from '../../types'
import { OUTCOME_MEANINGS } from '../../outcomes'

const STATES = ['solid', 'liquid', 'gas', 'smoke', 'aerosol']
const CONF: Record<string, string> = { high: 'badge-ok', medium: 'badge-ok', low: 'badge-warn', 'conditions only': 'badge-dead' }
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
  const test1 = data.investigations.find((i) => i.psi_id === 'PSI-25')?.objectives

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1500px] mx-auto p-4 sm:p-6 space-y-5">
        <div className="panel-flat px-3 py-2 text-[11px] text-star">
          Research data summary — not a material certification or a safety approval.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATES.map((s) => (
            <button key={s} onClick={() => setState(s)} className={`btn !py-1 text-[11px] capitalize ${state === s ? 'btn-active' : ''}`}>
              {s} <span className="tabular opacity-60">{data.materials.filter((m) => m.fuel_state === s).length}</span>
            </button>
          ))}
          <span className="w-px h-5 bg-edge mx-1" />
          {([['all', 'All'], ['outcomes', 'Has recorded outcomes'], ['gravity', 'Tested in both 0 g and 1 g']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setOnly(k)} className={`btn !py-1 text-[11px] ${only === k ? 'btn-active' : ''}`}>{l}</button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as 'tests' | 'name')}
                  className="ml-auto bg-navy/60 border border-edge rounded px-2 py-1 text-[11px] text-slate-200">
            <option value="tests">Most tested first</option><option value="name">A–Z</option>
          </select>
        </div>

        {state === 'solid' && test1 && (
          <p className="text-[11px] text-mute leading-relaxed max-w-4xl">
            <span className="text-slate-300">Why microgravity results matter for material screening:</span> BASS-II set out to
            “bridge the gap between the normal gravity NASA-STD-6001 Test #1 method, ground-based microgravity tests, and actual
            material flammability in microgravity” (PSI-25 record). The 0 g vs 1 g rows below show where that gap is visible.
          </p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
          {cards.map((m) => <Card key={m.id} m={m} labels={data.findings.outcome_labels} onShowRows={() => onShowRows(m.name)} />)}
        </div>
        {!cards.length && <p className="text-sm text-mute">No materials match these filters.</p>}

        <section className="panel p-4">
          <div className="label mb-1.5">Materials with no tests here</div>
          <p className="text-[11px] text-slate-300">
            Electronics, wiring insulation, foams and packaging appear in no table in this dataset, so they have no card.
            That absence is listed under Insights → Open questions rather than filled in.
          </p>
        </section>
      </div>
    </div>
  )
}

function Card({ m, labels, onShowRows }: { m: MaterialCard; labels: Record<string, string>; onShowRows: () => void }) {
  const outcomes = Object.entries(m.outcome_classes).sort((a, b) => b[1] - a[1])
  const total = outcomes.reduce((s, [, c]) => s + c, 0)
  const ranges: [string, string | null][] = [
    ['Oxygen', rng(m.o2_range, '%')], ['Airflow', rng(m.flow_range, ' cm/s')],
    ['Pressure', rng(m.pressure_kpa_range, ' kPa')], ['Smoke growth Rt/R₀', rng(m.rt_r0_range, '')],
    ['Burn time', rng(m.burn_time_range, ' s')],
  ]
  return (
    <article className="panel p-4 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{m.name}</h3>
          <div className="text-[10px] text-mute mt-0.5">{m.fuel_state} · {m.test_count} tests · {m.investigations.join(', ')}</div>
        </div>
        <span className={`badge ${CONF[m.confidence.level] ?? 'badge-dead'}`} title={m.confidence.reason}>{m.confidence.level}</span>
      </header>
      <p className="text-[11px] text-slate-300 leading-relaxed">{m.summary}</p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {ranges.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt className="text-[10px] text-mute">{k}</dt><dd className="tabular text-slate-200">{v}</dd></div>
        ))}
        {m.geometries.length > 0 && <div className="col-span-2"><dt className="text-[10px] text-mute">Shapes tested</dt><dd className="text-slate-200">{m.geometries.join(', ')}
          {m.dimensions.diameter_mm.length > 0 && <span className="text-mute"> · ⌀ {m.dimensions.diameter_mm.join(', ')} mm</span>}</dd></div>}
      </dl>

      {outcomes.length > 0 && (
        <div>
          <div className="label mb-1">Microgravity outcomes ({total})</div>
          <div className="space-y-1">
            {outcomes.slice(0, 4).map(([cls, c]) => (
              <div key={cls} title={OUTCOME_MEANINGS[cls]}>
                <div className="flex justify-between text-[10.5px]"><span className="text-slate-300">{labels[cls] ?? cls}</span><span className="tabular text-mute">{c}</span></div>
                <div className="h-1 rounded-full bg-navy overflow-hidden"><div className="h-full bg-cryo" style={{ width: `${(c / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.gravity_comparisons.length > 0 && (
        <div className="panel-flat p-2.5">
          <div className="label mb-1">Earth (1 g) vs microgravity, same sample</div>
          {m.gravity_comparisons.map((g) => (
            <div key={g.test} className="text-[10.5px] text-slate-300 flex gap-2">
              <span className="font-mono text-cryo w-8 shrink-0">{g.test}</span>
              <span>0 g: {g.burn_length_0g} · 1 g: {g.burn_length_1g}</span>
            </div>
          ))}
          <div className="text-[9.5px] text-mute mt-1">PSI-99 SAFFIRE-II</div>
        </div>
      )}

      <div>
        <div className="label mb-1">Mission environments</div>
        <div className="space-y-0.5 text-[10.5px]">
          {([['iss', 'ISS cabin'], ['lunar_habitat', 'Lunar habitat'], ['spacesuit', 'Spacesuit']] as const).map(([k, l]) => {
            const c = m.mission_context[k]
            const ok = c?.status === 'tested'
            return (
              <div key={k} className="flex gap-1.5" title={c?.note}>
                <span className={ok ? 'text-cryo' : 'text-flame'}>{ok ? '✓' : '✕'}</span>
                <span className="text-slate-300">{l}</span>
                <span className="text-mute truncate">— {c?.note}</span>
              </div>
            )
          })}
        </div>
      </div>

      <footer className="mt-auto pt-2 border-t border-edge/60 flex items-center justify-between text-[10px]">
        <span className="text-mute">{m.anomaly_count} data-quality flags</span>
        <button onClick={onShowRows} className="text-cryo hover:underline">View rows →</button>
      </footer>
    </article>
  )
}
