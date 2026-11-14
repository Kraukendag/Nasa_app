// =============================================================================
//  DATA · RECORDS
// =============================================================================
//  All 1,450 rows. Type words to search (every word must appear), tick boxes
//  to filter (within one group a tick widens, across groups ticks narrow),
//  click a row to see it exactly as NASA recorded it.
//
//  Different investigations measure different things, so besides the shared
//  columns there is a "Key measurements" column that shows each
//  investigation's own variables: droplet diameters for FLEX, ignition and
//  cool-flame regime for CFI-G, nozzle and fuel rate for SPICE, and so on.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dataset } from '../../data'
import { invLabel } from '../../data'
import type { TestRecord } from '../../types'

const PAGE = 60
type FacetKey = 'psi_id' | 'fuel_state' | 'substance' | 'material' | 'outcome' | 'anomaly' | 'science'
const empty = (): Record<FacetKey, Set<string>> => ({
  psi_id: new Set(), fuel_state: new Set(), substance: new Set(), material: new Set(),
  outcome: new Set(), anomaly: new Set(), science: new Set(),
})
const FACETS = Object.keys(empty()) as FacetKey[]
const STATE_NAMES: Record<string, string> = {
  solid: 'Solid', liquid: 'Liquid (droplets)', gas: 'Gas', smoke: 'Smoke (heated, non-flaming)', aerosol: 'Aerosol (dust)',
}

const f = (v: unknown, d = 2) => (typeof v === 'number' ? `${+v.toFixed(d)}` : null)

/** The variables that matter for each investigation, in one short line. */
export function keyMeasures(t: TestRecord): string {
  const n = t.normalized
  const bits: (string | null | undefined)[] = []
  switch (t.psi_id) {
    case 'PSI-69':
      bits.push(n.droplet_d0_mm != null ? `d₀ ${n.droplet_d0_mm} mm` : null,
        n.extinction_d_mm != null ? `d_ext ${n.extinction_d_mm} mm` : null,
        n.burn_time_s != null ? `${n.burn_time_s} s` : null,
        n.co2_mole_fraction ? `CO₂ ${f(n.co2_mole_fraction * 100, 0)}%` : null,
        n.he_mole_fraction ? `He ${f(n.he_mole_fraction * 100, 0)}%` : null)
      break
    case 'PSI-39':
      bits.push(n.fiber_supported === true ? 'fibre' : n.fiber_supported === false ? 'free-floated' : null,
        n.he_mole_fraction ? `He ${f((n.he_mole_fraction as number) * 100, 0)}%` : null)
      break
    case 'PSI-159':
      bits.push(n.hot_ignition === true ? 'hot ignition' : n.hot_ignition === false ? 'no hot ignition' : null,
        n.pci_regime ? `cool flame ${n.pci_regime}` : null,
        n.burn_time_s ? `${n.burn_time_s} s` : null,
        typeof n.temperature_c === 'number' ? `peak ${f(n.temperature_c, 0)} °C` : null)
      break
    case 'PSI-107':
      bits.push(n.nozzle_mm != null ? `nozzle ${n.nozzle_mm} mm` : null,
        n.fuel_rate_mg_s != null ? `fuel ${n.fuel_rate_mg_s} mg/s` : null)
      break
    case 'PSI-101':
      bits.push(n.rt_r0 != null ? `Rt/R₀ ${n.rt_r0}` : null,
        n.net_aging_time_s != null ? `aged ${n.net_aging_time_s} s` : null,
        n.is_aged_followup ? 'aged re-measurement' : null)
      break
    case 'PSI-98': case 'PSI-99': case 'PSI-100':
      bits.push(n.flow_direction, n.burn_time_s != null ? `${n.burn_time_s} s` : null,
        n.burn_length_0g_raw ? `0 g: ${n.burn_length_0g_raw}` : null,
        n.burn_length_1g_raw ? `1 g: ${n.burn_length_1g_raw}` : null)
      break
    case 'PSI-25':
      bits.push(n.flow_direction, n.principal_investigator as string, n.geometry,
        n.diameter_mm ? `⌀${n.diameter_mm} mm` : n.thickness_mm ? `${n.thickness_mm} mm thick` : null)
      break
    case 'PSI-26':
      bits.push(n.geometry, n.diameter_mm ? `⌀${n.diameter_mm} mm` : null, n.sample_number ? `sample ${n.sample_number}` : null)
      break
    case 'PSI-20': case 'PSI-22':
      bits.push(n.burner_size_mm ? `${n.burner_size_mm} mm burner` : null,
        n.mesh_polarity ? `mesh ${n.mesh_polarity}` : null,
        n.flames_ignited != null ? `${n.flames_ignited} flames ignited` : null)
      break
    case 'PSI-47':
      bits.push(n.sampled_location as string)
      break
    case 'PSI-68':
      bits.push(n.droplet_d0_range ? `d₀ ${n.droplet_d0_range} mm` : null, n.pressure_range ? `${n.pressure_range} atm` : null)
      break
  }
  return bits.filter(Boolean).join(' · ')
}

