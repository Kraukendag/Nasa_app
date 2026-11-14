// =============================================================================
//  DATA LIBRARY · RECORDS VIEW
// =============================================================================
//  All 1,450 rows. Type words to search (every word must appear), tick boxes to
//  filter (within one group a tick widens, across groups ticks narrow), click a
//  row to see it exactly as NASA recorded it.
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
const EMPTY: Record<FacetKey, Set<string>> = {
  psi_id: new Set(), fuel_state: new Set(), substance: new Set(), material: new Set(),
  outcome: new Set(), anomaly: new Set(), science: new Set(),
}
const STATE_NAMES: Record<string, string> = {
  solid: 'Solid', liquid: 'Liquid (droplets)', gas: 'Gas', smoke: 'Smoke (heated, non-flaming)', aerosol: 'Aerosol (dust)',
}

const f = (v: unknown, d = 2) => (typeof v === 'number' ? `${+v.toFixed(d)}` : null)

/** The variables that matter for each investigation, in one short line. */
export function keyMeasures(t: TestRecord): string {
  const n = t.normalized
  const bits: (string | null)[] = []
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
        n.flames_ignited != null ? `${n.flames_ignited} ignited` : null)
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

export default function Records({ data, preset, presetInvestigation, presetQuery, onPresetConsumed }: {
  data: Dataset; preset: string | null; presetInvestigation?: string | null; presetQuery?: string | null; onPresetConsumed: () => void
}) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState<Record<FacetKey, Set<string>>>(EMPTY)
  const [visible, setVisible] = useState(PAGE)
  const [open, setOpen] = useState<TestRecord | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const labels = data.findings.outcome_labels

  useEffect(() => {
    if (presetQuery) { setQuery(presetQuery); setSel(EMPTY); onPresetConsumed(); return }
    if (!preset && !presetInvestigation) return
    setSel({ ...EMPTY,
      material: preset ? new Set([preset]) : new Set(),
      psi_id: presetInvestigation ? new Set([presetInvestigation]) : new Set() })
    onPresetConsumed()
  }, [preset, presetInvestigation, presetQuery, onPresetConsumed])

  const pick = (t: TestRecord, k: FacetKey): string[] => {
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

  const facets = useMemo(() => {
    const out = {} as Record<FacetKey, [string, number][]>
    for (const k of Object.keys(EMPTY) as FacetKey[]) {
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
      for (const k of Object.keys(sel) as FacetKey[]) {
        if (sel[k].size && !pick(t, k).some((v) => sel[k].has(v))) return false
      }
      return true
    })
  }, [data.tests, query, sel])

  useEffect(() => setVisible(PAGE), [query, sel])
  const toggle = (k: FacetKey, v: string) => setSel((p) => {
    const next = new Set(p[k]); next.has(v) ? next.delete(v) : next.add(v)
    return { ...p, [k]: next }
  })
  const active = Object.values(sel).reduce((a, s) => a + s.size, 0)
  const single = sel.psi_id.size === 1 ? data.investigations.find((i) => sel.psi_id.has(i.psi_id)) : null

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] lg:grid-rows-[minmax(0,1fr)]">
      <aside className={`${showFilters ? 'block' : 'hidden'} lg:block border-r border-edge lg:overflow-y-auto p-4 space-y-5`}>
        <div className="flex items-center justify-between">
          <div className="label">Filters</div>
          {active > 0 && <button onClick={() => { setSel(EMPTY); setQuery('') }} className="text-[10px] text-flame hover:underline">Clear {active}</button>}
        </div>
        <Facet title="Investigation" entries={facets.psi_id} selected={sel.psi_id} onToggle={(v) => toggle('psi_id', v)}
               render={(v) => { const i = data.investigations.find((x) => x.psi_id === v); return i ? `${v} · ${i.acronym}` : v }}
               hint={(v) => data.investigations.find((x) => x.psi_id === v)?.title} />
        <Facet title="Fuel state" entries={facets.fuel_state} selected={sel.fuel_state} onToggle={(v) => toggle('fuel_state', v)} render={(v) => STATE_NAMES[v] ?? v} />
        <Facet title="Substance" entries={facets.substance} selected={sel.substance} onToggle={(v) => toggle('substance', v)} limit={12} />
        <Facet title="Material / fuel stream" entries={facets.material} selected={sel.material} onToggle={(v) => toggle('material', v)} limit={8} />
        <Facet title="How it ended" entries={facets.outcome} selected={sel.outcome} onToggle={(v) => toggle('outcome', v)} limit={12} render={(v) => labels[v] ?? v} />
        <Facet title="Data-quality flags" entries={facets.anomaly} selected={sel.anomaly} onToggle={(v) => toggle('anomaly', v)} limit={10} render={(v) => v.replace(/_/g, ' ')} />
        <Facet title="Science flags" entries={facets.science} selected={sel.science} onToggle={(v) => toggle('science', v)} render={(v) => v.replace(/_/g, ' ')} />
      </aside>

      <section className="flex flex-col min-h-0">
        <div className="p-4 border-b border-edge space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder="Search any words, e.g. heptane disruption · SIBAL concurrent · blowoff"
                     className="w-full bg-navy/50 border border-edge rounded-md px-4 py-2.5 pr-24 text-sm placeholder:text-mute/60 focus:outline-none focus:border-cryo/60 transition-colors" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 tabular text-xs text-mute">
                {results.length.toLocaleString()} / {data.tests.length.toLocaleString()}
              </span>
            </div>
            <button onClick={() => setShowFilters((v) => !v)} className="btn lg:hidden text-xs">Filters{active ? ` (${active})` : ''}</button>
          </div>
          {single && (
            <div className="panel-flat p-3 anim-fade-in">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-cryo text-xs">{single.psi_id}</span>
                <span className="text-sm text-slate-100">{single.title}</span>
                {single.doi_url
                  ? <a href={single.doi_url} target="_blank" rel="noreferrer" className="text-[10px] text-mute hover:text-cryo ml-auto">DOI {single.doi} ↗</a>
                  : <span className="text-[10px] text-star/80 ml-auto">DOI not yet recorded</span>}
              </div>
              <p className="text-[11px] text-mute mt-1">{single.summary}</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs min-w-[880px]">
            <thead className="sticky top-0 bg-deep/95 backdrop-blur-sm z-10">
              <tr className="text-left label border-b border-edge">
                <th className="px-3 py-2.5 font-medium">Investigation</th>
                <th className="px-3 py-2.5 font-medium">Test</th>
                <th className="px-3 py-2.5 font-medium">Material / fuel</th>
                <th className="px-3 py-2.5 font-medium text-right">O₂ %</th>
                <th className="px-3 py-2.5 font-medium text-right">Flow cm/s</th>
                <th className="px-3 py-2.5 font-medium text-right">Pressure atm</th>
                <th className="px-3 py-2.5 font-medium">Key measurements</th>
                <th className="px-3 py-2.5 font-medium">How it ended</th>
                <th className="px-3 py-2.5 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, visible).map((t) => {
                const n = t.normalized
                const flow = n.flow_sequence_cm_s.length > 1 ? `${n.flow_min_cm_s}–${n.flow_max_cm_s}` : n.flow_cm_s
                return (
                  <tr key={t.id} onClick={() => setOpen(t)} className="border-b border-edge/40 hover:bg-navy/40 cursor-pointer transition-colors duration-150">
                    <td className="px-3 py-2 whitespace-nowrap" title={data.investigations.find((i) => i.psi_id === t.psi_id)?.title}>
                      <span className="font-mono text-cryo">{t.psi_id}</span> <span className="text-mute">{t.acronym}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-mute whitespace-nowrap">{t.test_number ?? `row ${t.row_index}`}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate" title={n.material_raw ?? ''}>{n.material ?? n.material_raw ?? n.note_text as string ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular whitespace-nowrap">{n.o2_display ?? n.o2_percent ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular whitespace-nowrap">{flow ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">{n.pressure_atm ?? '—'}</td>
                    <td className="px-3 py-2 text-mute max-w-[240px] truncate" title={keyMeasures(t)}>{keyMeasures(t) || '—'}</td>
                    <td className="px-3 py-2 text-slate-300 max-w-[170px] truncate" title={n.outcome_text ?? ''}>{n.outcome ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {t.anomalies.slice(0, 2).map((a) => <span key={a} className="badge badge-warn" title={a.replace(/_/g, ' ')}>{a.split('_')[0]}</span>)}
                        {t.science_flags.slice(0, 1).map((a) => <span key={a} className="badge badge-ok" title={a.replace(/_/g, ' ')}>science</span>)}
                        {t.anomalies.length > 2 && <span className="badge badge-dead">+{t.anomalies.length - 2}</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {results.length === 0 && <div className="p-10 text-center text-mute text-sm">Nothing matches. Try fewer words, or clear a filter.</div>}
          {visible < results.length && (
            <div className="p-4 text-center">
              <button onClick={() => setVisible((v) => v + PAGE * 3)} className="btn text-xs">
                Show more — {(results.length - visible).toLocaleString()} remaining
              </button>
            </div>
          )}
        </div>
      </section>
      {open && <RowDrawer t={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  )
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
      <div className="label mb-1.5">{title}</div>
      <div className="space-y-0.5">
        {shown.map(([v, c]) => (
          <label key={v} title={hint?.(v)} className="flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer hover:bg-navy/50 transition-colors group">
            <input type="checkbox" checked={selected.has(v)} onChange={() => onToggle(v)} className="w-3 h-3 accent-cryo shrink-0" />
            <span className="text-[11px] text-slate-300 group-hover:text-white truncate flex-1">{render ? render(v) : v}</span>
            <span className="text-[10px] tabular text-mute shrink-0">{c}</span>
          </label>
        ))}
      </div>
      {entries.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="mt-1 text-[10px] text-mute hover:text-cryo">{all ? 'Show fewer' : `Show all ${entries.length}`}</button>
      )}
    </section>
  )
}

/** One row exactly as NASA recorded it, with its flags and its citation.
 *  Rendered onto <body> so the sticky top bar cannot cover it. */
function RowDrawer({ t, data, onClose }: { t: TestRecord; data: Dataset; onClose: () => void }) {
  const inv = data.investigations.find((i) => i.psi_id === t.psi_id)
  const n = t.normalized
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-void/70 backdrop-blur-sm anim-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-deep border-l border-edge overflow-y-auto anim-slide-in">
        <div className="sticky top-0 bg-deep/95 backdrop-blur-sm border-b border-edge px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-cryo text-sm">{invLabel(data, t.psi_id)} · {t.test_number ?? `row ${t.row_index}`}</div>
            <div className="text-xs text-mute mt-0.5">{inv?.title}</div>
          </div>
          <button onClick={onClose} className="btn px-2.5 py-1 text-xs">Close</button>
        </div>
        <div className="p-5 space-y-5">
          {(n.outcome || n.outcome_text) && (
            <section>
              <div className="label mb-2">How it ended</div>
              <div className="panel-flat p-3 text-[11px] space-y-1.5">
                {n.outcome && <div className="text-slate-100">{n.outcome}</div>}
                {n.outcome_text && <blockquote className="text-slate-300 border-l-2 border-edge pl-2">“{n.outcome_text}”</blockquote>}
                {n.outcome_source && <div className="text-[10px] text-mute font-mono">{n.outcome_source}</div>}
              </div>
            </section>
          )}
          {(t.anomalies.length > 0 || t.science_flags.length > 0) && (
            <section>
              <div className="label mb-2">Flags</div>
              <div className="space-y-2">
                {t.anomalies.map((a) => (
                  <div key={a} className="panel-flat p-2.5">
                    <span className="badge badge-warn">{a.replace(/_/g, ' ')}</span>
                    <p className="mt-1.5 text-[11px] text-slate-300">{data.findings.anomaly_descriptions[a] ?? 'Flagged during processing.'}</p>
                  </div>
                ))}
                {t.science_flags.map((a) => (
                  <div key={a} className="panel-flat p-2.5">
                    <span className="badge badge-ok">{a.replace(/_/g, ' ')}</span>
                    <p className="mt-1.5 text-[11px] text-slate-300">{data.findings.science_flag_descriptions[a]}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="label mb-2">Original CSV row, exactly as recorded</div>
            <div className="panel-flat divide-y divide-edge/50">
              {Object.entries(t.raw).map(([k, v]) => (
                <div key={k} className="px-3 py-1.5 grid grid-cols-2 gap-3 text-[11px]">
                  <span className="text-mute truncate" title={k}>{k}</span>
                  <span className={`tabular break-words ${v ? 'text-slate-200' : 'text-mute/40'}`}>{v ?? 'empty'}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="label mb-2">Cite this</div>
            <div className="panel-flat p-3 text-[11px] space-y-1.5">
              <div className="text-slate-300">{inv?.title}</div>
              <div className="text-mute">NASA Physical Sciences Informatics · {t.psi_id}</div>
              {inv?.doi ? <a href={inv.doi_url!} target="_blank" rel="noreferrer" className="text-cryo hover:underline block">DOI {inv.doi} ↗</a>
                : <div className="text-star/80">DOI not yet recorded for this investigation</div>}
              <a href={inv?.psi_url} target="_blank" rel="noreferrer" className="text-mute hover:text-cryo block">View the original record ↗</a>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
