// =============================================================================
//  TAB 2 — EXPERIMENT LAB
// =============================================================================
//      LEFT   choose what burns, which investigation, and the conditions --
//             every control offers ONLY values NASA recorded
//      MIDDLE the 3D workspace: recorded geometry, recorded airflow
//      RIGHT  what actually happened in the matching tests
//
//  There is no "nearest test" guessing any more. The matching set is exactly
//  the tests whose recorded values equal your choices, and it always holds a
//  single material.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../data'
import { cardFor, evaluateFlexModel, invLabel } from '../data'
import { DIMENSIONS, applySelection, optionsFor, recorded } from '../lab/dimensions'
import type { Option, Selection, State } from '../lab/dimensions'
import { OUTCOME_MEANINGS, summarise, summariseOutcomes } from '../outcomes'
import type { NumericSummary } from '../outcomes'
import type { TestRecord } from '../types'
import FlammabilityMap from './FlammabilityMap'
import Workspace from './Workspace'
import type { SampleShape } from './Workspace'

type Gravity = '0g' | 'moon' | 'mars' | '1g'

const STATE_LABEL: Record<State, string> = { solid: 'Solid', liquid: 'Droplet', gas: 'Gas' }
const SHAPES: SampleShape[] = ['rod', 'sphere', 'slab', 'film', 'fabric', 'sheet', 'composite sheet', 'candle', 'spherical section']

