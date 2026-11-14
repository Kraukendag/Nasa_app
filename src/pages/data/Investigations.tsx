// =============================================================================
//  DATA · INVESTIGATIONS
// =============================================================================
//  One profile per investigation: what it was for, what hardware it flew on,
//  what it varied, what instruments its table shows, and how complete its
//  outcomes are. Tick two profiles to compare them side by side.
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {['all', 'solid', 'liquid', 'gas', 'smoke', 'aerosol'].map((s) => (
          <button key={s} onClick={() => setState(s)} className={`chip capitalize ${state === s ? 'chip-on' : ''}`}>
            {s === 'all' ? 'All fuel states' : s}
          </button>
        ))}
        <span className="ml-auto caption">Tick two profiles to compare · {compare.length}/2 chosen</span>
      </div>

      {pair.length === 2 && <Compare a={pair[0]} b={pair[1]} onClose={() => setCompare([])} />}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((i) => <Card key={i.psi_id} i={i} chosen={compare.includes(i.psi_id)} onToggle={() => toggle(i.psi_id)} onShowRows={() => onShowRows(i.psi_id)} />)}
      </div>

      <section className="wash p-5">
        <h3 className="h3">Named by the challenge or team strategy, but not in this dataset</h3>
        <p className="small text-ink2 mt-2">
          {data.findings.not_included.map((n) => `${n.name}${n.psi_id ? ` (${n.psi_id})` : ''}`).join(' · ')}
        </p>
        <p className="caption mt-2">Their tables were not part of the files this project was built from, so they are listed rather than summarised.</p>
      </section>
    </div>
  )
}

function Card({ i, chosen, onToggle, onShowRows }: { i: Investigation; chosen: boolean; onToggle: () => void; onShowRows: () => void }) {
  const [more, setMore] = useState(false)
  return (
    <article className={`card p-5 flex flex-col gap-4 ${chosen ? '!border-accent' : ''}`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="caption num">{i.psi_id} · {i.acronym}</div>
          <h3 className="h3 mt-0.5">{i.title}</h3>
          <p className="caption mt-1">{i.platform} · {i.hardware} · {i.fuel_state} fuel · {i.pillar}</p>
        </div>
        <label className="flex items-center gap-1.5 caption cursor-pointer shrink-0">
          <input type="checkbox" checked={chosen} onChange={onToggle} className="accent-accent" /> compare
        </label>
      </header>
      <p className="small text-ink2">{i.summary}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 small">
        <Item k="Tests" v={`${i.test_count}`} />
        <Item k="Outcome recorded" v={`${Math.round(i.outcome_fraction * 100)}% of tests`} />
        <Item k="Oxygen" v={rng(i.o2_range, '%')} />
        <Item k="Pressure" v={rng(i.pressure_kpa_range, ' kPa', 0)} />
      </dl>
      <div>
        <h4 className="caption font-medium text-ink2">Variables recorded</h4>
        <p className="small mt-0.5">{i.variables_recorded.join(', ')}</p>
      </div>
      <div>
        <h4 className="caption font-medium text-ink2">Instruments the table evidences</h4>
        <p className="small mt-0.5">{i.sensors_evidenced.length ? i.sensors_evidenced.join(', ') : <i className="text-mute">None named in the table.</i>}</p>
        <p className="caption mt-0.5">{i.sensors_basis}</p>
      </div>
      <div>
        <button onClick={() => setMore((v) => !v)} className="small text-accent hover:underline">{more ? 'Hide objectives' : 'Objectives'}</button>
        {more && (i.objectives
          ? <p className="mt-1 small text-ink2 enter">{i.objectives} <span className="text-mute">(PSI record text)</span></p>
          : <p className="mt-1 caption italic enter">The objectives text has not yet been collected from this investigation's PSI record.</p>)}
      </div>
      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 border-t border-rule small">
        {i.doi_url ? <a href={i.doi_url} target="_blank" rel="noreferrer">DOI {i.doi}</a> : <span className="caption">DOI not yet recorded</span>}
        <a href={i.psi_url} target="_blank" rel="noreferrer">PSI record</a>
        <button onClick={onShowRows} className="ml-auto text-accent hover:underline">View {i.row_count} rows →</button>
      </footer>
    </article>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return <div><dt className="caption">{k}</dt><dd className="num">{v}</dd></div>
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
    <section className="card p-5 enter">
      <div className="flex items-center justify-between mb-3">
        <h3 className="h3">Compare</h3>
        <button onClick={onClose} className="btn">Close</button>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[560px]">
          <thead><tr><th className="w-40" />{[a, b].map((i) => <th key={i.psi_id} className="num">{i.psi_id} · {i.acronym}</th>)}</tr></thead>
          <tbody>
            {rows.map(([k, fn]) => <tr key={k}><td className="text-mute">{k}</td><td>{fn(a)}</td><td>{fn(b)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mt-4 small">
        <div><h4 className="caption font-medium text-ink2">Both record</h4>{shared.join(', ') || 'no shared variables'}</div>
        <div><h4 className="caption font-medium text-ink2">Only {a.acronym}</h4>{onlyA.join(', ') || '—'}</div>
        <div><h4 className="caption font-medium text-ink2">Only {b.acronym}</h4>{onlyB.join(', ') || '—'}</div>
      </div>
      <p className="small text-ink2 mt-4">
        {sharedSub.length ? `Shared substances: ${sharedSub.join(', ')}. ` : 'No substance in common. '}
        {a.o2_range && b.o2_range ? (o2overlap ? 'Their oxygen ranges overlap.' : 'Their oxygen ranges do not overlap.') : 'At least one does not record oxygen.'}
      </p>
    </section>
  )
}
