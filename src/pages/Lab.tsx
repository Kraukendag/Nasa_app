// =============================================================================
//  EXPERIMENT LAB
// =============================================================================
//      LEFT    what burns, which investigation, and the conditions -- every
//              control offers ONLY values NASA recorded (src/lab/dimensions.ts)
//      CENTRE  three figures: the 3D specimen (ignited at the top, spreading
//              until it engulfs the sample or stops the way the tests ended),
//              a 2D schematic with the recorded dimensions, and the
//              flammability map of every test of this material
//      RIGHT   what actually happened in the matching tests
//
//  The matching set is exactly the tests whose recorded values equal your
//  choices, and always holds a single material. Nothing is interpolated.
// =============================================================================

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { go } from '../App'
import type { Dataset } from '../data'
import { cardFor, evaluateFlexModel, invLabel } from '../data'
import FlammabilityMap from '../components/FlammabilityMap'
import Schematic from '../components/Schematic'
import type { BurnerKind, Ending, SampleShape, Timeline } from '../components/Specimen'
import { decideRegime } from '../lab/regime'
import type { Regime } from '../lab/regime'
import { DIMENSIONS, applySelection, optionsFor, recorded } from '../lab/dimensions'
import type { Option, Selection, State } from '../lab/dimensions'
import { OUTCOME_MEANINGS, summarise, summariseOutcomes } from '../outcomes'
import type { NumericSummary } from '../outcomes'
import type { TestRecord } from '../types'
import { LitCite } from '../ui'
import { mediaFor, mediaUrl } from '../media'

// Three.js is only downloaded when the Lab is opened.
const Specimen = lazy(() => import('../components/Specimen'))

type Gravity = '0g' | 'moon' | 'mars' | '1g'

const STATE_LABEL: Record<State, string> = { solid: 'Solid', liquid: 'Liquid droplet', gas: 'Gas' }
const SHAPES: SampleShape[] = ['rod', 'sphere', 'slab', 'film', 'fabric', 'sheet', 'composite sheet', 'candle', 'spherical section']

/** Which way each gas investigation delivers its fuel (see the hardware notes
 *  in each investigation's PSI description). */
const BURNER: Record<string, BurnerKind> = { 'PSI-159': 'sphere', 'PSI-20': 'disk', 'PSI-107': 'jet', 'PSI-22': 'jet' }

/** How a recorded ending is drawn. Several categories mean "it went out
 *  partway"; the animation cannot tell them apart, the right panel does. */
const ENDING: Record<string, Ending> = {
  burned_entire: 'full', burned_sustained: 'full', Completion: 'full',
  blowoff: 'blowoff',
  extinguished_low_flow: 'partial', extinguished_flow_stopped: 'partial', self_extinguished: 'partial',
  extinguished: 'partial', partial_burn: 'partial', Extinction: 'partial', self_extinguished_gas: 'partial',
  no_sustained_flame: 'brief', negligible_burn: 'brief',
  no_ignition: 'none', no_ignition_gas: 'none',
}
const ENDING_WORDS: Record<State, Record<Ending, string>> = {
  solid: {
    full: 'Ignited at the top, the flame spreads until it has engulfed the sample',
    partial: 'Ignited at the top, the flame spreads partway, then goes out',
    brief: 'The flame flashes at the igniter, then dies',
    blowoff: 'Ignited at the top, the flame is blown off by the airflow',
    none: 'The sample never ignites',
  },
  liquid: {
    full: 'The droplet burns until it is used up',
    partial: 'The flame goes out before the droplet is used up',
    brief: 'A flame appears, then dies',
    blowoff: 'The flame is blown off',
    none: 'The droplet never ignites',
  },
  gas: {
    full: 'The flame burns steadily on the burner',
    partial: 'The flame burns, then goes out on its own',
    brief: 'A flame appears, then dies',
    blowoff: 'The flame lifts off and goes out',
    none: 'The fuel never ignites',
  },
}

