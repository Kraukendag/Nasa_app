// =============================================================================
//  TAB 3 — DATA LIBRARY
// =============================================================================
//  Every one of the 1,450 rows, searchable and filterable.
//
//  HOW THE SEARCH WORKS
//  --------------------
//  The Python pipeline already glued each row's searchable words into one
//  lowercase string. So searching is just: split what the user typed on
//  spaces, and keep rows whose string contains every word. Typing
//  "heptane disruption" finds rows containing both. No search library, no
//  server, and fast enough on 1,450 rows to feel instant.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Dataset } from '../data'
import type { TestRecord } from '../types'

/** How many rows to draw at once. The rest appear as you scroll — drawing all
 *  1,450 at once would make the page stutter for no benefit. */
const PAGE_SIZE = 60

type FacetKey = 'psi_id' | 'fuel_state' | 'material' | 'outcome' | 'anomaly'

export default function TabLibrary({
  data,
  presetMaterial,
  onPresetConsumed,
}: {
  data: Dataset
  presetMaterial: string | null
  onPresetConsumed: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<FacetKey, Set<string>>>({
    psi_id: new Set(), fuel_state: new Set(), material: new Set(),
    outcome: new Set(), anomaly: new Set(),
  })
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [open, setOpen] = useState<TestRecord | null>(null)

  // When Tab 2 sends us here with a material, pre-tick that checkbox.
  useEffect(() => {
    if (!presetMaterial) return
    setSelected((prev) => ({ ...prev, material: new Set([presetMaterial]) }))
    onPresetConsumed()
  }, [presetMaterial, onPresetConsumed])

  // ---- Build the facet lists from the data itself -------------------------
  const facets = useMemo(() => {
    const count = (pick: (t: TestRecord) => string[] | string | null) => {
      const tally = new Map<string, number>()
      for (const test of data.tests) {
        const value = pick(test)
        const values = Array.isArray(value) ? value : value ? [value] : []
        for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1)
      }
      return [...tally.entries()].sort((a, b) => b[1] - a[1])
    }
    return {
      psi_id: count((t) => t.psi_id),
      fuel_state: count((t) => t.normalized.fuel_state),
      material: count((t) => t.normalized.material),
      outcome: count((t) => t.normalized.outcome),
      anomaly: count((t) => t.anomalies),
    }
  }, [data.tests])

  // ---- Apply the search words and the ticked boxes ------------------------
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return data.tests.filter((test) => {
      // Every typed word must appear somewhere in the row.
      for (const word of words) {
        if (!test.search_text.includes(word)) return false
      }
      // Within one facet the ticks are OR; across facets they are AND.
      if (selected.psi_id.size && !selected.psi_id.has(test.psi_id)) return false
      if (selected.fuel_state.size &&
          !(test.normalized.fuel_state && selected.fuel_state.has(test.normalized.fuel_state))) return false
      if (selected.material.size &&
          !(test.normalized.material && selected.material.has(test.normalized.material))) return false
      if (selected.outcome.size &&
          !(test.normalized.outcome && selected.outcome.has(test.normalized.outcome))) return false
      if (selected.anomaly.size &&
          !test.anomalies.some((a) => selected.anomaly.has(a))) return false
      return true
    })
  }, [data.tests, query, selected])

  // Any change to the filters starts the list again from the top.
  useEffect(() => setVisible(PAGE_SIZE), [query, selected])

  const toggle = (key: FacetKey, value: string) => {
    setSelected((prev) => {
      const next = new Set(prev[key])
      next.has(value) ? next.delete(value) : next.add(value)
      return { ...prev, [key]: next }
    })
  }

  const activeCount = Object.values(selected).reduce((sum, set) => sum + set.size, 0)
  const clearAll = () => {
    setQuery('')
    setSelected({
      psi_id: new Set(), fuel_state: new Set(), material: new Set(),
      outcome: new Set(), anomaly: new Set(),
    })
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[270px_1fr] overflow-hidden">
      {/* ---------------- FACETS ---------------- */}
      <aside className="border-r border-edge overflow-y-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="label">Filters</div>
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-[10px] text-flame hover:underline">
              Clear {activeCount}
            </button>
          )}
        </div>

        <Facet title="Investigation" entries={facets.psi_id} selected={selected.psi_id}
               onToggle={(v) => toggle('psi_id', v)}
               render={(v) => `${v} · ${data.investigations.find((i) => i.psi_id === v)?.acronym ?? ''}`} />
        <Facet title="Fuel state" entries={facets.fuel_state} selected={selected.fuel_state}
               onToggle={(v) => toggle('fuel_state', v)} />
        <Facet title="Material or fuel" entries={facets.material} selected={selected.material}
               onToggle={(v) => toggle('material', v)} limit={14} />
        <Facet title="Outcome" entries={facets.outcome} selected={selected.outcome}
               onToggle={(v) => toggle('outcome', v)} limit={10} />
        <Facet title="Data quality flags" entries={facets.anomaly} selected={selected.anomaly}
               onToggle={(v) => toggle('anomaly', v)} limit={24}
               render={(v) => v.replace(/_/g, ' ')} />
      </aside>

      {/* ---------------- RESULTS ---------------- */}
      <section className="flex flex-col min-h-0">
        {/* Search bar */}
        <div className="p-4 border-b border-edge">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any words — try: heptane disruption, or SIBAL concurrent"
              className="w-full bg-navy/50 border border-edge rounded-md px-4 py-2.5 pr-24 text-sm
                         placeholder:text-mute/60 focus:outline-none focus:border-cryo/60
                         transition-colors duration-200"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 tabular text-xs text-mute">
              {results.length.toLocaleString()} / {data.tests.length.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-deep/95 backdrop-blur-sm z-10">
              <tr className="text-left label border-b border-edge">
                <th className="px-3 py-2.5 font-medium">Investigation</th>
                <th className="px-3 py-2.5 font-medium">Test</th>
                <th className="px-3 py-2.5 font-medium">Material / fuel</th>
                <th className="px-3 py-2.5 font-medium text-right">O₂ %</th>
                <th className="px-3 py-2.5 font-medium text-right">Flow</th>
                <th className="px-3 py-2.5 font-medium text-right">Pressure</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
                <th className="px-3 py-2.5 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, visible).map((test) => {
                const n = test.normalized
                return (
                  <tr
                    key={test.id}
                    onClick={() => setOpen(test)}
                    className="border-b border-edge/40 hover:bg-navy/40 cursor-pointer
                               transition-colors duration-150"
                  >
                    <td className="px-3 py-2 font-mono text-cryo whitespace-nowrap">{test.psi_id}</td>
                    <td className="px-3 py-2 font-mono text-mute whitespace-nowrap">
                      {test.test_number ?? `row ${test.row_index}`}
                    </td>
                    <td className="px-3 py-2 max-w-[260px] truncate" title={n.material_raw ?? ''}>
                      {n.material_raw ?? n.material ?? n.fuel ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{n.o2_percent ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular">
                      {n.flow_cm_s != null ? `${n.flow_cm_s}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular">
                      {n.pressure_atm != null ? `${n.pressure_atm}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300 max-w-[150px] truncate">
                      {n.outcome ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {test.anomalies.slice(0, 2).map((a) => (
                          <span key={a} className="badge badge-warn" title={a.replace(/_/g, ' ')}>
                            {a.split('_')[0]}
                          </span>
                        ))}
                        {test.anomalies.length > 2 && (
                          <span className="badge badge-dead">+{test.anomalies.length - 2}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {results.length === 0 && (
            <div className="p-10 text-center text-mute text-sm">
              Nothing matches. Try fewer words, or clear a filter.
            </div>
          )}

          {visible < results.length && (
            <div className="p-4 text-center">
              <button onClick={() => setVisible((v) => v + PAGE_SIZE * 3)} className="btn text-xs">
                Show more — {(results.length - visible).toLocaleString()} remaining
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- RAW ROW DRAWER ---------------- */}
      {open && (
        <RowDrawer
          test={open}
          data={data}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

/** One group of checkboxes, with a count beside each value. */
function Facet({
  title, entries, selected, onToggle, limit = 20, render,
}: {
  title: string
  entries: [string, number][]
  selected: Set<string>
  onToggle: (value: string) => void
  limit?: number
  render?: (value: string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? entries : entries.slice(0, limit)

  return (
    <section>
      <div className="label mb-1.5">{title}</div>
      <div className="space-y-0.5">
        {shown.map(([value, count]) => (
          <label
            key={value}
            className="flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer
                       hover:bg-navy/50 transition-colors duration-150 group"
          >
            <input
              type="checkbox"
              checked={selected.has(value)}
              onChange={() => onToggle(value)}
              className="w-3 h-3 accent-cryo shrink-0"
            />
            <span className="text-[11px] text-slate-300 group-hover:text-white truncate flex-1">
              {render ? render(value) : value}
            </span>
            <span className="text-[10px] tabular text-mute shrink-0">{count}</span>
          </label>
        ))}
      </div>
      {entries.length > limit && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[10px] text-mute hover:text-cryo transition-colors"
        >
          {expanded ? 'Show fewer' : `Show all ${entries.length}`}
        </button>
      )}
    </section>
  )
}

/** The slide-out panel showing one row exactly as NASA wrote it. */
function RowDrawer({
  test, data, onClose,
}: {
  test: TestRecord
  data: Dataset
  onClose: () => void
}) {
  const investigation = data.investigations.find((i) => i.psi_id === test.psi_id)

  // Rendered straight onto <body> with a portal. Without this the drawer is
  // trapped inside the page layout and the sticky top bar paints over its
  // header, which makes the Close button unclickable.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-void/70 backdrop-blur-sm anim-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-deep border-l border-edge overflow-y-auto anim-slide-in">
        <div className="sticky top-0 bg-deep/95 backdrop-blur-sm border-b border-edge px-5 py-4
                        flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-cryo text-sm">
              {test.psi_id} · {test.test_number ?? `row ${test.row_index}`}
            </div>
            <div className="text-xs text-mute mt-0.5">{investigation?.title}</div>
          </div>
          <button onClick={onClose} className="btn px-2.5 py-1 text-xs">Close</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Flags first — they are the reason to look at a row closely. */}
          {test.anomalies.length > 0 && (
            <section>
              <div className="label mb-2">Data quality flags</div>
              <div className="space-y-2">
                {test.anomalies.map((flag) => (
                  <div key={flag} className="panel-flat p-2.5">
                    <span className="badge badge-warn">{flag.replace(/_/g, ' ')}</span>
                    <p className="mt-1.5 text-[11px] text-slate-300">
                      {data.findings.anomaly_descriptions[flag] ?? 'Flagged during processing.'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* The untouched original row. Nothing here is cleaned or changed. */}
          <section>
            <div className="label mb-2">Original CSV row, exactly as recorded</div>
            <div className="panel-flat divide-y divide-edge/50">
              {Object.entries(test.raw).map(([key, value]) => (
                <div key={key} className="px-3 py-1.5 grid grid-cols-[1fr_1fr] gap-3 text-[11px]">
                  <span className="text-mute truncate" title={key}>{key}</span>
                  <span className={`tabular ${value ? 'text-slate-200' : 'text-mute/40'}`}>
                    {value ?? 'empty'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Citation */}
          <section>
            <div className="label mb-2">Cite this</div>
            <div className="panel-flat p-3 text-[11px] space-y-1.5">
              <div className="text-slate-300">{investigation?.title}</div>
              <div className="text-mute">
                NASA Physical Sciences Informatics · {test.psi_id}
              </div>
              {investigation?.doi ? (
                <a href={investigation.doi_url!} target="_blank" rel="noreferrer"
                   className="text-cryo hover:underline block">
                  DOI {investigation.doi} ↗
                </a>
              ) : (
                <div className="text-star/80">DOI not yet recorded for this investigation</div>
              )}
              <a href={investigation?.psi_url} target="_blank" rel="noreferrer"
                 className="text-mute hover:text-cryo block transition-colors">
                View the original record ↗
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