const median = (v: (number | null | undefined)[]) => {
  const s = summarise(v.filter((x): x is number => typeof x === 'number'))
  return s ? s.median : null
}
const mostCommon = (v: (string | null | undefined)[]) => {
  const c = new Map<string, number>()
  v.forEach((x) => x && c.set(x, (c.get(x) ?? 0) + 1))
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export default function TabLab({ data, onInspect }: { data: Dataset; onInspect: (m: string) => void }) {
  const [state, setState] = useState<State>('solid')
  const [inv, setInv] = useState<string>('all')
  const [material, setMaterial] = useState<Record<State, string>>({ solid: 'PMMA', liquid: 'Heptane', gas: 'Butane (30%)' })
  const [sel, setSel] = useState<Selection>({})
  const [gravity, setGravity] = useState<Gravity>('0g')
  const [lit, setLit] = useState(true)
  const [moonCheck, setMoonCheck] = useState(false)

  // ---- The pool of real tests for this state ----------------------------
  const pool = useMemo(() => data.tests.filter((t) => !t.is_note && !t.is_flow_vis
    && t.normalized.fuel_state === state && !t.normalized.is_range_summary && !t.normalized.is_maintenance
    && t.normalized.material), [data.tests, state])

  const invOptions = useMemo(() => [...new Set(pool.map((t) => t.psi_id))]
    .map((id) => data.investigations.find((i) => i.psi_id === id)!).filter(Boolean), [pool, data.investigations])

  const inInv = useMemo(() => (inv === 'all' ? pool : pool.filter((t) => t.psi_id === inv)), [pool, inv])

  const materialOptions = useMemo(() => {
    const c = new Map<string, number>()
    inInv.forEach((t) => c.set(t.normalized.material!, (c.get(t.normalized.material!) ?? 0) + 1))
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [inInv])

  const chosen = materialOptions.some(([m]) => m === material[state]) ? material[state] : materialOptions[0]?.[0]
  const rows = useMemo(() => inInv.filter((t) => t.normalized.material === chosen), [inInv, chosen])

  // Changing what burns starts the conditions afresh.
  useEffect(() => { setSel({}); setMoonCheck(false); setGravity('0g') }, [state, inv, chosen])

  const dims = DIMENSIONS.filter((d) => d.states.includes(state))
  const result = useMemo(() => applySelection(rows, sel), [rows, sel])
  const has1g = result.some((t) => t.normalized.has_1g_reference)
  useEffect(() => { if (gravity === '1g' && !has1g) setGravity('0g') }, [has1g, gravity])

  const noData = gravity === 'moon' || gravity === 'mars'
  const outcomes = useMemo(() => summariseOutcomes(result, gravity === '1g' ? '1g' : '0g'), [result, gravity])
  const card = chosen ? cardFor(data, chosen, state) : undefined

  // ---- What the 3D model shows, taken from the matching tests ------------
  const geometry = (sel.geometry ?? mostCommon(result.map((t) => t.normalized.geometry))) as string | null
  const shape: SampleShape = state === 'liquid' ? 'droplet' : state === 'gas' ? 'burner'
    : (SHAPES.includes(geometry as SampleShape) ? geometry as SampleShape : 'slab')
  const sameShape = result.filter((t) => t.normalized.geometry === geometry)
  const sampleDims = {
    diameter_mm: median(sameShape.map((t) => t.normalized.diameter_mm)),
    thickness_mm: median(sameShape.map((t) => t.normalized.thickness_mm)),
    width_mm: median(sameShape.map((t) => t.normalized.width_mm)),
  }
  const flowShown = sel.flow != null ? Number(sel.flow) : median(result.map((t) => t.normalized.flow_cm_s))
  const direction = (sel.direction ?? mostCommon(result.map((t) => t.normalized.flow_direction))) as
    'concurrent' | 'opposed' | 'stagnation' | null
  const o2Shown = sel.o2 != null ? Number(sel.o2) : median(result.map((t) => t.normalized.o2_percent))
  const d0 = median(result.map((t) => t.normalized.droplet_d0_mm))
  const dExt = median(result.map((t) => t.normalized.extinction_d_mm))
  const burnT = median(result.map((t) => t.normalized.burn_time_s))
  const fiberAll = result.length > 0 && result.every((t) => t.normalized.fiber_supported === true)
  const neverLit = result.length > 0 && result.every((t) => ['no_ignition_gas', 'no_ignition', 'no_sustained_flame']
    .includes(t.normalized.outcome_class ?? ''))
  const intensity = o2Shown != null ? Math.max(0.15, Math.min(1, (o2Shown - 11) / 25)) : 0.5
  const soot = o2Shown != null ? Math.max(0, Math.min(1, 1 - (o2Shown - 18) / 22)) : 0.7

  // ---- FLEX model, evaluated at the matched tests' recorded conditions ---
  const flex = useMemo(() => {
    if (state !== 'liquid' || !['Methanol', 'Heptane'].includes(chosen ?? '') || !result.length) return null
    const flexRows = result.filter((t) => t.psi_id === 'PSI-69')
    if (!flexRows.length) return null
    const m = (k: keyof TestRecord['normalized']) => median(flexRows.map((t) => t.normalized[k] as number | null))
    const inputs = { isHeptane: chosen === 'Heptane', o2: m('o2_mole_fraction') ?? 0, co2: m('co2_mole_fraction') ?? 0,
      he: m('he_mole_fraction') ?? 0, pressureMmHg: m('pressure_mmhg') ?? 0, d0: m('droplet_d0_mm') ?? 0 }
    return { ...evaluateFlexModel(data.flexModel, inputs), n: flexRows.length }
  }, [state, chosen, result, data.flexModel])

  // ---- Moon-base check: choose the recorded values nearest the habitat ---
  const runMoonCheck = () => {
    const next: Selection = {}
    const o2dim = DIMENSIONS.find((d) => d.key === 'o2')!
    const o2opts = optionsFor(o2dim, rows, {})
    const best = o2opts.reduce<Option | null>((b, o) => (!b || Math.abs(Number(o.key) - 30) < Math.abs(Number(b.key) - 30) ? o : b), null)
    if (best && Math.abs(Number(best.key) - 30) <= 2) next.o2 = best.key
    if (state !== 'solid') {
      const pdim = DIMENSIONS.find((d) => d.key === 'pressure')!
      const popts = optionsFor(pdim, rows, next)
      const bp = popts.reduce<Option | null>((b, o) => (!b || Math.abs(Number(o.key) - 0.69) < Math.abs(Number(b.key) - 0.69) ? o : b), null)
      if (bp && Math.abs(Number(bp.key) - 0.69) <= 0.06) next.pressure = bp.key
    }
    setSel(next)
    setMoonCheck(true)
  }
  const moonReport = useMemo(() => {
    if (!moonCheck) return null
    const o2Max = card?.o2_range?.max ?? null
    const kpa = card?.pressure_kpa_range
    return [
      { ok: o2Max != null && o2Max >= 28, text: o2Max == null ? 'Oxygen is not recorded for this material.'
          : `Highest recorded oxygen: ${o2Max}% (habitat plan: about 30%).` },
      { ok: !!kpa && kpa.min <= 75, text: state === 'solid' ? 'No solid-fuel table records pressure, so reduced pressure (about 70 kPa) is untested here.'
          : kpa ? `Recorded pressure: ${kpa.min}–${kpa.max} kPa (habitat plan: about 70 kPa).` : 'Pressure is not recorded.' },
      { ok: false, text: 'Lunar gravity (0.16 g): no data in PSI. The 3D view and outcomes are switched off.' },
    ]
  }, [moonCheck, card, state])
  useEffect(() => { if (moonCheck) setGravity('moon') }, [moonCheck])

  const highlight = useMemo(() => new Set(result.map((t) => t.id)), [result])
  const mapTests = useMemo(() => rows.filter((t) => ['PSI-25', 'PSI-98', 'PSI-99'].includes(t.psi_id)), [rows])

  return (
    // xl:grid-rows-[minmax(0,1fr)] matters: an `auto` row grows to the tallest
    // column's content, which made the 3D canvas taller than the screen and
    // pushed the sample out of view.
    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_340px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">

      {/* ============================ LEFT ============================ */}
      <aside className="md:border-r border-edge xl:overflow-y-auto p-3 space-y-4 text-[12px] order-2 md:order-1">
        <Group title="What is burning">
          <div className="grid grid-cols-3 gap-1">
            {(['solid', 'liquid', 'gas'] as State[]).map((s) => (
              <button key={s} onClick={() => { setState(s); setInv('all') }}
                      className={`btn !px-1 !py-1.5 text-[11px] ${state === s ? 'btn-active' : ''}`}>{STATE_LABEL[s]}</button>
            ))}
          </div>
        </Group>

        <Group title="Investigation">
          <select value={inv} onChange={(e) => setInv(e.target.value)}
                  className="w-full bg-navy/60 border border-edge rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cryo/60">
            <option value="all">All investigations with this fuel state</option>
            {invOptions.map((i) => <option key={i.psi_id} value={i.psi_id}>{i.psi_id} · {i.acronym} — {i.title}</option>)}
          </select>
          {inv !== 'all' && (
            <p className="mt-1.5 text-[10px] text-mute leading-snug">
              {data.investigations.find((i) => i.psi_id === inv)?.summary}
            </p>
          )}
        </Group>

        <Group title={state === 'solid' ? 'Material' : 'Fuel'}>
          <div className="flex flex-wrap gap-1">
            {materialOptions.map(([m, c]) => (
              <button key={m} onClick={() => setMaterial((p) => ({ ...p, [state]: m }))}
                      className={`px-2 py-1 rounded text-[11px] border transition-all duration-200
                        ${chosen === m ? 'border-cryo/70 bg-cryo/15 text-white' : 'border-edge text-mute hover:text-slate-200 hover:border-mute/50'}`}>
                {m} <span className="tabular text-[9px] opacity-60">{c}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Recorded conditions">
          <p className="text-[10px] text-mute -mt-0.5 mb-2 leading-snug">
            Only values NASA recorded for {chosen}. Each choice narrows the others.
          </p>
          <div className="space-y-3">
            {dims.map((d) => recorded(d, rows) ? (
              <StepControl key={d.key} label={d.label} options={optionsFor(d, rows, sel)} value={sel[d.key] ?? null}
                           onChange={(v) => setSel((p) => ({ ...p, [d.key]: v }))} />
            ) : (
              <div key={d.key} className="opacity-60">
                <div className="text-[10px] text-mute">{d.label}</div>
                <div className="text-[10px] text-mute/70 italic">{d.missingNote}</div>
              </div>
            ))}
            {state === 'solid' && (
              <div className="opacity-60">
                <div className="text-[10px] text-mute">Pressure</div>
                <div className="text-[10px] text-mute/70 italic">No solid-fuel table in this dataset records pressure.</div>
              </div>
            )}
          </div>
          {Object.values(sel).some((v) => v != null) && (
            <button onClick={() => { setSel({}); setMoonCheck(false) }} className="mt-2 text-[10px] text-flame hover:underline">Clear conditions</button>
          )}
        </Group>

        <GravityTrack gravity={gravity} setGravity={(g) => { setGravity(g); if (g !== 'moon') setMoonCheck(false) }} has1g={has1g} />

        <button onClick={runMoonCheck} className="btn w-full !py-1.5 text-[10px] border-star/40 text-star">
          Check Moon-base conditions (30% O₂, 10.2 psi, 0.16 g)
        </button>
        {moonReport && (
          <div className="panel-flat p-2 space-y-1.5 anim-fade-in">
            {moonReport.map((r, i) => (
              <div key={i} className="flex gap-1.5 text-[10px] leading-snug">
                <span className={r.ok ? 'text-cryo' : 'text-flame'}>{r.ok ? '✓' : '✕'}</span>
                <span className="text-slate-300">{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* ============================ MIDDLE ============================ */}
      <section className="relative min-h-[420px] md:min-h-[520px] xl:min-h-0 order-1 md:order-2">
        <Workspace shape={shape} dims={sampleDims} lit={lit && !neverLit && !noData}
                   gravity={noData ? 'none' : gravity === '1g' ? '1g' : '0g'}
                   intensity={intensity} soot={soot}
                   flowCmS={state === 'solid' ? flowShown : null} direction={state === 'solid' ? direction : null}
                   droplet={state === 'liquid' ? { d0: d0 ?? 2.5, dExt, burnTime: burnT } : null}
                   fiber={fiberAll} />

        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          <span className={`badge ${noData ? 'badge-alert' : 'badge-ok'}`}>
            {noData ? 'No data at this gravity' : `Recorded conditions · ${result.length} matching test${result.length === 1 ? '' : 's'}`}
          </span>
          <span className="badge badge-dead">Illustrative flame</span>
        </div>

        {noData && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="panel max-w-sm p-4 text-center anim-fade-up">
              <div className="badge badge-warn mb-2">Hypothesis zone</div>
              <p className="text-[12px] text-slate-200">
                NASA PSI has no combustion data at {gravity === 'moon' ? '0.16 g (Moon)' : '0.38 g (Mars)'}.
              </p>
              <p className="text-[11px] text-mute mt-2 leading-snug">
                Partial-gravity flame tests exist from parabolic flights and LUCI, but not in PSI. The idea that
                flame spread peaks near lunar gravity is a hypothesis; NASA's FM2 experiment is built to test it.
              </p>
            </div>
          </div>
        )}

        {!noData && neverLit && (
          <div className="absolute top-12 left-3 panel px-3 py-2 text-[11px] text-slate-300 max-w-xs anim-fade-in">
            None of the matching tests established a flame, so none is drawn.
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setLit((v) => !v)} className={`btn-ignite !px-4 !py-2 !text-xs ${lit ? 'is-lit' : ''}`}>
            {lit ? 'Extinguish' : 'Ignite'}
          </button>
          <div className="panel px-2.5 py-1.5 text-[10px] text-slate-300 max-w-full">
            {describeSample(shape, chosen, sampleDims, d0, state)}
            {state === 'solid' && flowShown != null && <> · <span className="text-white">{flowShown} cm/s</span> {direction ?? 'direction not recorded'} flow</>}
          </div>
          <div className="ml-auto panel px-2.5 py-1.5 text-[10px] text-mute hidden sm:block">drag to orbit · scroll to zoom</div>
        </div>
      </section>

      {/* ============================ RIGHT ============================ */}
      <aside className="border-t md:border-t-0 xl:border-l border-edge xl:overflow-y-auto p-3 space-y-3 text-[12px] order-3 md:col-span-2 xl:col-span-1">
        <div>
          <div className="label">What happened in real tests</div>
          <h3 className="text-base font-semibold mt-0.5">{chosen}{gravity === '1g' ? ' · 1 g reference' : ''}</h3>
          <p className="text-[10px] text-mute mt-0.5">
            {outcomes.sampled} matching test{outcomes.sampled === 1 ? '' : 's'}
            {result.length > outcomes.sampled && ` (${result.length - outcomes.sampled} with implausible O₂ readings left out)`}
            {outcomes.sources.length > 0 && ` · ${outcomes.sources.map((s) => invLabel(data, s)).join(', ')}`}
          </p>
        </div>

        {noData ? (
          <div className="panel p-3 border-star/40">
            <span className="badge badge-alert">No data</span>
            <p className="mt-1.5 text-[11px] text-slate-300">No outcome can be shown at partial gravity: nothing was measured there.</p>
          </div>
        ) : (
          <>
            {outcomes.ignition && (
              <div className="panel p-3 anim-slide-in">
                <div className="label mb-2">Did it ignite?</div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold tabular text-cryo">{outcomes.ignition.ignited}</span>
                  <span className="text-mute mb-1 text-[11px]">of {outcomes.ignition.ignited + outcomes.ignition.failed} ignited</span>
                </div>
                <Bar value={outcomes.ignition.ignited / Math.max(1, outcomes.ignition.ignited + outcomes.ignition.failed)} />
              </div>
            )}

            {outcomes.outcomes.length > 0 && (
              <div className="panel p-3 anim-slide-in">
                <div className="label mb-2">How it ended</div>
                <div className="space-y-2">
                  {outcomes.outcomes.map((o) => (
                    <div key={o.cls}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-200 text-[11px]">{o.label}</span>
                        <span className="tabular text-[11px] text-mute">{o.count} · {(o.share * 100).toFixed(0)}%</span>
                      </div>
                      <Bar value={o.share} />
                      {OUTCOME_MEANINGS[o.cls] && <p className="text-[10px] text-mute mt-0.5">{OUTCOME_MEANINGS[o.cls]}</p>}
                    </div>
                  ))}
                </div>
                {outcomes.sources.includes('PSI-25') && (
                  <p className="mt-2 text-[9.5px] text-mute leading-snug">
                    Categories are this project's reading of NASA's test-matrix notes (BASS-II Summary Report,
                    Appendix A). NASA's own words are quoted below.
                  </p>
                )}
              </div>
            )}

            {outcomes.quotes.length > 0 && gravity === '0g' && (
              <div className="panel p-3 anim-slide-in">
                <div className="label mb-2">In NASA's words</div>
                <div className="space-y-2">
                  {outcomes.quotes.map((q) => (
                    <blockquote key={q.test} className="text-[10.5px] text-slate-300 leading-snug border-l-2 border-edge pl-2">
                      “{q.text}”
                      <div className="text-[9px] text-mute mt-0.5 font-mono">{q.psi} {q.test} · {q.source}</div>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {outcomes.burnTime && <Measurement title="How long it burned" unit="s" s={outcomes.burnTime} />}
            {outcomes.extinctionDiameter && <Measurement title="Diameter at visible extinction" unit="mm" s={outcomes.extinctionDiameter} />}
            {outcomes.spreadRate && <Measurement title="Flame spread rate" unit="mm/s" s={outcomes.spreadRate} />}
            {outcomes.peakTemp && <Measurement title="Peak burner temperature" unit="°C" s={outcomes.peakTemp} />}

            {(outcomes.coolFlamesRecorded > 0 || outcomes.coolFlameTerritory > 0) && (
              <div className="panel p-3 border-star/45 anim-slide-in">
                {outcomes.coolFlamesRecorded > 0 && (
                  <><span className="badge badge-warn">{outcomes.coolFlamesRecorded} cool flames recorded</span>
                    <p className="mt-1.5 text-[11px] text-slate-300">CFI-G logged these as cool flames: low-temperature burning that gives off little light.</p></>
                )}
                {outcomes.coolFlameTerritory > 0 && (
                  <><span className="badge badge-dead mt-1">{outcomes.coolFlameTerritory} tests in cool-flame territory</span>
                    <p className="mt-1.5 text-[11px] text-slate-300">
                      Heptane droplets above 2.4 mm, where FLEX researchers reported burning continuing invisibly after
                      visible extinction. The table records visible extinction only, so these are not counted as observed cool flames.
                    </p></>
                )}
              </div>
            )}

            {outcomes.noOutcomeReason && (
              <div className="panel p-3 anim-slide-in">
                <span className="badge badge-dead">No outcome recorded</span>
                <p className="mt-1.5 text-[11px] text-slate-300">{outcomes.noOutcomeReason}</p>
              </div>
            )}
          </>
        )}

        {/* 0 g vs 1 g, where SAFFIRE-II recorded both */}
        {result.some((t) => t.normalized.has_1g_reference) && (
          <div className="panel p-3 anim-slide-in">
            <div className="label mb-2">Same sample, both gravities</div>
            <table className="w-full text-[10.5px]">
              <thead><tr className="text-mute text-left"><th className="font-normal">Sample</th><th className="font-normal">0 g burn</th><th className="font-normal">1 g burn</th></tr></thead>
              <tbody>
                {result.filter((t) => t.normalized.has_1g_reference).map((t) => (
                  <tr key={t.id} className="border-t border-edge/50">
                    <td className="py-1 font-mono text-cryo">{t.test_number}</td>
                    <td className="py-1 text-slate-300">{t.normalized.burn_length_0g_raw as string}</td>
                    <td className="py-1 text-slate-300">{t.normalized.burn_length_1g_raw as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[9.5px] text-mute mt-1.5">PSI-99 SAFFIRE-II burn length columns · DOI 10.60555/2chp-m469</p>
          </div>
        )}

        {flex && (
          <div className="panel p-3 anim-slide-in">
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">Fitted FLEX model</div>
              <span className="badge badge-dead">{flex.n} FLEX tests matched</span>
            </div>
            {flex.shown ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tabular text-cryo">{(flex.probability * 100).toFixed(0)}%</span>
                  <span className="text-[10px] text-mute mb-1">fitted chance of extinction at these conditions</span>
                </div>
                <Bar value={flex.probability} />
              </>
            ) : (
              <><span className="badge badge-alert">Not shown</span>
                <p className="mt-1.5 text-[10px] text-slate-300">{flex.reasons.join('; ')}.</p></>
            )}
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9.5px] tabular text-mute">
              <span>accuracy {(data.flexModel.metrics.accuracy * 100).toFixed(0)}%</span>
              <span>always-extinction baseline {(data.flexModel.metrics.baseline_accuracy * 100).toFixed(0)}%</span>
              <span>balanced accuracy {(data.flexModel.metrics.balanced_accuracy * 100).toFixed(0)}%</span>
              <span>AUC {data.flexModel.metrics.auc.toFixed(2)}</span>
            </div>
            <p className="mt-1.5 text-[9px] text-mute leading-snug">
              {data.flexModel.metrics.validation}. {data.flexModel.disclaimer}
            </p>
          </div>
        )}

        {state === 'solid' && mapTests.length >= 3 && (
          <div className="panel p-3">
            <div className="label mb-1">Where {chosen} flames survived</div>
            <p className="text-[10px] text-mute mb-2 leading-snug">
              Every recorded {chosen} test by oxygen and airflow. No boundary is fitted: the points are the evidence.
            </p>
            <FlammabilityMap tests={mapTests} highlight={highlight}
                             selectedO2={sel.o2 != null ? Number(sel.o2) : null}
                             selectedFlow={sel.flow != null ? Number(sel.flow) : null} />
          </div>
        )}

        <div>
          <div className="label mb-1.5">Matching tests</div>
          <div className="space-y-1.5">
            {result.slice(0, 8).map((t) => <TestChip key={t.id} t={t} data={data} />)}
            {result.length > 8 && <p className="text-[10px] text-mute">and {result.length - 8} more</p>}
          </div>
        </div>
        {chosen && (
          <button onClick={() => onInspect(chosen)} className="btn w-full !py-1.5 text-[10px]">
            Inspect all {chosen} rows in the Data Library →
          </button>
        )}
      </aside>
    </div>
  )
}

// =============================================================================

function describeSample(shape: SampleShape, name: string | undefined, d: { diameter_mm: number | null; thickness_mm: number | null; width_mm: number | null }, d0: number | null, state: State) {
  if (state === 'liquid') return `${name} droplet${d0 != null ? ` · ${d0.toFixed(2)} mm initial diameter (median recorded)` : ' · diameter not recorded in this table'}`
  if (state === 'gas') return `${name} · gas burner (nozzle size not recorded here)`
  const parts = [`${name} ${shape}`]
  if (d.diameter_mm) parts.push(`${d.diameter_mm} mm diameter`)
  if (d.thickness_mm) parts.push(`${d.thickness_mm} mm thick`)
  if (d.width_mm && shape !== 'rod') parts.push(`${d.width_mm} mm wide`)
  if (parts.length === 1) parts.push('size not recorded')
  return parts.join(' · ')
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><div className="label mb-1.5">{title}</div>{children}</section>
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 rounded-full bg-navy overflow-hidden">
      <div className="h-full bg-gradient-to-r from-cryo to-star transition-all duration-500" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  )
}

function Measurement({ title, unit, s }: { title: string; unit: string; s: NumericSummary }) {
  const f = (v: number) => v.toFixed(v < 10 ? 1 : 0)
  return (
    <div className="panel p-3 anim-slide-in">
      <div className="flex items-baseline justify-between">
        <div className="label">{title}</div>
        <span className="text-[9px] text-mute tabular">{s.count} tests</span>
      </div>
      <div className="flex items-end gap-1.5 mt-1">
        <span className="text-2xl font-bold tabular text-slate-100">{f(s.median)}</span>
        <span className="text-[11px] text-mute mb-1">{unit} median</span>
      </div>
      <div className="mt-1 text-[10px] tabular text-mute">range {f(s.min)} – {f(s.max)} {unit}</div>
    </div>
  )
}

/** A control that offers only recorded values: chips when there are a few,
 *  a stepped slider (one stop per recorded value) when there are many. */
function StepControl({ label, options, value, onChange }: {
  label: string; options: Option[]; value: string | null; onChange: (v: string | null) => void
}) {
  const idx = value == null ? -1 : options.findIndex((o) => o.key === value)
  const current = idx >= 0 ? options[idx] : null
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <span className="text-[10px] text-mute">{label}</span>
        <span className="tabular text-[11px] text-slate-200 text-right">
          {current ? <>{current.label} <span className="text-mute text-[9px]">({current.count})</span></> : <span className="text-mute">any of {options.length}</span>}
        </span>
      </div>
      {options.length <= 6 ? (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button key={o.key} onClick={() => onChange(value === o.key ? null : o.key)} title={o.detail}
                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors duration-150
                      ${value === o.key ? 'border-cryo/70 bg-cryo/15 text-white' : 'border-edge text-mute hover:text-slate-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={options.length - 1} step={1} value={Math.max(0, idx)}
                 aria-label={`${label}: recorded values`}
                 onChange={(e) => onChange(options[Number(e.target.value)].key)}
                 className={idx < 0 ? 'opacity-40' : ''} />
          {value != null && <button onClick={() => onChange(null)} className="text-[9px] text-mute hover:text-flame shrink-0">any</button>}
        </div>
      )}
      {current?.detail && <div className="text-[9px] text-mute mt-0.5">{current.detail}</div>}
    </div>
  )
}

/** Gravity: two measured ends and a hatched band of no data between them.
 *  Moon and Mars are selectable so you can SEE that there is nothing there. */
function GravityTrack({ gravity, setGravity, has1g }: { gravity: Gravity; setGravity: (g: Gravity) => void; has1g: boolean }) {
  const stops: { g: Gravity; label: string; pos: number; disabled?: boolean }[] = [
    { g: '0g', label: '0 g', pos: 0 },
    { g: 'moon', label: 'Moon', pos: 16 },
    { g: 'mars', label: 'Mars', pos: 38 },
    { g: '1g', label: '1 g', pos: 100, disabled: !has1g },
  ]
  return (
    <section>
      <div className="label mb-1.5">Gravity</div>
      <div className="relative h-9 mx-3">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full overflow-hidden border border-edge">
          <div className="absolute inset-y-0 left-0 w-[4%] bg-cryo/40" />
          <div className="absolute inset-y-0 left-[4%] right-[4%] hatched" />
          <div className="absolute inset-y-0 right-0 w-[4%] bg-ember/40" />
        </div>
        {stops.map((s) => (
          <button key={s.g} onClick={() => !s.disabled && setGravity(s.g)} disabled={s.disabled}
                  title={s.disabled ? 'No normal-gravity result is recorded for these tests' : undefined}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group disabled:cursor-not-allowed"
                  style={{ left: `${s.pos}%` }}>
            <span className={`block w-3.5 h-3.5 rounded-full border-2 transition-all duration-200
              ${gravity === s.g ? (s.g === 'moon' || s.g === 'mars' ? 'bg-star border-star scale-125' : 'bg-cryo border-cryo scale-125')
                : s.disabled ? 'bg-deep border-edge' : 'bg-deep border-mute group-hover:border-slate-200'}`} />
            <span className={`absolute top-4 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap
              ${s.g === 'moon' || s.g === 'mars' ? 'text-star' : s.disabled ? 'text-mute/40' : 'text-mute'}`}>{s.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-mute leading-snug">
        Only 0 g (flight) and 1 g (where a reference exists) were measured. The hatched band has no PSI data;
        Moon and Mars show that honestly instead of a guess.
      </p>
    </section>
  )
}

function TestChip({ t, data }: { t: TestRecord; data: Dataset }) {
  const n = t.normalized
  const inv = data.investigations.find((i) => i.psi_id === t.psi_id)
  return (
    <div className="panel-flat p-2 hover:border-cryo/40 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-cryo">{invLabel(data, t.psi_id)} · {t.test_number ?? `row ${t.row_index}`}</span>
        {inv?.doi_url && <a href={inv.doi_url} target="_blank" rel="noreferrer" className="text-[9px] text-mute hover:text-cryo">DOI ↗</a>}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] tabular text-mute">
        {(n.o2_display ?? n.o2_percent) != null && <span>O₂ {n.o2_display ?? `${n.o2_percent}%`}</span>}
        {n.flow_sequence_cm_s.length > 1 ? <span>{n.flow_sequence_cm_s.join(' → ')} cm/s</span>
          : n.flow_cm_s != null && <span>{n.flow_cm_s} cm/s</span>}
        {n.pressure_atm != null && <span>{n.pressure_atm} atm</span>}
        {n.droplet_d0_mm != null && <span>d₀ {n.droplet_d0_mm} mm</span>}
        {n.burn_time_s != null && <span className="text-slate-300">{n.burn_time_s} s</span>}
      </div>
      {n.outcome && <div className="mt-1 text-[10px] text-star">{n.outcome}</div>}
    </div>
  )
}