const median = (v: (number | null | undefined)[]) => summarise(v.filter((x): x is number => typeof x === 'number'))?.median ?? null
const mostCommon = (v: (string | null | undefined)[]) => {
  const c = new Map<string, number>()
  v.forEach((x) => x && c.set(x, (c.get(x) ?? 0) + 1))
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
const nums = (v: (number | null | undefined)[]) => v.filter((x): x is number => typeof x === 'number')
const modeNum = (v: (number | null | undefined)[]) => {
  const m = mostCommon(nums(v).map(String))
  return m == null ? null : Number(m)
}
const onlyValue = (v: (number | null | undefined)[]) => {
  const u = [...new Set(nums(v))]
  return u.length === 1 ? u[0] : null
}
/** "13.6–22.2" for a set of recorded values, or the one value. */
const rangeText = (v: (number | null | undefined)[], d: number) => {
  const n = nums(v)
  if (!n.length) return null
  const lo = Math.min(...n), hi = Math.max(...n)
  return lo === hi ? `${+lo.toFixed(d)}` : `${+lo.toFixed(d)}–${+hi.toFixed(d)}`
}
/** Medians of two recorded values can carry float noise (18.299999...); round for display. */
const round = (v: number | null, d: number) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

/** The Lab's choices as they appear in a shareable link (#/lab/<json>). */
interface LabLink { s?: State; i?: string; m?: string; c?: Selection; g?: Gravity }
function readLink(arg: string | null): LabLink {
  if (!arg) return {}
  try { return JSON.parse(arg) as LabLink } catch { return {} }
}

export default function Lab({ data, arg = null }: { data: Dataset; arg?: string | null }) {
  const link = useMemo(() => readLink(arg), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState<State>(link.s ?? 'solid')
  const [inv, setInv] = useState<string>(link.i ?? 'all')
  const [material, setMaterial] = useState<Record<State, string>>({ solid: 'PMMA', liquid: 'Heptane', gas: 'Butane (30%)', ...(link.s && link.m ? { [link.s]: link.m } : {}) })
  const [sel, setSel] = useState<Selection>(link.c ?? {})
  const [gravity, setGravity] = useState<Gravity>(link.g ?? '0g')
  const [lit, setLit] = useState(false)
  const [moonCheck, setMoonCheck] = useState(false)

  // ---- The pool of real tests for this fuel state ------------------------
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

  // Changing what burns starts the conditions (and the flame) afresh.
  // Reset only when what burns actually CHANGES (not on first load), so a
  // shared link's conditions survive loading, also under React StrictMode.
  const burnKey = useRef(`${state}|${inv}|${chosen}`)
  useEffect(() => {
    const k = `${state}|${inv}|${chosen}`
    if (k === burnKey.current) return
    burnKey.current = k
    setSel({}); setMoonCheck(false); setGravity('0g'); setLit(false)
  }, [state, inv, chosen])
  // Keep the address bar in step with the choices, so the link can be shared.
  // replaceState: no new history entry per click, and no page reload.
  useEffect(() => {
    const l: LabLink = { s: state, i: inv !== 'all' ? inv : undefined, m: chosen, c: Object.keys(sel).length ? sel : undefined, g: gravity !== '0g' ? gravity : undefined }
    window.history.replaceState(null, '', `#/lab/${encodeURIComponent(JSON.stringify(l))}`)
  }, [state, inv, chosen, sel, gravity])

  const dims = DIMENSIONS.filter((d) => d.states.includes(state))
  const result = useMemo(() => applySelection(rows, sel), [rows, sel])
  const has1g = result.some((t) => t.normalized.has_1g_reference)
  useEffect(() => { if (gravity === '1g' && !has1g) setGravity('0g') }, [has1g, gravity])

  const partialG = gravity === 'moon' || gravity === 'mars'
  // Rows with an implausible oxygen reading are left out only when you filter
  // BY oxygen: how a test ended does not depend on a faulty O2 sensor.
  const outcomes = useMemo(() => summariseOutcomes(result, gravity === '1g' ? '1g' : '0g', sel.o2 != null), [result, gravity, sel.o2])
  const card = chosen ? cardFor(data, chosen, state) : undefined

  // ---- What the figures show, all taken from the matching tests -----------
  const geometry = (sel.geometry ?? mostCommon(result.map((t) => t.normalized.geometry))) as string | null
  const shape: SampleShape = state === 'liquid' ? 'droplet' : state === 'gas' ? 'burner'
    : (SHAPES.includes(geometry as SampleShape) ? geometry as SampleShape : 'slab')
  const sameShape = result.filter((t) => t.normalized.geometry === geometry)
  // Sizes use the MOST COMMON recorded value, never a median: a median of
  // 40.6 and 94 cm would be 67.3 cm, a size no test ever used.
  const sampleDims = {
    diameter_mm: modeNum(sameShape.map((t) => t.normalized.diameter_mm)),
    thickness_mm: modeNum(sameShape.map((t) => t.normalized.thickness_mm)),
    width_mm: modeNum(sameShape.map((t) => t.normalized.width_mm)),
  }
  // Overall length x width only when every matching test agrees (SAFFIRE-I and
  // -III list the same sample as 40.6 x 94 and 94 x 40.6 cm).
  // Only from tests of the DRAWN shape: a fabric's 29 x 5 cm must never be
  // printed under a rod (the matching set can mix shapes).
  const lengthCm = onlyValue(sameShape.map((t) => t.normalized.sample_length_cm as number | null))
  const widthCm = onlyValue(sameShape.map((t) => t.normalized.sample_width_cm as number | null))
  const flowShown = round(sel.flow != null ? Number(sel.flow) : median(result.map((t) => t.normalized.flow_cm_s)), 2)
  const direction = (sel.direction ?? mostCommon(result.map((t) => t.normalized.flow_direction))) as
    'concurrent' | 'opposed' | 'stagnation' | null
  const o2Shown = round(sel.o2 != null ? Number(sel.o2) : median(result.map((t) => t.normalized.o2_percent)), 1)
  // What the caption states: the chosen value, or the recorded range.
  const o2Text = sel.o2 != null ? `${Number(sel.o2)}` : rangeText(result.map((t) => t.normalized.o2_percent), 1)
  const flowText = sel.flow != null ? `${Number(sel.flow)}` : rangeText(result.flatMap((t) =>
    t.normalized.flow_sequence_cm_s.length ? t.normalized.flow_sequence_cm_s : [t.normalized.flow_cm_s]), 2)
  const d0 = median(result.map((t) => t.normalized.droplet_d0_mm))
  const dExt = median(result.map((t) => t.normalized.extinction_d_mm))
  const burnT = median(result.filter((t) => t.normalized.hot_ignition !== false).map((t) => t.normalized.burn_time_s))
  const fiberAll = result.length > 0 && result.every((t) => t.normalized.fiber_supported === true)
  const nozzle = median(result.map((t) => t.normalized.nozzle_mm as number | null))
  const burnerMm = median(result.map((t) => t.normalized.burner_size_mm as number | null))
  const psiShown = [...new Set(result.map((t) => t.psi_id))]
  // What the drawing does NOT show: the other shapes and flow directions in
  // the matching set (the reviewer found the caption implied one shape only).
  const mix = (vals: (string | null | undefined)[], shown: string | null) => {
    const c = new Map<string, number>()
    vals.forEach((v) => v && c.set(v, (c.get(v) ?? 0) + 1))
    const total = [...c.values()].reduce((a, b) => a + b, 0)
    return {
      top: shown ? `${shown} (${c.get(shown) ?? 0} of ${total})` : '',
      others: [...c.entries()].filter(([k]) => k !== shown).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`),
    }
  }
  const shapeMix = state === 'solid' ? mix(result.map((t) => t.normalized.geometry), geometry) : { top: '', others: [] as string[] }
  const dirMix = state === 'solid' ? mix(result.map((t) => t.normalized.flow_direction), direction) : { top: '', others: [] as string[] }
  const burner: BurnerKind = BURNER[psiShown[0] ?? ''] ?? 'jet'

  // The ending the 3D view plays: the most common recorded outcome.
  const top = outcomes.outcomes[0]
  const ending: Ending = top ? (ENDING[top.cls] ?? 'full')
    : outcomes.ignition && outcomes.ignition.ignited === 0 ? 'none' : 'full'
  const endingNote = top
    ? `Ending shown: the most common recorded outcome, “${top.label}” (${top.count} of ${outcomes.withOutcome}).`
    : outcomes.ignition ? `${outcomes.ignition.ignited} of ${outcomes.ignition.ignited + outcomes.ignition.failed} ignited; no ending category is recorded.`
      : 'These tests record no ending, so the flame is drawn burning through. That part is illustration.'

  // ---- FLEX model, evaluated at the matched tests' recorded conditions ----
  const flex = useMemo(() => {
    if (state !== 'liquid' || !['Methanol', 'Heptane'].includes(chosen ?? '') || !result.length) return null
    const flexRows = result.filter((t) => t.psi_id === 'PSI-69')
    if (!flexRows.length) return null
    const m = (k: keyof TestRecord['normalized']) => median(flexRows.map((t) => t.normalized[k] as number | null))
    const inputs = { isHeptane: chosen === 'Heptane', o2: m('o2_mole_fraction') ?? 0, co2: m('co2_mole_fraction') ?? 0,
      he: m('he_mole_fraction') ?? 0, pressureMmHg: m('pressure_mmhg') ?? 0, d0: m('droplet_d0_mm') ?? 0 }
    return { ...evaluateFlexModel(data.flexModel, inputs), n: flexRows.length }
  }, [state, chosen, result, data.flexModel])

  // ---- Moon-base check: pick the recorded values nearest the habitat ------
  const runMoonCheck = () => {
    const next: Selection = {}
    const nearest = (opts: Option[], target: number) =>
      opts.reduce<Option | null>((b, o) => (!b || Math.abs(Number(o.key) - target) < Math.abs(Number(b.key) - target) ? o : b), null)
    const o2 = nearest(optionsFor(DIMENSIONS.find((d) => d.key === 'o2')!, rows, {}), 30)
    if (o2 && Math.abs(Number(o2.key) - 30) <= 2) next.o2 = o2.key
    if (state !== 'solid') {
      const p = nearest(optionsFor(DIMENSIONS.find((d) => d.key === 'pressure')!, rows, next), 0.69)
      if (p && Math.abs(Number(p.key) - 0.69) <= 0.06) next.pressure = p.key
    }
    setSel(next)
    setMoonCheck(true)
    setGravity('moon')
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
      { ok: false, text: 'Lunar gravity (0.16 g): no PSI data. Results from LUCI, outside PSI, are shown on the right.' },
    ]
  }, [moonCheck, card, state])

  const highlight = useMemo(() => new Set(result.map((t) => t.id)), [result])
  const mapTests = useMemo(() => rows.filter((t) => ['PSI-25', 'PSI-98', 'PSI-99'].includes(t.psi_id)), [rows])
  const neverLit = ending === 'none'

  // ---- How the 3D flame behaves, with the NASA evidence for it ------------
  const flameletTests = useMemo(() => data.findings.flamelets.map((f) => f.test)
    .filter((id) => result.some((t) => t.psi_id === 'PSI-25' && t.test_number === id)), [data.findings.flamelets, result])
  const regimeInput = {
    state, shape, flow: state === 'solid' ? flowShown : null, lowestFlow: null, direction, topClass: top?.cls ?? null,
    flameletTests, matchingCount: result.length, coolFlameRecorded: outcomes.coolFlamesRecorded,
    coolFlameTerritory: outcomes.coolFlameTerritory, burner,
  }
  const regime: Regime = decideRegime({ ...regimeInput, gravity: partialG ? 'none' : gravity === '1g' ? '1g' : '0g', ending })
  // The normal-gravity twin for the side-by-side view (SAFFIRE-II recorded both).
  const outcomes1g = useMemo(() => summariseOutcomes(result, '1g'), [result])
  const ending1g: Ending = outcomes1g.outcomes[0] ? (ENDING[outcomes1g.outcomes[0].cls] ?? 'full') : 'full'
  const regime1g: Regime = decideRegime({ ...regimeInput, gravity: '1g', ending: ending1g, topClass: outcomes1g.outcomes[0]?.cls ?? null })
  const [split, setSplit] = useState(false)
  const [photo, setPhoto] = useState(false)
  useEffect(() => { if (!has1g) setSplit(false) }, [has1g])
  const tl = useRef<Timeline>({ t: 0, playing: false, duration: 1, reignite: null, phase: 'Ready' })
  const tl1 = useRef<Timeline>({ t: 0, playing: false, duration: 1, reignite: null, phase: 'Ready' })
  const runKey = [shape, regime.behaviour, ending, gravity, flowShown, direction, chosen, split].join('|')
  // New conditions start a new run (instead of jumping mid-burn).
  useEffect(() => { for (const r of [tl, tl1]) { r.current.t = 0; r.current.reignite = null; r.current.playing = lit } }, [runKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const photoItem = mediaFor(psiShown, shape).find((m) => m.kind === 'image')

  // ------------------------------------------------------------------------
  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_360px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">

      {/* ============================ LEFT ============================ */}
      <aside className="order-2 lg:order-none lg:border-r border-rule bg-card xl:overflow-y-auto p-5 space-y-6 lg:row-span-2 xl:row-span-1">
        <div>
          <h1 className="font-serif font-semibold text-2xl">Experiment Lab</h1>
          <p className="caption mt-1">Every choice below is a value NASA recorded (airflow is converted from the fan reading with
            NASA's calibration). Each one narrows the others.</p>
        </div>

        <Group title="1 · What is burning">
          <div className="flex flex-wrap gap-1.5">
            {(['solid', 'liquid', 'gas'] as State[]).map((s) => (
              <button key={s} onClick={() => { setState(s); setInv('all') }} className={`chip ${state === s ? 'chip-on' : ''}`}>{STATE_LABEL[s]}</button>
            ))}
          </div>
        </Group>

        <Group title="2 · Investigation">
          <select value={inv} onChange={(e) => setInv(e.target.value)} className="field">
            <option value="all">All investigations with this fuel</option>
            {invOptions.map((i) => <option key={i.psi_id} value={i.psi_id}>{i.psi_id} · {i.acronym}</option>)}
          </select>
          {inv !== 'all' && <p className="caption mt-2">{data.investigations.find((i) => i.psi_id === inv)?.summary}</p>}
        </Group>

        <Group title={`3 · ${state === 'solid' ? 'Material' : 'Fuel'}`}>
          <div className="flex flex-wrap gap-1.5">
            {materialOptions.map(([m, c]) => (
              <button key={m} onClick={() => setMaterial((p) => ({ ...p, [state]: m }))} className={`chip ${chosen === m ? 'chip-on' : ''}`}
                      title={data.literature.glossary.find((g) => g.term === m)?.plain}>
                {m} <span className="num text-[12px] text-mute">{c}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group title="4 · Recorded conditions">
          <div className="space-y-4">
            {dims.map((d) => recorded(d, rows) ? (
              <StepControl key={d.key} label={d.label} options={optionsFor(d, rows, sel)} value={sel[d.key] ?? null}
                           onChange={(v) => { setSel((p) => ({ ...p, [d.key]: v })); setMoonCheck(false) }} />
            ) : (
              <div key={d.key}>
                <div className="small text-ink2">{d.label}</div>
                <div className="caption italic">{d.missingNote}</div>
              </div>
            ))}
            {state === 'solid' && (
              <div>
                <div className="small text-ink2">Pressure</div>
                <div className="caption italic">No solid-fuel table in this dataset records pressure.</div>
              </div>
            )}
          </div>
          {Object.values(sel).some((v) => v != null) && (
            <button onClick={() => { setSel({}); setMoonCheck(false) }} className="small text-accent hover:underline mt-3">Clear conditions</button>
          )}
        </Group>

        <Group title="5 · Gravity">
          <GravityTrack gravity={gravity} has1g={has1g}
                        setGravity={(g) => { setGravity(g); if (g !== 'moon') setMoonCheck(false) }} />
        </Group>

        <div>
          <button onClick={runMoonCheck} className="btn w-full justify-center">Check Moon-base conditions</button>
          <p className="caption mt-1.5">30% O₂ · 10.2 psi (70 kPa) · 0.16 g, the habitat atmosphere in the challenge brief.</p>
          {moonReport && (
            <ul className="mt-3 space-y-2 enter">
              {moonReport.map((r, i) => (
                <li key={i} className="flex gap-2 small">
                  <span className={r.ok ? 'text-[#1f7a4d]' : 'text-accent'} aria-hidden>{r.ok ? '✓' : '✕'}</span>
                  <span className="text-ink2">{r.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ============================ CENTRE ============================ */}
      <section className="order-1 lg:order-none xl:overflow-y-auto p-5 sm:p-6 space-y-6 min-w-0">
        <figure className="figure">
          <div className="viewport h-[380px] sm:h-[500px] rounded-none">
            {partialG ? (
              <PartialGravity gravity={gravity} />
            ) : (
              <Suspense fallback={<div className="h-full grid place-items-center text-slate-400 small">Loading 3D view…</div>}>
                <div className={`h-full ${split ? 'grid grid-cols-2 divide-x divide-white/10' : ''}`}>
                  {(split ? ['0g', '1g'] as const : [gravity === '1g' ? '1g' as const : '0g' as const]).map((g) => (
                    <div key={g} className="relative h-full">
                      <Specimen shape={shape} dims={sampleDims} lit={lit && !neverLit} gravity={g}
                                regime={g === '1g' && split ? regime1g : regime} timeline={g === '1g' && split ? tl1 : tl}
                                runKey={runKey} tag={split ? (g === '1g' ? '1 g' : '0 g') : undefined} o2={o2Shown}
                                flowCmS={state === 'solid' ? flowShown : null} direction={state === 'solid' ? direction : null}
                                fuel={chosen} droplet={state === 'liquid' ? { d0: d0 ?? 2.5, dExt, burnTime: burnT } : null}
                                fiber={fiberAll} burner={burner} burnerSizeMm={burnerMm} />
                    </div>
                  ))}
                </div>
              </Suspense>
            )}
            {!partialG && (
              <RunControls lit={lit} neverLit={neverLit} canStart={result.length > 0} state={state}
                           timelines={split ? [tl, tl1] : [tl]} regime={regime}
                           onIgnite={() => { setLit(true); for (const r of [tl, tl1]) { r.current.t = 0; r.current.reignite = null; r.current.playing = true } }}
                           onReset={() => setLit(false)}
                           has1g={has1g} split={split} setSplit={setSplit}
                           hasPhoto={!!photoItem} photo={photo} setPhoto={setPhoto} />
            )}
            {!partialG && lit && neverLit && (
              <div className="absolute top-3 left-3 max-w-xs rounded bg-black/60 px-3 py-2 small text-slate-100 enter">
                None of the matching tests established a flame, so none is drawn.
              </div>
            )}
            {photo && photoItem && !partialG && (
              <div className="absolute top-3 right-3 w-[46%] max-w-[340px] rounded-md overflow-hidden bg-black/80 border border-white/15 enter">
                <img src={`${import.meta.env.BASE_URL}media/${photoItem.file}`} alt={`${photoItem.title}: ${photoItem.caption}`} className="w-full aspect-[3/2] object-contain bg-black" />
                <p className="px-2.5 py-1.5 text-[12px] leading-snug text-slate-200">Real NASA photo · {photoItem.nasaId}{photoItem.related ? ' · related experiment' : ''}
                  {' '}· <a href={mediaUrl(photoItem)} target="_blank" rel="noreferrer" className="text-sky-300">source</a></p>
              </div>
            )}
          </div>
          <figcaption className="figcap">
            {partialG ? (
              <><b>Fig. 1.</b> No flame is drawn: none of the PSI tests ran at {gravity === 'moon' ? '0.16 g' : '0.38 g'}. Measured
                lunar-gravity results from NASA work outside PSI are listed on the right.{' '}</>
            ) : (
              <>
                <b>Fig. 1.</b> Drawn: {describeSample(shape, chosen, sampleDims, d0, state, lengthCm, widthCm)}
                {state === 'solid' && direction && <>, {direction} airflow</>}
                {shapeMix.others.length > 0 || dirMix.others.length > 0 ? (
                  <> (the most common {shapeMix.others.length > 0 ? `shape, ${shapeMix.top}` : ''}{shapeMix.others.length > 0 && dirMix.others.length > 0 ? ', and ' : ''}{dirMix.others.length > 0 ? `direction, ${dirMix.top}` : ''}
                    {' '}among the matching tests; they also include {[...shapeMix.others, ...dirMix.others].join(', ')})</>
                ) : null}.{' '}
                Recorded conditions: {state === 'solid' && flowText ? `${flowText} cm/s airflow, ` : ''}{o2Text ? `${o2Text}% O₂` : 'oxygen not recorded'}
                {(!sel.o2 && o2Text?.includes('–')) ? ' (range)' : ''}. {ENDING_WORDS[state][ending]}. {endingNote}{' '}
                {outcomes.spreadRate
                  ? <>Recorded spread rate {outcomes.spreadRate.median.toFixed(1)} mm/s; the animation is a time-lapse.</>
                  : <>Spread pace is compressed and illustrative.</>}{' '}
                Flame colour and size are illustration; shape, orientation and ending follow the data.{' '}
              </>
            )}
            <span className="text-mute">Source: {result.length} matching test{result.length === 1 ? '' : 's'}{psiShown.length ? `, ${psiShown.map((p) => invLabel(data, p)).join(', ')}` : ''}.</span>
          </figcaption>
        </figure>

        {!partialG && (
          <section className="card p-5">
            <h3 className="small font-semibold">Why this flame looks like this: {regime.label}</h3>
            <ul className="mt-2 space-y-2">
              {regime.evidence.map((e) => (
                <li key={e.text} className="small text-ink2 grid sm:grid-cols-[1fr_240px] gap-x-4">
                  <span>{e.text}</span><span className="caption sm:text-right">{e.cite}</span>
                </li>
              ))}
            </ul>
            {split && <p className="caption mt-3">Right panel (1 g): {regime1g.label.toLowerCase()}; ending from SAFFIRE-II's 1 g burn-length column.</p>}
          </section>
        )}

        <RealImagery psi={psiShown} shape={shape} />

        <figure className="figure">
          <div className="p-3 sm:p-4 overflow-x-auto">
            <Schematic shape={shape} material={chosen} psi={psiShown} dims={sampleDims} lengthCm={lengthCm} widthCm={widthCm}
                       flowCmS={state === 'solid' ? flowShown : null} direction={state === 'solid' ? direction : null}
                       gravity={partialG ? 'none' : gravity === '1g' ? '1g' : '0g'} d0={d0} nozzleMm={nozzle}
                       burnerMm={burnerMm} fiber={fiberAll} />
          </div>
          <figcaption className="figcap">
            <b>Fig. 3.</b> Side view of the set-up with the recorded dimensions (most common value among the matching tests). A dimension
            that is not recorded is labelled so, never drawn to a guessed size.
            <span className="text-mute"> Source: investigation hardware descriptions on NASA PSI; dimensions from the test tables.</span>
          </figcaption>
        </figure>

        {state === 'solid' && mapTests.length >= 3 && (
          <figure className="figure">
            <div className="p-3 sm:p-4">
              <FlammabilityMap tests={mapTests} highlight={highlight}
                               selectedO2={sel.o2 != null ? Number(sel.o2) : null}
                               selectedFlow={sel.flow != null ? Number(sel.flow) : null} />
            </div>
            <figcaption className="figcap">
              <b>Fig. 4.</b> Every recorded {chosen} test by oxygen and airflow, marked by how it ended. Tests matching your
              choices are drawn solid. No boundary is fitted: the points are the evidence.
              <span className="text-mute"> Source: PSI-25 BASS-II (NASA/TM-20210011385 App. A), PSI-98, PSI-99.</span>
            </figcaption>
          </figure>
        )}
      </section>

      {/* ============================ RIGHT ============================ */}
      <aside className="order-3 lg:order-none border-t xl:border-t-0 xl:border-l border-rule bg-card xl:overflow-y-auto p-5 space-y-6 lg:col-start-2 xl:col-start-3">
        <div>
          <p className="eyebrow">What happened in real tests</p>
          <h2 className="h3 mt-1">{chosen}{gravity === '1g' ? ' · 1 g reference' : ''}</h2>
          <p className="caption mt-1">
            {outcomes.sampled} matching test{outcomes.sampled === 1 ? '' : 's'}
            {result.length > outcomes.sampled && ` (${result.length - outcomes.sampled} with implausible O₂ readings left out)`}
          </p>
        </div>

        {partialG ? <PartialGravityResults data={data} material={chosen} /> : (
          <>
            {outcomes.ignition && (
              <Block title="Did it ignite?">
                <p><span className="num text-2xl">{outcomes.ignition.ignited}</span> <span className="text-ink2">of {outcomes.ignition.ignited + outcomes.ignition.failed} ignited</span></p>
                <Bar value={outcomes.ignition.ignited / Math.max(1, outcomes.ignition.ignited + outcomes.ignition.failed)} />
              </Block>
            )}

            {outcomes.outcomes.length > 0 && (
              <Block title="How it ended">
                <ul className="space-y-3">
                  {outcomes.outcomes.map((o) => (
                    <li key={o.cls}>
                      <div className="flex items-baseline justify-between gap-2 small">
                        <span>{o.label}</span><span className="num text-ink2">{o.count} · {(o.share * 100).toFixed(0)}%</span>
                      </div>
                      <Bar value={o.share} />
                      {OUTCOME_MEANINGS[o.cls] && <p className="caption mt-1">{OUTCOME_MEANINGS[o.cls]}</p>}
                    </li>
                  ))}
                </ul>
                {outcomes.sources.includes('PSI-25') && (
                  <p className="caption mt-3">Categories are this project's reading of NASA's test-matrix notes (BASS-II Summary
                    Report, Appendix A). NASA's own words are quoted below.</p>
                )}
              </Block>
            )}

            {outcomes.quotes.length > 0 && gravity === '0g' && (
              <Block title="In NASA's words">
                <p className="caption mb-2">“Pot” is the fan potentiometer setting; “HCl”, “HCN” and “CO” are gas-sensor readings. See the <a href="#/about">glossary</a>.</p>
                <div className="space-y-3">
                  {outcomes.quotes.map((q) => (
                    <blockquote key={q.test} className="border-l-2 border-rule pl-3 small text-ink2">
                      “{q.text}”
                      <div className="caption num mt-0.5">{q.psi} {q.test} · {q.source}</div>
                    </blockquote>
                  ))}
                </div>
              </Block>
            )}

            {outcomes.burnTime && <Measurement title="How long it burned" unit="s" s={outcomes.burnTime} />}
            {outcomes.extinctionDiameter && <Measurement title="Diameter at visible extinction" unit="mm" s={outcomes.extinctionDiameter} />}
            {outcomes.spreadRate && <Measurement title="Flame spread rate" unit="mm/s" s={outcomes.spreadRate} />}
            {outcomes.peakTemp && <Measurement title="Peak burner temperature" unit="°C" s={outcomes.peakTemp} />}

            {(outcomes.coolFlamesRecorded > 0 || outcomes.coolFlameTerritory > 0) && (
              <Block title="Cool flames">
                {outcomes.coolFlamesRecorded > 0 && <p className="small text-ink2"><b className="text-ink">{outcomes.coolFlamesRecorded} recorded.</b> CFI-G logged these as cool flames: low-temperature burning that gives off little light.</p>}
                {outcomes.coolFlameTerritory > 0 && <p className="small text-ink2 mt-2"><b className="text-ink">{outcomes.coolFlameTerritory} tests in cool-flame territory.</b> Heptane droplets above 2.4 mm, where FLEX researchers reported burning continuing invisibly after visible extinction. The table records visible extinction only, so these are not counted as observed cool flames.</p>}
              </Block>
            )}

            {outcomes.noOutcomeReason && (
              <Block title="No outcome recorded"><p className="small text-ink2">{outcomes.noOutcomeReason}</p></Block>
            )}
          </>
        )}

        {result.some((t) => t.normalized.has_1g_reference) && (
          <Block title="Same sample, both gravities">
            <table className="tbl !text-[13px]">
              <thead><tr><th>Sample</th><th>0 g burn</th><th>1 g burn</th></tr></thead>
              <tbody>
                {result.filter((t) => t.normalized.has_1g_reference).map((t) => (
                  <tr key={t.id}><td className="num">{t.test_number}</td>
                    <td>{t.normalized.burn_length_0g_raw as string}</td><td>{t.normalized.burn_length_1g_raw as string}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="caption mt-2">PSI-99 SAFFIRE-II burn-length columns · DOI 10.60555/2chp-m469</p>
          </Block>
        )}

        {flex && !partialG && (
          <Block title="Fitted FLEX model">
            {flex.shown ? (
              <p><span className="num text-2xl">{(flex.probability * 100).toFixed(0)}%</span> <span className="small text-ink2">fitted chance of extinction (vs. burning to completion) at these conditions</span></p>
            ) : (
              <p className="small text-ink2"><b className="text-ink">Not shown:</b> {flex.reasons.join('; ')}.</p>
            )}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 caption num">
              <dt>accuracy</dt><dd>{(data.flexModel.metrics.accuracy * 100).toFixed(0)}%</dd>
              <dt>always-“extinction” baseline</dt><dd>{(data.flexModel.metrics.baseline_accuracy * 100).toFixed(0)}%</dd>
              <dt>balanced accuracy</dt><dd>{(data.flexModel.metrics.balanced_accuracy * 100).toFixed(0)}%</dd>
              <dt>AUC</dt><dd>{data.flexModel.metrics.auc.toFixed(2)}</dd>
            </dl>
            <p className="caption mt-2">{flex.n} FLEX tests matched. {data.flexModel.metrics.validation}. {data.flexModel.disclaimer}</p>
          </Block>
        )}

        {psiShown.includes('PSI-25') && (
          <Block title="Measurement limits (BASS-II, as NASA states them)">
            <ul className="space-y-1.5">
              {data.literature.instruments_bass2.map((x) => (
                <li key={x.quantity} className="small text-ink2" title={`NASA: “${x.quote}”`}><b className="text-ink font-medium">{x.quantity}:</b> {x.limit}</li>
              ))}
            </ul>
            <p className="caption mt-1.5">BASS-II Summary Report, NASA/TM-20210011385, {data.literature.instruments_bass2.map((x) => x.where.split(';')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.</p>
          </Block>
        )}

        <Block title="Matching tests">
          <ul className="divide-y divide-rule border-y border-rule">
            {result.slice(0, 8).map((t) => <TestLine key={t.id} t={t} />)}
          </ul>
          {result.length > 8 && <p className="caption mt-2">and {result.length - 8} more</p>}
          {chosen && (
            <button onClick={() => go('data', chosen)} className="btn w-full justify-center mt-3">
              All {chosen} records in Data →
            </button>
          )}
        </Block>
      </aside>
    </div>
  )
}

// =============================================================================
//  Pieces
// =============================================================================

function describeSample(shape: SampleShape, name: string | undefined,
  d: { diameter_mm: number | null; thickness_mm: number | null; width_mm: number | null },
  d0: number | null, state: State, lengthCm: number | null, widthCm: number | null) {
  if (state === 'liquid') return `${name} droplet${d0 != null ? `, ${d0.toFixed(2)} mm initial diameter (median recorded)` : ', diameter not recorded in this table'}`
  if (state === 'gas') return `${name} burning on a burner`
  const parts = [`${name} ${shape}`]
  if (d.diameter_mm) parts.push(`${d.diameter_mm} mm diameter`)
  if (d.thickness_mm) parts.push(`${d.thickness_mm} mm thick`)
  if (d.width_mm && shape !== 'rod') parts.push(`${d.width_mm} mm wide`)
  if (lengthCm && widthCm) parts.push(`${widthCm} × ${lengthCm} cm`)
  if (parts.length === 1) parts.push('size not recorded')
  return parts.join(', ')
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="small font-semibold text-ink mb-2">{title}</h2>{children}</section>
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section className="enter"><h3 className="small font-semibold text-ink mb-2">{title}</h3>{children}</section>
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 rounded-full bg-wash overflow-hidden">
      <div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  )
}

function Measurement({ title, unit, s }: { title: string; unit: string; s: NumericSummary }) {
  const f = (v: number) => v.toFixed(v < 10 ? 1 : 0)
  return (
    <Block title={title}>
      <p><span className="num text-2xl">{f(s.median)}</span> <span className="small text-ink2">{unit} median</span></p>
      <p className="caption num">range {f(s.min)}–{f(s.max)} {unit} · {s.count} tests</p>
    </Block>
  )
}

function TestLine({ t }: { t: TestRecord }) {
  const n = t.normalized
  return (
    <li className="py-2">
      <div className="small num">{t.psi_id} {t.acronym} · {t.test_number ?? `row ${t.row_index}`}</div>
      <div className="caption num">
        {[(n.o2_display ?? (n.o2_percent != null ? `${n.o2_percent}% O₂` : null)),
          n.flow_sequence_cm_s.length > 1 ? `${n.flow_sequence_cm_s.join(' → ')} cm/s` : n.flow_cm_s != null ? `${n.flow_cm_s} cm/s` : null,
          n.pressure_atm != null ? `${n.pressure_atm} atm` : null,
          n.droplet_d0_mm != null ? `d₀ ${n.droplet_d0_mm} mm` : null,
          n.burn_time_s != null ? `${n.burn_time_s} s` : null].filter(Boolean).join(' · ')}
      </div>
      {n.outcome && <div className="caption text-ink2">{n.outcome}</div>}
    </li>
  )
}

/** A control that offers only recorded values: chips when there are a few,
 *  a drop-down when there are many. */
function StepControl({ label, options, value, onChange }: {
  label: string; options: Option[]; value: string | null; onChange: (v: string | null) => void
}) {
  const current = options.find((o) => o.key === value) ?? null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="small text-ink2">{label}</span>
        <span className="caption num">{current ? `${current.count} test${current.count === 1 ? '' : 's'}` : `any of ${options.length}`}</span>
      </div>
      {options.length <= 8 ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button key={o.key} onClick={() => onChange(value === o.key ? null : o.key)} title={o.detail}
                    className={`chip !px-2 !py-0.5 ${value === o.key ? 'chip-on' : ''}`}>{o.label}</button>
          ))}
        </div>
      ) : (
        <select className="field !py-1.5" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label={label}>
          <option value="">Any recorded value</option>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label} ({o.count})</option>)}
        </select>
      )}
      {current?.detail && <div className="caption mt-1">{current.detail}</div>}
    </div>
  )
}

/** Gravity: two measured ends (0 g, and 1 g where a reference exists) and a
 *  hatched band of no PSI data between them. Moon and Mars are selectable so
 *  you can SEE that PSI has nothing there, and what other sources say. */
function GravityTrack({ gravity, setGravity, has1g }: { gravity: Gravity; setGravity: (g: Gravity) => void; has1g: boolean }) {
  const stops: { g: Gravity; label: string; pos: number; disabled?: boolean }[] = [
    { g: '0g', label: '0 g', pos: 0 },
    { g: 'moon', label: 'Moon 0.16 g', pos: 16 },
    { g: 'mars', label: 'Mars 0.38 g', pos: 38 },
    { g: '1g', label: '1 g', pos: 100, disabled: !has1g },
  ]
  return (
    <div>
      <div className="relative h-3 rounded-full border border-rule overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[3%] bg-ink2/50" />
        <div className="absolute inset-y-0 left-[3%] right-[3%] hatched" />
        <div className="absolute inset-y-0 right-0 w-[3%] bg-ink2/50" />
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {stops.map((s) => (
          <button key={s.g} onClick={() => setGravity(s.g)} disabled={s.disabled}
                  title={s.disabled ? 'No normal-gravity result is recorded for these tests' : undefined}
                  className={`chip !px-1 justify-center text-center !text-[12.5px] leading-tight ${gravity === s.g ? 'chip-on' : ''}`}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="caption mt-2">
        Every PSI test is microgravity flight data. The hatched band has no PSI data; only SAFFIRE-II also records
        a 1 g result.
      </p>
    </div>
  )
}

/** The 3D window at Moon or Mars gravity: no flame is drawn. */
function PartialGravity({ gravity }: { gravity: Gravity }) {
  return (
    <div className="h-full grid place-items-center hatched-dark p-6">
      <div className="max-w-md text-center text-slate-200 enter">
        <p className="font-serif text-2xl text-white">No PSI data at {gravity === 'moon' ? '0.16 g (Moon)' : '0.38 g (Mars)'}</p>
        <p className="small mt-3 text-slate-300">
          No flame is drawn, because none of the 1,431 PSI tests ran at this gravity. Short partial-gravity experiments
          exist outside PSI; their measured results are listed on the right, with sources.
        </p>
      </div>
    </div>
  )
}

/** What is known at partial gravity, from cited literature (not PSI). */
function PartialGravityResults({ data, material }: { data: Dataset; material: string | undefined }) {
  const lit = data.literature
  const feier = lit.statements.find((s) => s.source === 'FEIER2001')
  const lpsc = lit.statements.filter((s) => s.source === 'LPSC2026')
  return (
    <>
      <Block title="Measured at lunar gravity, outside PSI">
        <table className="tbl !text-[13px]">
          <thead><tr><th>Material</th><th>Quantity</th><th>0.16 g</th><th>1 g</th></tr></thead>
          <tbody>
            {lit.points.map((p, i) => (
              <tr key={i} className={p.material === material ? 'bg-wash' : ''}>
                <td>{p.material}</td><td>{p.quantity}</td>
                <td className="num">{p.value} {p.unit}</td><td className="num">{p.compare_1g} {p.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-3 space-y-1.5 list-disc pl-4 small text-ink2">
          {lit.luci_notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <p className="mt-2"><LitCite data={data} keyName="LUCI" /></p>
      </Block>
      {feier && (
        <Block title="Aircraft tests at 0.10, 0.16 and 0.38 g">
          <p className="small text-ink2">{feier.text}</p>
          <p className="mt-1"><LitCite data={data} keyName="FEIER2001" /></p>
        </Block>
      )}
      <Block title="What is still open">
        {lpsc.map((s) => <p key={s.text} className="small text-ink2 mb-2">{s.text}</p>)}
        <p><LitCite data={data} keyName="LPSC2026" /></p>
        <a href="#/questions" className="small">Open research questions on partial gravity →</a>
      </Block>
    </>
  )
}

/** Real photographs and videos of these flames, beside the illustration. */
function RealImagery({ psi, shape }: { psi: string[]; shape: string }) {
  const items = mediaFor(psi, shape)
  const photos = items.filter((m) => m.kind === 'image')
  const videos = items.filter((m) => m.kind === 'video')
  return (
    <figure className="figure">
      {items.length ? (
        <div className="p-3 sm:p-4 space-y-3">
          {photos.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {photos.map((m) => (
                <a key={m.nasaId} href={mediaUrl(m)} target="_blank" rel="noreferrer" className="group block no-underline hover:no-underline">
                  <img src={`${import.meta.env.BASE_URL}media/${m.file}`} alt={`${m.title}: ${m.caption}`} title={m.caption} loading="lazy"
                       className="w-full aspect-[3/2] object-contain rounded bg-viewport" />
                  <span className="caption block mt-1 group-hover:text-ink">{m.nasaId} · {m.date}{m.related ? ' · related experiment, not PSI' : ''}</span>
                </a>
              ))}
            </div>
          )}
          {videos.map((m) => (
            <p key={m.nasaId} className="small">
              <a href={mediaUrl(m)} target="_blank" rel="noreferrer">▶ {m.title}</a>{' '}
              <span className="text-ink2">{m.caption}</span>
            </p>
          ))}
          {photos.length > 0 && (
            <details className="small">
              <summary className="cursor-pointer text-ink2">NASA's captions</summary>
              <ul className="mt-2 space-y-1.5">
                {photos.map((m) => <li key={m.nasaId} className="text-ink2"><span className="num caption">{m.nasaId}:</span> {m.caption}</li>)}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <p className="p-4 small text-ink2">No photograph or video naming this experiment was found in the NASA Image and Video Library, so none is shown.</p>
      )}
      <figcaption className="figcap">
        <b>Fig. 2.</b> The real flames, for comparison with the illustration above. Click any image for NASA's full description.
        <span className="text-mute"> Source: NASA Image and Video Library (images.nasa.gov) and NASA Scientific Visualization Studio (svs.gsfc.nasa.gov/31394); IDs as shown. Items marked “related experiment” are other NASA investigations (SoFIE, Candle Flames in Microgravity), not PSI tables.</span>
      </figcaption>
    </figure>
  )
}

/** Play / pause / scrub the run, plus the extra actions NASA's evidence allows. */
function RunControls({ lit, neverLit, canStart, state, timelines, regime, onIgnite, onReset, has1g, split, setSplit, hasPhoto, photo, setPhoto }: {
  lit: boolean; neverLit: boolean; canStart: boolean; state: State; timelines: React.MutableRefObject<Timeline>[]; regime: Regime
  onIgnite: () => void; onReset: () => void; has1g: boolean; split: boolean; setSplit: (v: boolean) => void
  hasPhoto: boolean; photo: boolean; setPhoto: (v: boolean) => void
}) {
  // The 3D scene owns the clock; poll it ten times a second for the UI.
  const [view, setView] = useState({ t: 0, d: 1, playing: false, phase: 'Ready', re: false })
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = timelines[0].current
      setView({ t: c.t, d: c.duration, playing: c.playing, phase: c.phase, re: c.reignite != null })
    }, 100)
    return () => window.clearInterval(id)
  }, [timelines])
  const set = (fn: (c: Timeline) => void) => timelines.forEach((r) => fn(r.current))
  const done = view.t >= view.d - 0.01
  const spreading = view.phase === 'Flamelets spreading'
  return (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
      {lit && !neverLit && (
        <div className="flex items-center gap-3 mb-2">
          <button className="text-white text-[13px] px-2 py-1 rounded border border-white/25 hover:bg-white/10 w-16"
                  onClick={() => set((c) => { if (done) { c.t = 0; c.reignite = null } c.playing = !c.playing || done })}>
            {done ? 'Replay' : view.playing ? 'Pause' : 'Play'}
          </button>
          <input type="range" min={0} max={1000} value={Math.round((view.t / view.d) * 1000)} aria-label="Scrub through the burn"
                 onChange={(e) => set((c) => { c.t = (Number(e.target.value) / 1000) * c.duration; c.playing = false })} className="flex-1" />
          <span className="text-slate-200 text-[12.5px] w-40 text-right truncate">{view.phase}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={lit ? onReset : onIgnite} disabled={!canStart}
                className="px-4 py-2 rounded-md small font-medium bg-white text-ink hover:bg-slate-100 disabled:opacity-40">
          {lit ? 'Reset' : neverLit ? 'Try to ignite' : state === 'solid' ? 'Ignite at the top' : 'Ignite'}
        </button>
        {lit && regime.canReignite && (
          <button disabled={!spreading || view.re} onClick={() => set((c) => { c.reignite = c.t })}
                  className="px-3 py-2 rounded-md text-[13px] text-white border border-white/30 hover:bg-white/10 disabled:opacity-40"
                  title="NASA Glenn: when the airflow is increased, flamelets flare up and re-form a full flame front">
            {view.re ? 'Airflow turned up' : 'Turn the airflow back up'}
          </button>
        )}
        {has1g && (
          <button onClick={() => setSplit(!split)} className={`px-3 py-2 rounded-md text-[13px] border ${split ? 'bg-white text-ink border-white' : 'text-white border-white/30 hover:bg-white/10'}`}>
            0 g | 1 g side by side
          </button>
        )}
        {hasPhoto && (
          <button onClick={() => setPhoto(!photo)} className={`px-3 py-2 rounded-md text-[13px] border ${photo ? 'bg-white text-ink border-white' : 'text-white border-white/30 hover:bg-white/10'}`}>
            Compare with a real NASA photo
          </button>
        )}
        <span className="hud text-slate-300 hidden md:inline ml-auto">drag to orbit · scroll to zoom</span>
      </div>
    </div>
  )
}
