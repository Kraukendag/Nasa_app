// =============================================================================
//  TAB 2 — EXPERIMENT LAB
// =============================================================================
//  Laid out like a CAD workspace: the model sits in the middle and you work on
//  it from the panels either side.
//
//      LEFT   what you are burning and the conditions you set
//      MIDDLE the 3D workspace — orbit around the sample and its flame
//      RIGHT  what actually happened when NASA ran tests like this
//
//  The right panel is the important one. It never predicts. It counts recorded
//  results: how many ignited, how long they burned, how they ended. Where a
//  table has no outcome column it says so rather than filling the space.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../data'
import { evaluateFlexModel, nearestTests } from '../data'
import { OUTCOME_MEANINGS, summariseOutcomes } from '../outcomes'
import type { NumericSummary } from '../outcomes'
import type { TestRecord } from '../types'
import Workspace from './Workspace'
import type { SampleShape } from './Workspace'

type Mode = 'solid' | 'droplet' | 'gas'

/** Only materials and fuels that genuinely appear in the PSI tables.
 *  The gas list is led by the CFI-G fuels because those are the ones whose
 *  tables record whether the flame actually caught. */
const CHOICES: Record<Mode, string[]> = {
  solid:   ['PMMA', 'SIBAL', 'Silicone', 'Nomex', 'Wax', 'Ultem'],
  droplet: ['Methanol', 'Heptane', 'C12H26'],
  gas:     ['30% butane', '50% butane', '30% propane', '30% ethane',
            'Propane', 'Ethane', 'Ethylene', 'Methane', 'Propylene'],
}

const SHAPES: { id: SampleShape; label: string }[] = [
  { id: 'rod', label: 'Rod' },
  { id: 'slab', label: 'Slab' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'fabric', label: 'Fabric' },
]