function pick(t: TestRecord, k: FacetKey): string[] {
  const n = t.normalized
  switch (k) {
    case 'psi_id': return [t.psi_id]
    case 'fuel_state': return n.fuel_state ? [n.fuel_state] : []
    case 'substance': return n.substance ? [n.substance] : []
    case 'material': return n.material ? [n.material] : []
    case 'outcome': return n.outcome_class ? [n.outcome_class] : []
    case 'anomaly': return t.anomalies
    case 'science': return t.science_flags
  }
}

export default function Records({ data, preset }: { data: Dataset; preset: string | null }) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<Record<FacetKey, Set<string>>>(empty)
  const [visible, setVisible] = useState(PAGE)
  const [open, setOpen] = useState<TestRecord | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const labels = data.findings.outcome_labels

  // A preset from the URL: "inv:PSI-25" filters to an investigation,
  // anything else is a material name.
  useEffect(() => {
    if (!preset) return
    const next = empty()
    if (preset.startsWith('inv:')) next.psi_id.add(preset.slice(4))
    else next.material.add(preset)
    setSel(next)
    setQuery('')
  }, [preset])

  const facets = useMemo(() => {
    const out = {} as Record<FacetKey, [string, number][]>
    for (const k of FACETS) {
      const c = new Map<string, number>()
      for (const t of data.tests) for (const v of pick(t, k)) c.set(v, (c.get(v) ?? 0) + 1)
      out[k] = [...c.entries()].sort((a, b) => b[1] - a[1])
    }
    return out
  }, [data.tests])

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return data.tests.filter((t) => {
      for (const w of words) if (!t.search_text.includes(w)) return false
      for (const k of FACETS) if (sel[k].size && !pick(t, k).some((v) => sel[k].has(v))) return false
      return true
    })
  }, [data.tests, query, sel])

  useEffect(() => setVisible(PAGE), [query, sel])
  const toggle = (k: FacetKey, v: string) => setSel((p) => {
    const next = new Set(p[k]); next.has(v) ? next.delete(v) : next.add(v)
    return { ...p, [k]: next }
  })
  const active = FACETS.reduce((a, k) => a + sel[k].size, 0)
  const single = sel.psi_id.size === 1 ? data.investigations.find((i) => sel.psi_id.has(i.psi_id)) : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
      <aside className={`${showFilters ? 'block' : 'hidden'} lg:block space-y-6`}>
        <div className="flex items-center justify-between">
          <h2 className="small font-semibold">Filters</h2>
          {active > 0 && <button onClick={() => { setSel(empty()); setQuery('') }} className="small text-accent hover:underline">Clear {active}</button>}
        </div>
        <Facet title="Investigation" entries={facets.psi_id} selected={sel.psi_id} onToggle={(v) => toggle('psi_id', v)}
               render={(v) => invLabel(data, v)} hint={(v) => data.investigations.find((x) => x.psi_id === v)?.title} />
        <Facet title="Fuel state" entries={facets.fuel_state} selected={sel.fuel_state} onToggle={(v) => toggle('fuel_state', v)} render={(v) => STATE_NAMES[v] ?? v} />
        <Facet title="Substance" entries={facets.substance} selected={sel.substance} onToggle={(v) => toggle('substance', v)} limit={10} />
        <Facet title="Material / fuel stream" entries={facets.material} selected={sel.material} onToggle={(v) => toggle('material', v)} limit={8} />
        <Facet title="How it ended" entries={facets.outcome} selected={sel.outcome} onToggle={(v) => toggle('outcome', v)} limit={10} render={(v) => labels[v] ?? v} />
        <Facet title="Data-quality flags" entries={facets.anomaly} selected={sel.anomaly} onToggle={(v) => toggle('anomaly', v)} limit={8} render={(v) => v.replace(/_/g, ' ')} />
        <Facet title="Science markers" entries={facets.science} selected={sel.science} onToggle={(v) => toggle('science', v)} render={(v) => v.replace(/_/g, ' ')} />
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search records"
                   placeholder="Search any words, e.g. heptane disruption · SIBAL concurrent · blowoff"
                   className="field !py-2.5 pr-28" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 caption num">
              {results.length.toLocaleString()} / {data.tests.length.toLocaleString()}
            </span>
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className="btn lg:hidden">Filters{active ? ` (${active})` : ''}</button>
          <button onClick={() => downloadCsv(results)} className="btn" disabled={!results.length} title="Download the rows shown, with NASA's original cells">
            Download CSV
          </button>
        </div>

        {single && (
          <div className="wash p-4 enter">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num small">{single.psi_id}</span>
              <span className="font-medium">{single.title}</span>
              {single.doi_url
                ? <a href={single.doi_url} target="_blank" rel="noreferrer" className="caption ml-auto">DOI {single.doi}</a>
                : <span className="caption ml-auto">DOI not yet recorded</span>}
            </div>
            <p className="small text-ink2 mt-1">{single.summary}</p>
          </div>
        )}

        <div className="card overflow-auto max-h-[70vh]">
          <table className="tbl min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th>Investigation</th><th>Test</th><th>Material / fuel</th>
                <th className="text-right">O₂ %</th><th className="text-right">Flow cm/s</th><th className="text-right">Pressure atm</th>
                <th>Key measurements</th><th>How it ended</th><th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, visible).map((t) => {
                const n = t.normalized
                const flow = n.flow_sequence_cm_s.length > 1 ? `${n.flow_min_cm_s}–${n.flow_max_cm_s}` : n.flow_cm_s
                const flags = t.anomalies.length + t.science_flags.length
                return (
                  <tr key={t.id} onClick={() => setOpen(t)} className="hover:bg-wash cursor-pointer">
                    <td className="whitespace-nowrap num">{t.psi_id} <span className="text-mute">{t.acronym}</span></td>
                    <td className="num whitespace-nowrap">{t.test_number ?? `row ${t.row_index}`}</td>
                    <td className="max-w-[220px] truncate" title={n.material_raw ?? ''}>{n.material ?? n.material_raw ?? (n.note_text as string) ?? '—'}</td>
                    <td className="text-right num whitespace-nowrap">{n.o2_display ?? n.o2_percent ?? '—'}</td>
                    <td className="text-right num whitespace-nowrap">{flow ?? '—'}</td>
                    <td className="text-right num">{n.pressure_atm ?? '—'}</td>
                    <td className="text-ink2 max-w-[240px] truncate" title={keyMeasures(t)}>{keyMeasures(t) || '—'}</td>
                    <td className="max-w-[180px] truncate" title={n.outcome_text ?? ''}>{n.outcome ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {flags > 0 ? <span className={`flag ${t.anomalies.length ? 'flag-warn' : ''}`}>{flags}</span> : <span className="text-mute">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {results.length === 0 && <div className="p-10 text-center caption">Nothing matches. Try fewer words, or clear a filter.</div>}
          {visible < results.length && (
            <div className="p-4 text-center">
              <button onClick={() => setVisible((v) => v + PAGE * 3)} className="btn">
                Show more ({(results.length - visible).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </div>
        <p className="caption">Flags: a number next to an orange dot counts data-quality problems (typos, failed sensors, unit
          mix-ups); a grey dot means scientific markers only. Open a row for the details.</p>
      </section>
      {open && <RowDrawer t={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** Save the filtered rows as a CSV file, built in the browser. Readable
 *  columns first; `raw_cells` holds NASA's original row exactly as recorded. */
function downloadCsv(rows: TestRecord[]) {
  const cols: [string, (t: TestRecord) => unknown][] = [
    ['psi_id', (t) => t.psi_id], ['investigation', (t) => t.acronym], ['test', (t) => t.test_number],
    ['material', (t) => t.normalized.material], ['fuel_state', (t) => t.normalized.fuel_state],
    ['o2_percent', (t) => t.normalized.o2_percent], ['flow_cm_s', (t) => t.normalized.flow_cm_s],
    ['flow_direction', (t) => t.normalized.flow_direction], ['pressure_kpa', (t) => t.normalized.pressure_kpa],
    ['ending', (t) => t.normalized.outcome], ['nasa_words', (t) => t.normalized.outcome_text],
    ['nasa_words_source', (t) => t.normalized.outcome_source], ['data_quality_flags', (t) => t.anomalies.join('; ')],
    ['raw_cells', (t) => JSON.stringify(t.raw)],
  ]
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.map((c) => c[0]).join(','), ...rows.map((t) => cols.map(([, f]) => esc(f(t))).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `microflamma-records-${rows.length}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Facet({ title, entries, selected, onToggle, limit = 20, render, hint }: {
  title: string; entries: [string, number][]; selected: Set<string>; onToggle: (v: string) => void
  limit?: number; render?: (v: string) => string; hint?: (v: string) => string | undefined
}) {
  const [all, setAll] = useState(false)
  if (!entries.length) return null
  const shown = all ? entries : entries.slice(0, limit)
  return (
    <section>
      <h3 className="caption font-medium text-ink2 mb-1.5">{title}</h3>
      <div>
        {shown.map(([v, c]) => (
          <label key={v} title={hint?.(v)} className="flex items-center gap-2 py-1 cursor-pointer small text-ink2 hover:text-ink">
            <input type="checkbox" checked={selected.has(v)} onChange={() => onToggle(v)} className="accent-accent shrink-0" />
            <span className="truncate flex-1">{render ? render(v) : v}</span>
            <span className="caption num shrink-0">{c}</span>
          </label>
        ))}
      </div>
      {entries.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="caption hover:text-ink mt-1">{all ? 'Show fewer' : `Show all ${entries.length}`}</button>
      )}
    </section>
  )
}

/** One row exactly as NASA recorded it, with its flags and its citation.
 *  Rendered onto <body> so the top bar cannot cover it. */
function RowDrawer({ t, data, onClose }: { t: TestRecord; data: Dataset; onClose: () => void }) {
  const inv = data.investigations.find((i) => i.psi_id === t.psi_id)
  const n = t.normalized
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-rule overflow-y-auto enter">
        <div className="sticky top-0 bg-card border-b border-rule px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="num font-medium">{invLabel(data, t.psi_id)} · {t.test_number ?? `row ${t.row_index}`}</div>
            <div className="caption mt-0.5">{inv?.title}</div>
          </div>
          <button onClick={onClose} className="btn">Close</button>
        </div>
        <div className="p-5 space-y-6">
          {(n.outcome || n.outcome_text) && (
            <section>
              <h3 className="small font-semibold mb-2">How it ended</h3>
              {n.outcome && <p>{n.outcome}</p>}
              {n.outcome_text && <blockquote className="border-l-2 border-rule pl-3 mt-2 small text-ink2">“{n.outcome_text}”</blockquote>}
              {n.outcome_source && <p className="caption num mt-1">{n.outcome_source}</p>}
            </section>
          )}
          {(t.anomalies.length > 0 || t.science_flags.length > 0) && (
            <section>
              <h3 className="small font-semibold mb-2">Flags</h3>
              <ul className="space-y-3">
                {t.anomalies.map((a) => (
                  <li key={a}><span className="flag flag-warn">{a.replace(/_/g, ' ')}</span>
                    <p className="small text-ink2 mt-0.5">{data.findings.anomaly_descriptions[a] ?? 'Flagged during processing.'}</p></li>
                ))}
                {t.science_flags.map((a) => (
                  <li key={a}><span className="flag">{a.replace(/_/g, ' ')}</span>
                    <p className="small text-ink2 mt-0.5">{data.findings.science_flag_descriptions[a]}</p></li>
                ))}
              </ul>
            </section>
          )}
          {t.psi_id === 'PSI-25' && (
            <section>
              <h3 className="small font-semibold mb-2">Measurement limits NASA states for these instruments</h3>
              <ul className="small text-ink2 space-y-1">
                {data.literature.instruments_bass2.map((x) => <li key={x.quantity}><b className="text-ink font-medium">{x.quantity}:</b> {x.limit} <span className="caption">(report {x.where})</span></li>)}
              </ul>
            </section>
          )}
          <section>
            <h3 className="small font-semibold mb-2">Original CSV row, exactly as recorded</h3>
            <dl className="border border-rule rounded-md divide-y divide-rule">
              {Object.entries(t.raw).map(([k, v]) => (
                <div key={k} className="px-3 py-1.5 grid grid-cols-2 gap-3 small">
                  <dt className="text-mute break-words">{k}</dt>
                  <dd className={`num break-words ${v ? '' : 'text-mute'}`}>{v ?? 'empty'}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3 className="small font-semibold mb-2">Cite this</h3>
            <p className="small">{inv?.title}. NASA Physical Sciences Informatics, {t.psi_id}.</p>
            {inv?.doi ? <a href={inv.doi_url!} target="_blank" rel="noreferrer" className="small block mt-1">DOI {inv.doi}</a>
              : <p className="caption mt-1">DOI not yet recorded for this investigation.</p>}
            <a href={inv?.psi_url} target="_blank" rel="noreferrer" className="small block mt-1">Original PSI record</a>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
