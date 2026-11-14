// =============================================================================
//  DATA LIBRARY · INVESTIGATIONS VIEW
// =============================================================================
//  One card per investigation: what it was for, what hardware it flew on, what
//  it varied, what instruments its table shows, and how complete its outcomes
//  are. Tick two cards to compare them side by side.
//
//  "Instruments" lists only what the table itself evidences (a column, or a
//  note naming the instrument), with the basis given -- never a guess about
//  what the hardware probably carried.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'
import type { Investigation } from '../../types'

const rng = (r: { min: number; max: number } | null, unit: string, d = 1) =>
  r ? (r.min === r.max ? `${+r.min.toFixed(d)}${unit}` : `${+r.min.toFixed(d)}–${+r.max.toFixed(d)}${unit}`) : 'not recorded'

export default function Investigations({ data, onShowRows }: { data: Dataset; onShowRows: (psi: string) => void }) {
  const [compare, setCompare] = useState<string[]>([])
  const [state, setState] = useState<string>('all')
  const list = useMemo(() => data.investigations.filter((i) => state === 'all' || i.fuel_state === state), [data.investigations, state])
  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)))
  const pair = compare.map((id) => data.investigations.find((i) => i.psi_id === id)!).filter(Boolean)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1500px] mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'solid', 'liquid', 'gas', 'smoke', 'aerosol'].map((s) => (
            <button key={s} onClick={() => setState(s)} className={`btn !py-1 text-[11px] capitalize ${state === s ? 'btn-active' : ''}`}>
              {s === 'all' ? 'All fuel states' : s}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-mute">Tick two cards to compare · {compare.length}/2 chosen</span>
        </div>

        {pair.length === 2 && <Compare a={pair[0]} b={pair[1]} onClose={() => setCompare([])} />}

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
          {list.map((i) => <Card key={i.psi_id} i={i} chosen={compare.includes(i.psi_id)} onToggle={() => toggle(i.psi_id)} onShowRows={() => onShowRows(i.psi_id)} />)}
        </div>

        <section className="panel p-4">
          <div className="label mb-2">Named by the challenge or team strategy, but not in this dataset</div>
          <div className="flex flex-wrap gap-2">
            {data.findings.not_included.map((n) => (
              <span key={n.name} className="badge badge-dead normal-case tracking-normal">
                {n.name}{n.psi_id ? ` · ${n.psi_id}` : ''}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-mute mt-2">Their tables were not part of the files this project was built from, so they are listed rather than summarised.</p>
        </section>
      </div>
    </div>
  )
}

function Card({ i, chosen, onToggle, onShowRows }: { i: Investigation; chosen: boolean; onToggle: () => void; onShowRows: () => void }) {
  const [more, setMore] = useState(false)
  return (
    <article className={`panel p-4 flex flex-col gap-3 transition-colors ${chosen ? 'border-cryo/60' : ''}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] text-cryo">{i.psi_id} · {i.acronym}</div>
          <h3 className="text-sm font-semibold text-slate-100 mt-0.5">{i.title}</h3>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-mute cursor-pointer shrink-0">
          <input type="checkbox" checked={chosen} onChange={onToggle} className="w-3 h-3 accent-cryo" /> compare
        </label>
      </header>
      <div className="flex flex-wrap gap-1">
        <span className="badge badge-dead">{i.platform}</span>
        <span className="badge badge-dead">{i.hardware}</span>
        <span className="badge badge-ok">{i.fuel_state}</span>
        <span className="badge badge-dead">{i.pillar}</span>
      </div>
      <p className="text-[11.5px] text-slate-300 leading-relaxed">{i.summary}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <Stat k="Tests" v={`${i.test_count}`} />
        <Stat k="Outcome recorded" v={`${Math.round(i.outcome_fraction * 100)}% of tests`} />
        <Stat k="Oxygen" v={rng(i.o2_range, '%')} />
        <Stat k="Pressure" v={rng(i.pressure_kpa_range, ' kPa', 0)} />
      </dl>
      <div>
        <div className="label mb-1">Variables recorded</div>
        <div className="flex flex-wrap gap-1">{i.variables_recorded.map((v) => <span key={v} className="text-[10px] px-1.5 py-0.5 rounded border border-edge text-slate-300">{v}</span>)}</div>
      </div>
      <div>
        <div className="label mb-1">Instruments the table evidences</div>
        {i.sensors_evidenced.length
          ? <div className="flex flex-wrap gap-1">{i.sensors_evidenced.map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded border border-cryo/30 text-cryo/90">{s}</span>)}</div>
          : <div className="text-[10px] text-mute italic">None named in the table.</div>}
        <div className="text-[9.5px] text-mute mt-1">{i.sensors_basis}</div>
      </div>
      <div>
        <button onClick={() => setMore((v) => !v)} className="text-[10px] text-mute hover:text-cryo">{more ? 'Hide objectives' : 'Objectives'}</button>
        {more && (i.objectives
          ? <p className="mt-1 text-[11px] text-slate-300 leading-relaxed anim-fade-in">{i.objectives} <span className="text-mute">(PSI record text)</span></p>
          : <p className="mt-1 text-[10.5px] text-mute italic anim-fade-in">The objectives text has not yet been collected from this investigation's PSI record.</p>)}
      </div>
      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-edge/60 text-[10px]">
        {i.doi_url ? <a href={i.doi_url} target="_blank" rel="noreferrer" className="text-mute hover:text-cryo">DOI {i.doi} ↗</a>
          : <span className="text-star/80">DOI not yet recorded</span>}
        <a href={i.psi_url} target="_blank" rel="noreferrer" className="text-mute hover:text-cryo">PSI record ↗</a>
        <button onClick={onShowRows} className="ml-auto text-cryo hover:underline">View {i.row_count} rows →</button>
      </footer>
    </article>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-mute text-[10px]">{k}</dt><dd className="tabular text-slate-200">{v}</dd></div>
}

/** Side by side, with similarities and differences computed from the data. */
function Compare({ a, b, onClose }: { a: Investigation; b: Investigation; onClose: () => void }) {
  const shared = a.variables_recorded.filter((v) => b.variables_recorded.includes(v))
  const onlyA = a.variables_recorded.filter((v) => !b.variables_recorded.includes(v))
  const onlyB = b.variables_recorded.filter((v) => !a.variables_recorded.includes(v))
  const sharedSub = a.substances.filter((s) => b.substances.includes(s))
  const o2overlap = a.o2_range && b.o2_range && a.o2_range.min <= b.o2_range.max && b.o2_range.min <= a.o2_range.max
  const rows: [string, (i: Investigation) => string][] = [
    ['Title', (i) => i.title], ['Platform', (i) => i.platform], ['Hardware', (i) => i.hardware],
    ['Fuel state', (i) => i.fuel_state], ['Safety pillar', (i) => i.pillar], ['Tests', (i) => `${i.test_count}`],
    ['Outcome recorded', (i) => `${Math.round(i.outcome_fraction * 100)}%`], ['Oxygen', (i) => rng(i.o2_range, '%')],
    ['Pressure', (i) => rng(i.pressure_kpa_range, ' kPa', 0)], ['1 g reference', (i) => (i.has_1g_reference ? 'yes' : 'no')],
    ['Instruments', (i) => i.sensors_evidenced.join(', ') || 'none named'],
  ]
  return (
    <section className="panel p-4 border-cryo/40 anim-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Compare</div>
        <button onClick={onClose} className="text-[10px] text-mute hover:text-flame">Close</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[560px]">
          <thead><tr className="text-left">
            <th className="w-36" />
            {[a, b].map((i) => <th key={i.psi_id} className="pb-2 font-mono text-cryo font-normal">{i.psi_id} · {i.acronym}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(([k, fn]) => (
              <tr key={k} className="border-t border-edge/50 align-top">
                <td className="py-1.5 text-mute">{k}</td><td className="py-1.5 pr-3 text-slate-200">{fn(a)}</td><td className="py-1.5 text-slate-200">{fn(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-3 text-[11px]">
        <div className="panel-flat p-2.5"><div className="label mb-1">Both record</div>{shared.join(', ') || 'no shared variables'}</div>
        <div className="panel-flat p-2.5"><div className="label mb-1">Only {a.acronym}</div>{onlyA.join(', ') || '—'}</div>
        <div className="panel-flat p-2.5"><div className="label mb-1">Only {b.acronym}</div>{onlyB.join(', ') || '—'}</div>
      </div>
      <p className="text-[11px] text-slate-300 mt-3">
        {sharedSub.length ? `Shared substances: ${sharedSub.join(', ')}. ` : 'No substance in common. '}
        {a.o2_range && b.o2_range ? (o2overlap ? 'Their oxygen ranges overlap.' : 'Their oxygen ranges do not overlap.') : 'At least one does not record oxygen.'}
      </p>
    </section>
  )
}