export default function TabLab({
  data, onInspect,
}: {
  data: Dataset
  onInspect: (material: string) => void
}) {
  const [mode, setMode] = useState<Mode>('solid')
  const [picked, setPicked] = useState<Record<Mode, string>>({
    solid: 'PMMA', droplet: 'Heptane', gas: '30% butane',
  })
  const [shape, setShape] = useState<SampleShape>('rod')
  const [lit, setLit] = useState(true)
  const [gravityOn, setGravityOn] = useState(false)
  const [o2, setO2] = useState(21)
  const [flow, setFlow] = useState(10)
  const [direction, setDirection] = useState<'concurrent' | 'opposed'>('concurrent')
  const [pressureAtm, setPressureAtm] = useState(1)
  const [co2, setCo2] = useState(0)
  const [helium, setHelium] = useState(0)
  const [dropletD0, setDropletD0] = useState(3)

  const material = picked[mode]
  const maxSolidO2 = data.findings.max_solid_o2_percent
  const card = data.materials.find((m) => m.name === material)

  // ---- The matching real tests -------------------------------------------
  const matches = useMemo(() => {
    const wantedState = mode === 'solid' ? 'solid' : mode === 'droplet' ? 'liquid' : 'gas'
    const pool = data.tests.filter((t) => t.normalized.fuel_state === wantedState)
    return nearestTests(
      pool,
      {
        material,
        o2,
        flow: mode === 'solid' ? flow : null,
        pressure: mode !== 'solid' ? pressureAtm : null,
      },
      12,
    )
  }, [data.tests, mode, material, o2, flow, pressureAtm])

  // Summarise outcomes over a slightly wider net than the five we list, so the
  // percentages mean something.
  const outcomes = useMemo(
    () => summariseOutcomes(matches.map((m) => m.test)),
    [matches],
  )

  // ---- Coverage -----------------------------------------------------------
  const coverage = useMemo(() => {
    if (mode === 'solid' && o2 > maxSolidO2) {
      return { level: 'outside' as const,
               text: `No solid fuel was ever flight-tested above ${maxSolidO2}% oxygen.` }
    }
    const range = card?.o2_range
    if (range && (o2 < range.min - 0.5 || o2 > range.max + 0.5)) {
      return { level: 'edge' as const,
               text: `${material} was tested between ${range.min}% and ${range.max}% oxygen.` }
    }
    return { level: 'inside' as const, text: 'Inside the range NASA tested.' }
  }, [mode, o2, maxSolidO2, card, material])

  const prediction = useMemo(() => {
    if (mode !== 'droplet' || !data.flexModel.available) return null
    if (!['Methanol', 'Heptane'].includes(material)) return null
    return evaluateFlexModel(data.flexModel, {
      isHeptane: material === 'Heptane',
      o2: o2 / 100, co2: co2 / 100, he: helium / 100,
      pressureMmHg: pressureAtm * 760, d0: dropletD0,
    })
  }, [mode, data.flexModel, material, o2, co2, helium, pressureAtm, dropletD0])

  const coolFlameRisk = mode === 'droplet' && material === 'Heptane' && dropletD0 > 2.4

  // The flame's look follows the conditions: more oxygen burns harder, and a
  // richer oxygen supply makes less soot, so the tip stays bluer.
  const intensity = Math.max(0.1, Math.min(1, (o2 - 11) / 25))
  const soot = Math.max(0, Math.min(1, 1 - (o2 - 18) / 22))
  const workspaceShape: SampleShape =
    mode === 'droplet' ? 'droplet' : mode === 'gas' ? 'burner' : shape
  const sizeMm = mode === 'droplet' ? dropletD0 * 4 : card?.o2_range ? 12 : 10

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[260px_1fr_320px] overflow-hidden">

      {/* ===================== LEFT — PARAMETERS ===================== */}
      <aside className="border-r border-edge overflow-y-auto p-3 space-y-4 text-[12px]">
        <Group title="What is burning">
          <div className="grid grid-cols-3 gap-1">
            {(['solid', 'droplet', 'gas'] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                      className={`btn !px-1 !py-1.5 text-[11px] capitalize ${mode === m ? 'btn-active' : ''}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {CHOICES[mode].map((name) => (
              <button key={name}
                      onClick={() => setPicked((p) => ({ ...p, [mode]: name }))}
                      className={`px-2 py-1 rounded text-[11px] border transition-all duration-200
                                  ${material === name
                                    ? 'border-cryo/70 bg-cryo/15 text-white'
                                    : 'border-edge text-mute hover:text-slate-200 hover:border-mute/50'}`}>
                {name}
              </button>
            ))}
          </div>
        </Group>

        {mode === 'solid' && (
          <Group title="Sample shape">
            <div className="grid grid-cols-4 gap-1">
              {SHAPES.map((s) => (
                <button key={s.id} onClick={() => setShape(s.id)}
                        className={`btn !px-1 !py-1.5 text-[10px] ${shape === s.id ? 'btn-active' : ''}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </Group>
        )}

        <Group title="Gravity">
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => setGravityOn(false)}
                    className={`btn !py-1.5 text-[11px] ${!gravityOn ? 'btn-active' : ''}`}>
              0 g
            </button>
            <button onClick={() => setGravityOn(true)}
                    disabled={!card?.has_1g_reference}
                    title={card?.has_1g_reference ? undefined : 'No normal-gravity reference exists for this material'}
                    className={`btn !py-1.5 text-[11px] ${gravityOn ? 'btn-active' : ''}`}>
              1 g
            </button>
          </div>

          {/* The locked band. Clicking it does nothing, on purpose. */}
          <div className="relative h-7 mt-2 rounded border border-edge overflow-hidden bg-navy/40">
            <div className="absolute inset-y-0 left-0 w-[14%] bg-cryo/20" />
            <div className="absolute inset-y-0 right-0 w-[14%] bg-ember/20" />
            <div className="absolute inset-y-0 left-[14%] right-[14%] hatched" />
            {[{ g: data.findings.gravity.moon_g, n: 'Moon' },
              { g: data.findings.gravity.mars_g, n: 'Mars' }].map((b) => (
              <div key={b.n} className="absolute inset-y-0 flex items-center"
                   style={{ left: `${14 + b.g * 72}%` }}>
                <div className="w-px h-full bg-star/50" />
                <span className="absolute text-[8px] text-star bg-deep/90 px-0.5 rounded -translate-x-1/2">
                  {b.n}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-mute leading-snug">
            The hatched band is unmeasured. Flame spread peaking near lunar gravity is a
            hypothesis — NASA's FM2 mission will test it.
          </p>
        </Group>

        <Group title="Atmosphere">
          <Slider label="Oxygen" value={o2} min={12} max={40} step={0.5} unit="%"
                  onChange={setO2}
                  marker={mode === 'solid' ? { at: maxSolidO2 } : undefined} />
          {mode === 'solid' ? (
            <>
              <Slider label="Air flow" value={flow} min={0} max={30} step={0.5} unit=" cm/s" onChange={setFlow} />
              <div className="grid grid-cols-2 gap-1 mt-2">
                {(['concurrent', 'opposed'] as const).map((d) => (
                  <button key={d} onClick={() => setDirection(d)}
                          className={`btn !py-1.5 text-[10px] capitalize ${direction === d ? 'btn-active' : ''}`}>
                    {d}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Slider label="Pressure" value={pressureAtm} min={0.4} max={5} step={0.05} unit=" atm" onChange={setPressureAtm} decimals={2} />
              {mode === 'droplet' && (
                <>
                  <Slider label="Droplet size" value={dropletD0} min={1} max={5} step={0.05} unit=" mm" onChange={setDropletD0} decimals={2} />
                  <Slider label="CO₂" value={co2} min={0} max={50} step={1} unit="%" onChange={setCo2} />
                  <Slider label="Helium" value={helium} min={0} max={50} step={1} unit="%" onChange={setHelium} />
                </>
              )}
            </>
          )}
        </Group>

        <button onClick={() => { setO2(30); setPressureAtm(0.69) }}
                className="btn w-full !py-1.5 text-[10px] border-star/40 text-star">
          Moon base · 30% O₂, 10.2 psi
        </button>
      </aside>

      {/* ===================== MIDDLE — 3D WORKSPACE ===================== */}
      <section className="relative min-h-[380px]">
        <Workspace
          shape={workspaceShape}
          lit={lit}
          gravityOn={gravityOn}
          intensity={intensity}
          flow={(direction === 'opposed' ? -1 : 1) * Math.min(1, flow / 30)}
          soot={soot}
          sizeMm={sizeMm}
        />

        {/* Floating overlays, kept out of the middle so the model stays clear */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2
                        pointer-events-none">
          <div className={`badge pointer-events-auto ${
            coverage.level === 'outside' ? 'badge-alert'
            : coverage.level === 'edge' ? 'badge-warn' : 'badge-ok'}`}>
            {coverage.level === 'outside' ? 'Extrapolated — outside tested range'
              : coverage.level === 'edge' ? 'Edge of tested range' : 'Inside tested range'}
          </div>
          <div className="badge badge-dead pointer-events-auto">Illustrative flame</div>
        </div>

        {coverage.level !== 'inside' && (
          <div className="absolute top-12 left-3 max-w-sm panel px-3 py-2 text-[11px] text-slate-300
                          anim-fade-in">
            {coverage.text}
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setLit((v) => !v)}
                  className={`btn-ignite !px-4 !py-2 !text-xs ${lit ? 'is-lit' : ''}`}>
            {lit ? 'Extinguish' : 'Ignite'}
          </button>
          <div className="panel px-2.5 py-1.5 text-[10px] text-mute">
            {gravityOn ? '1 g · buoyant plume' : '0 g · spherical diffusion flame'}
          </div>
          <div className="ml-auto panel px-2.5 py-1.5 text-[10px] text-mute">
            drag to orbit · scroll to zoom
          </div>
        </div>
      </section>

      {/* ===================== RIGHT — OUTCOMES ===================== */}
      <aside className="border-l border-edge overflow-y-auto p-3 space-y-3 text-[12px]">
        <div>
          <div className="label">What happened in real tests</div>
          <h3 className="text-base font-semibold mt-0.5">{material}</h3>
          <p className="text-[10px] text-mute mt-0.5">
            From the {outcomes.sampled} nearest recorded test{outcomes.sampled === 1 ? '' : 's'}
            {outcomes.sources.length > 0 && ` · ${outcomes.sources.join(', ')}`}
          </p>
        </div>

        {/* The headline answer: did it catch? */}
        {outcomes.ignition && (
          <div className="panel p-3 anim-slide-in">
            <div className="label mb-2">Did it ignite?</div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold tabular text-cryo">
                {outcomes.ignition.ignited}
              </span>
              <span className="text-mute mb-1 text-[11px]">
                of {outcomes.ignition.ignited + outcomes.ignition.failed} ignited
              </span>
            </div>
            <Bar value={outcomes.ignition.ignited /
                        Math.max(1, outcomes.ignition.ignited + outcomes.ignition.failed)} />
            {outcomes.ignition.failed > 0 && (
              <p className="mt-1.5 text-[10px] text-star">
                {outcomes.ignition.failed} attempt{outcomes.ignition.failed === 1 ? '' : 's'} never caught.
              </p>
            )}
          </div>
        )}

        {/* How it ended */}
        {outcomes.outcomes.length > 0 && (
          <div className="panel p-3 anim-slide-in">
            <div className="label mb-2">How it ended</div>
            <div className="space-y-2">
              {outcomes.outcomes.map((o) => (
                <div key={o.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-200 text-[11px]">{o.label}</span>
                    <span className="tabular text-[11px] text-mute">
                      {o.count} · {(o.share * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Bar value={o.share} />
                  {OUTCOME_MEANINGS[o.label] && (
                    <p className="text-[10px] text-mute mt-0.5">{OUTCOME_MEANINGS[o.label]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How long it lasted */}
        {outcomes.burnTime && (
          <Measurement title="How long it burned" unit="s" summary={outcomes.burnTime} />
        )}
        {outcomes.extinctionDiameter && (
          <Measurement title="Diameter at extinction" unit="mm" summary={outcomes.extinctionDiameter} />
        )}
        {outcomes.peakTemp && (
          <Measurement title="Peak burner temperature" unit="°C" summary={outcomes.peakTemp} />
        )}

        {outcomes.coolFlames > 0 && (
          <div className="panel p-3 border-star/45 anim-slide-in">
            <span className="badge badge-warn">Cool flames recorded</span>
            <p className="mt-1.5 text-[11px] text-slate-300">
              {outcomes.coolFlames} of these tests showed burning that continues after the
              visible flame disappears — producing carbon monoxide with no light for a
              detector to see.
            </p>
          </div>
        )}

        {/* When the tables simply do not say */}
        {outcomes.noOutcomeReason && (
          <div className="panel p-3 border-edge anim-slide-in">
            <span className="badge badge-dead">No outcome recorded</span>
            <p className="mt-1.5 text-[11px] text-slate-300">{outcomes.noOutcomeReason}</p>
          </div>
        )}

        {/* Droplet model */}
        {prediction && (
          <div className="panel p-3 anim-slide-in">
            <div className="flex items-center justify-between mb-1.5">
              <div className="label">Fitted model</div>
              <span className="badge badge-dead">
                {(data.flexModel.cv_accuracy * 100).toFixed(0)}%
              </span>
            </div>
            {prediction.inRange ? (
              <>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold tabular text-cryo">
                    {(prediction.probability * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-mute mb-1">chance of extinction</span>
                </div>
                <Bar value={prediction.probability} />
              </>
            ) : (
              <>
                <span className="badge badge-alert">No prediction</span>
                <p className="mt-1.5 text-[10px] text-slate-300">
                  Outside the conditions FLEX tested
                  ({prediction.outOfRange.join(', ').replace(/_/g, ' ')}).
                </p>
              </>
            )}
            <p className="mt-1.5 text-[9px] text-mute leading-snug">
              Statistical fit to {data.flexModel.n_training_rows} recorded FLEX outcomes.
              Not a physical model.
            </p>
          </div>
        )}

        {coolFlameRisk && (
          <div className="panel p-3 border-star/45">
            <span className="badge badge-warn">Invisible cool flame possible</span>
            <p className="mt-1.5 text-[11px] text-slate-300">
              Heptane droplets above 2.4 mm keep burning after the visible flame goes out.
            </p>
          </div>
        )}

        {mode === 'solid' && material === 'Silicone' && (
          <div className="panel p-3 border-cryo/40">
            <span className="badge badge-ok">Reverses in space</span>
            <p className="mt-1.5 text-[11px] text-slate-300">
              SAFFIRE-II: silicone burned completely at 1 g but barely ignited in microgravity.
            </p>
          </div>
        )}

        {/* The individual tests behind the numbers */}
        <div>
          <div className="label mb-1.5">Closest tests</div>
          <div className="space-y-1.5">
            {matches.slice(0, 5).map(({ test }) => (
              <TestChip key={test.id} test={test} investigations={data.investigations} />
            ))}
          </div>
        </div>

        <button onClick={() => onInspect(material)} className="btn w-full !py-1.5 text-[10px]">
          Inspect {material} rows →
        </button>
      </aside>
    </div>
  )
}

// =============================================================================
//  SMALL PIECES
// =============================================================================

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="label mb-1.5">{title}</div>
      {children}
    </section>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 rounded-full bg-navy overflow-hidden">
      <div className="h-full bg-gradient-to-r from-cryo to-star transition-all duration-500"
           style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  )
}

/** Min / median / max for one measured quantity. */
function Measurement({ title, unit, summary }: {
  title: string; unit: string; summary: NumericSummary
}) {
  return (
    <div className="panel p-3 anim-slide-in">
      <div className="flex items-baseline justify-between">
        <div className="label">{title}</div>
        <span className="text-[9px] text-mute tabular">{summary.count} tests</span>
      </div>
      <div className="flex items-end gap-1.5 mt-1">
        <span className="text-2xl font-bold tabular text-slate-100">
          {summary.median.toFixed(summary.median < 10 ? 1 : 0)}
        </span>
        <span className="text-[11px] text-mute mb-1">{unit} typical</span>
      </div>
      <div className="mt-1 text-[10px] tabular text-mute">
        range {summary.min.toFixed(summary.min < 10 ? 1 : 0)} – {summary.max.toFixed(summary.max < 10 ? 1 : 0)} {unit}
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, onChange, decimals = 1, marker }: {
  label: string; value: number; min: number; max: number; step: number
  unit: string; onChange: (v: number) => void; decimals?: number
  marker?: { at: number }
}) {
  const beyond = marker ? value > marker.at : false
  const markerPercent = marker ? ((marker.at - min) / (max - min)) * 100 : null
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-mute">{label}</span>
        <span className={`tabular text-[11px] ${beyond ? 'text-flame' : 'text-slate-200'}`}>
          {value.toFixed(decimals)}{unit}
        </span>
      </div>
      <div className="relative">
        <input type="range" min={min} max={max} step={step} value={value}
               onChange={(e) => onChange(parseFloat(e.target.value))} />
        {markerPercent !== null && (
          <div className="absolute -top-0.5 w-px h-3 bg-flame pointer-events-none"
               style={{ left: `${markerPercent}%` }} />
        )}
      </div>
    </div>
  )
}

function TestChip({ test, investigations }: {
  test: TestRecord; investigations: Dataset['investigations']
}) {
  const n = test.normalized
  const investigation = investigations.find((i) => i.psi_id === test.psi_id)
  return (
    <div className="panel-flat p-2 hover:border-cryo/40 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-cryo">
          {test.psi_id} · {test.test_number ?? `row ${test.row_index}`}
        </span>
        {investigation?.doi && (
          <a href={investigation.doi_url!} target="_blank" rel="noreferrer"
             className="text-[9px] text-mute hover:text-cryo transition-colors">DOI ↗</a>
        )}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] tabular text-mute">
        {n.o2_percent != null && <span>O₂ {n.o2_percent}%</span>}
        {n.flow_cm_s != null && <span>{n.flow_cm_s} cm/s</span>}
        {n.pressure_atm != null && <span>{n.pressure_atm} atm</span>}
        {n.burn_time_s != null && <span className="text-slate-300">{n.burn_time_s}s</span>}
      </div>
      {n.outcome && <div className="mt-1 text-[10px] text-star">{n.outcome}</div>}
    </div>
  )
}
