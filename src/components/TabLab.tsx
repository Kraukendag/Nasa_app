// =============================================================================
//  TAB 2 — EXPERIMENT LAB
// =============================================================================
//  Three columns: the controls you set, a picture of what you set, and a
//  sidebar of the real NASA tests that come closest to it.
//
//  THE RULE THIS WHOLE SCREEN IS BUILT AROUND
//  ------------------------------------------
//  This is not a physics engine. It does not calculate what a flame would do.
//  It finds the tests NASA actually ran nearest to your settings and shows you
//  those. When you move outside the conditions anyone has tested, it says so
//  in a badge rather than drawing a confident-looking answer.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../data'
import { evaluateFlexModel, nearestTests } from '../data'
import type { TestRecord } from '../types'

type Mode = 'solids' | 'droplets'

/** Materials the user can pick, split by how they burn. Only materials that
 *  genuinely appear in the PSI tables are listed. */
const SOLID_CHOICES = ['PMMA', 'SIBAL', 'Silicone', 'Nomex', 'Wax', 'Ultem']
const DROPLET_CHOICES = ['Methanol', 'Heptane']

export default function TabLab({
  data,
  onInspect,
}: {
  data: Dataset
  onInspect: (material: string) => void
}) {
  const [mode, setMode] = useState<Mode>('solids')
  const [material, setMaterial] = useState('PMMA')
  const [fuel, setFuel] = useState('Methanol')
  const [gravityOn, setGravityOn] = useState(false)   // 0 g is the default: it is what PSI measured
  const [o2, setO2] = useState(21)
  const [flow, setFlow] = useState(10)
  const [direction, setDirection] = useState<'concurrent' | 'opposed'>('concurrent')
  const [pressureAtm, setPressureAtm] = useState(1)
  const [co2, setCo2] = useState(0)
  const [helium, setHelium] = useState(0)
  const [dropletD0, setDropletD0] = useState(3)

  const maxSolidO2 = data.findings.max_solid_o2_percent

  // ---- Which real tests sit closest to the current settings? --------------
  const matches = useMemo(() => {
    const pool = data.tests.filter((t) =>
      mode === 'solids'
        ? t.normalized.fuel_state === 'solid'
        : t.normalized.fuel_state === 'liquid',
    )
    return nearestTests(
      pool,
      {
        material: mode === 'solids' ? material : fuel,
        o2,
        flow: mode === 'solids' ? flow : null,
        pressure: mode === 'droplets' ? pressureAtm : null,
      },
      5,
    )
  }, [data.tests, mode, material, fuel, o2, flow, pressureAtm])

  const activeName = mode === 'solids' ? material : fuel
  const card = data.materials.find((m) => m.name === activeName)

  // ---- Coverage: is this inside what NASA tested? -------------------------
  const coverage = useMemo(() => {
    if (mode === 'solids' && o2 > maxSolidO2) {
      return {
        level: 'outside' as const,
        text: `No solid fuel was ever flight-tested above ${maxSolidO2}% oxygen.`,
      }
    }
    const range = card?.o2_range
    if (range && (o2 < range.min - 0.5 || o2 > range.max + 0.5)) {
      return {
        level: 'edge' as const,
        text: `${activeName} was tested between ${range.min}% and ${range.max}% oxygen.`,
      }
    }
    return { level: 'inside' as const, text: 'Inside the range NASA tested.' }
  }, [mode, o2, maxSolidO2, card, activeName])

  // ---- Droplet outcome model ----------------------------------------------
  const prediction = useMemo(() => {
    if (mode !== 'droplets' || !data.flexModel.available) return null
    return evaluateFlexModel(data.flexModel, {
      isHeptane: fuel === 'Heptane',
      o2: o2 / 100,
      co2: co2 / 100,
      he: helium / 100,
      pressureMmHg: pressureAtm * 760,
      d0: dropletD0,
    })
  }, [mode, data.flexModel, fuel, o2, co2, helium, pressureAtm, dropletD0])

  // FLEX found that big heptane droplets keep burning invisibly after the
  // visible flame goes out. Warn whenever the user is in that territory.
  const coolFlameRisk = mode === 'droplets' && fuel === 'Heptane' && dropletD0 > 2.4

  const applyMoonBase = () => {
    setO2(30)
    setPressureAtm(0.69)   // 10.2 psi expressed in atmospheres
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[320px_1fr_380px] overflow-hidden">
      {/* ===================== COLUMN 1 — CONTROLS ===================== */}
      <aside className="border-r border-edge overflow-y-auto p-4 space-y-5 stagger">
        {/* Mode */}
        <section>
          <div className="label mb-2">What is burning</div>
          <div className="grid grid-cols-2 gap-2">
            {(['solids', 'droplets'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`btn text-xs ${mode === m ? 'btn-active' : ''}`}
              >
                {m === 'solids' ? 'Solid material' : 'Fuel droplet'}
              </button>
            ))}
          </div>
        </section>

        {/* Material */}
        <section>
          <div className="label mb-2">{mode === 'solids' ? 'Material' : 'Fuel'}</div>
          <div className="flex flex-wrap gap-1.5">
            {(mode === 'solids' ? SOLID_CHOICES : DROPLET_CHOICES).map((name) => {
              const active = activeName === name
              const setter = mode === 'solids' ? setMaterial : setFuel
              return (
                <button
                  key={name}
                  onClick={() => setter(name)}
                  className={`px-2.5 py-1.5 rounded text-xs border transition-all duration-200
                              ${active
                                ? 'border-cryo/70 bg-cryo/15 text-white'
                                : 'border-edge text-mute hover:text-slate-200 hover:border-mute/50'}`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </section>

        {/* Gravity — the honesty centrepiece */}
        <GravityControl
          gravityOn={gravityOn}
          setGravityOn={setGravityOn}
          has1g={card?.has_1g_reference ?? false}
          moonG={data.findings.gravity.moon_g}
          marsG={data.findings.gravity.mars_g}
        />

        {/* Atmosphere */}
        <section className="space-y-3">
          <Slider
            label="Oxygen"
            value={o2}
            min={12}
            max={40}
            step={0.5}
            unit="%"
            onChange={setO2}
            marker={mode === 'solids' ? { at: maxSolidO2, label: `tested to ${maxSolidO2}%` } : undefined}
          />
          {mode === 'solids' ? (
            <>
              <Slider label="Air flow" value={flow} min={0} max={30} step={0.5} unit=" cm/s" onChange={setFlow} />
              <div>
                <div className="label mb-2">Flow direction</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['concurrent', 'opposed'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={`btn text-xs capitalize ${direction === d ? 'btn-active' : ''}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <Slider label="Pressure" value={pressureAtm} min={0.5} max={5} step={0.05} unit=" atm" onChange={setPressureAtm} decimals={2} />
              <Slider label="Droplet diameter" value={dropletD0} min={1} max={5} step={0.05} unit=" mm" onChange={setDropletD0} decimals={2} />
              <Slider label="Carbon dioxide" value={co2} min={0} max={50} step={1} unit="%" onChange={setCo2} />
              <Slider label="Helium" value={helium} min={0} max={50} step={1} unit="%" onChange={setHelium} />
            </>
          )}
        </section>

        <button onClick={applyMoonBase} className="btn w-full text-xs border-star/40 text-star">
          Apply Moon base atmosphere · 30% O₂, 10.2 psi
        </button>
      </aside>

      {/* ===================== COLUMN 2 — THE PICTURE ===================== */}
      <section className="overflow-y-auto p-5 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Coverage verdict */}
          <div
            className={`panel p-4 anim-fade-up ${
              coverage.level === 'outside' ? 'border-flame/40' :
              coverage.level === 'edge' ? 'border-star/40' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`badge ${
                coverage.level === 'outside' ? 'badge-alert' :
                coverage.level === 'edge' ? 'badge-warn' : 'badge-ok'
              }`}>
                {coverage.level === 'outside' ? 'Extrapolated — outside tested range'
                  : coverage.level === 'edge' ? 'Edge of tested range'
                  : 'Inside tested range'}
              </span>
            </div>
            <p className="mt-2.5 text-sm text-slate-300">{coverage.text}</p>
            {coverage.level === 'outside' && (
              <p className="mt-2 text-xs text-mute">
                A lunar habitat is planned at 30% oxygen. Everything shown below this line
                is a reading of nearby tests, not a prediction of what would happen there.
              </p>
            )}
          </div>

          {/* The flame picture */}
          <FlameFigure mode={mode} gravityOn={gravityOn} o2={o2} flow={flow} direction={direction} />

          {/* Droplet outcome model */}
          {mode === 'droplets' && prediction && (
            <div className="panel p-4 anim-fade-up">
              <div className="flex items-center justify-between mb-3">
                <div className="label">Likely outcome</div>
                <span className="badge badge-dead">
                  {(data.flexModel.cv_accuracy * 100).toFixed(0)}% accurate · {data.flexModel.n_training_rows} tests
                </span>
              </div>

              {prediction.inRange ? (
                <>
                  <div className="flex items-end gap-2">
                    <div className="text-4xl font-bold tabular text-cryo">
                      {(prediction.probability * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-mute mb-1.5">chance of extinction</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-navy overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cryo to-star transition-all duration-500"
                      style={{ width: `${prediction.probability * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <span className="badge badge-alert">No prediction</span>
                  <p className="mt-2 text-sm text-slate-300">
                    These settings fall outside the conditions FLEX tested
                    ({prediction.outOfRange.join(', ').replace(/_/g, ' ')}), so the model is
                    not shown. Guessing past the data would be inventing a result.
                  </p>
                </div>
              )}

              <p className="mt-3 text-[11px] text-mute leading-relaxed">
                {data.flexModel.disclaimer}
              </p>
            </div>
          )}

          {/* Cool flame alert */}
          {coolFlameRisk && (
            <div className="panel p-4 border-star/45 anim-fade-up">
              <span className="badge badge-warn">Invisible cool flame possible</span>
              <p className="mt-2.5 text-sm text-slate-300">
                FLEX found that heptane droplets larger than about 2.4 mm keep burning after the
                visible flame disappears. The fire looks out, but it is still consuming fuel and
                producing carbon monoxide and formaldehyde — with no light for a detector to see.
              </p>
              <p className="mt-2 text-xs text-mute">
                Source: PSI-69 FLEX · DOI 10.60555/mbq8-0451
              </p>
            </div>
          )}

          {/* The silicone reversal, surfaced when relevant */}
          {mode === 'solids' && material === 'Silicone' && (
            <div className="panel p-4 border-cryo/40 anim-fade-up">
              <span className="badge badge-ok">Behaviour reverses in space</span>
              <p className="mt-2.5 text-sm text-slate-300">
                In SAFFIRE-II, silicone burned completely in normal gravity but produced
                essentially zero burn length in microgravity. Earth testing would have called
                this material dangerous; in orbit it barely lit.
              </p>
              <p className="mt-2 text-xs text-mute">
                Source: PSI-99 SAFFIRE-II, samples 2-1 to 2-4 · DOI 10.60555/2chp-m469
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ===================== COLUMN 3 — EVIDENCE ===================== */}
      <aside className="border-l border-edge overflow-y-auto p-4 space-y-4">
        <div>
          <div className="label mb-2">Evidence</div>
          <h3 className="text-lg font-semibold">{activeName}</h3>
          {card && (
            <p className="text-xs text-mute mt-1">
              {card.test_count} recorded tests across {card.investigations.length} investigation
              {card.investigations.length === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {card && (
          <div className="panel-flat p-3 grid grid-cols-2 gap-x-3 gap-y-2.5 anim-slide-in">
            <Stat label="Oxygen tested" value={card.o2_range ? `${card.o2_range.min}–${card.o2_range.max}%` : null} />
            <Stat label="Flow tested" value={card.flow_range ? `${card.flow_range.min}–${card.flow_range.max} cm/s` : null} />
            <Stat label="Pressure tested" value={card.pressure_range ? `${card.pressure_range.min}–${card.pressure_range.max} atm` : null} />
            <Stat label="Smoke growth Rt/R₀" value={card.rt_r0_range ? `${card.rt_r0_range.min}–${card.rt_r0_range.max}` : null} />
            <div className="col-span-2 flex flex-wrap gap-1.5 pt-1">
              <span className={`badge ${card.has_1g_reference ? 'badge-ok' : 'badge-dead'}`}>
                {card.has_1g_reference ? '1 g reference exists' : 'No 1 g reference in PSI'}
              </span>
              <span className={`badge ${card.tested_at_moonbase_o2 ? 'badge-ok' : 'badge-warn'}`}>
                {card.tested_at_moonbase_o2 ? 'Covers Moon base O₂' : 'Untested at Moon base O₂'}
              </span>
            </div>
          </div>
        )}

        <div>
          <div className="label mb-2">Closest real tests</div>
          <div className="space-y-2 stagger">
            {matches.map(({ test, distance }) => (
              <TestChip key={test.id} test={test} distance={distance} investigations={data.investigations} />
            ))}
            {matches.length === 0 && (
              <p className="text-xs text-mute">No tests match these conditions.</p>
            )}
          </div>
        </div>

        <button onClick={() => onInspect(activeName)} className="btn w-full text-xs">
          Inspect {activeName} rows in Data Library →
        </button>
      </aside>
    </div>
  )
}

// =============================================================================
//  SMALL PIECES
// =============================================================================

/** The gravity control. Two real settings and a locked band between them.
 *  Clicking inside the band does nothing on purpose — there is no data there,
 *  so there is nothing to select. */
function GravityControl({
  gravityOn, setGravityOn, has1g, moonG, marsG,
}: {
  gravityOn: boolean
  setGravityOn: (v: boolean) => void
  has1g: boolean
  moonG: number
  marsG: number
}) {
  return (
    <section>
      <div className="label mb-2">Gravity</div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <button
          onClick={() => setGravityOn(false)}
          className={`btn text-xs ${!gravityOn ? 'btn-active' : ''}`}
        >
          0 g · flight data
        </button>
        <button
          onClick={() => setGravityOn(true)}
          disabled={!has1g}
          title={has1g ? undefined : 'No normal-gravity reference exists for this material'}
          className={`btn text-xs ${gravityOn ? 'btn-active' : ''}`}
        >
          1 g · Earth
        </button>
      </div>

      {/* The track: two solid ends, a hatched unknown zone in the middle. */}
      <div className="relative h-9 rounded-md border border-edge overflow-hidden bg-navy/40">
        <div className="absolute inset-y-0 left-0 w-[14%] bg-cryo/20 border-r border-edge" />
        <div className="absolute inset-y-0 right-0 w-[14%] bg-ember/20 border-l border-edge" />
        <div className="absolute inset-y-0 left-[14%] right-[14%] hatched" />

        {/* Moon and Mars markers, positioned by their real gravity values. */}
        {[{ g: moonG, name: 'Moon' }, { g: marsG, name: 'Mars' }].map((body) => (
          <div
            key={body.name}
            className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
            style={{ left: `${14 + body.g * 72}%` }}
          >
            <div className="w-px h-full bg-star/50" />
            <span className="absolute text-[9px] text-star whitespace-nowrap bg-deep/80 px-1 rounded">
              {body.name}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-1 text-[9px] text-mute">
        <span>0 g</span>
        <span className="text-star">no data exists here</span>
        <span>1 g</span>
      </div>

      <p className="mt-2 text-[10px] text-mute leading-relaxed">
        The hatched band is unmeasured. The idea that flame spread peaks near lunar gravity
        is a hypothesis, not a result — NASA's FM2 mission is built to test it.
      </p>
      {!has1g && (
        <p className="mt-1.5 text-[10px] text-star/80">
          This material has no normal-gravity run in PSI, so the 1 g setting is unavailable.
        </p>
      )}
    </section>
  )
}

/** A labelled slider with an optional marker showing where the tested data ends. */
function Slider({
  label, value, min, max, step, unit, onChange, decimals = 1, marker,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  decimals?: number
  marker?: { at: number; label: string }
}) {
  const markerPercent = marker ? ((marker.at - min) / (max - min)) * 100 : null
  const beyond = marker ? value > marker.at : false

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="label">{label}</span>
        <span className={`tabular text-sm ${beyond ? 'text-flame' : 'text-slate-200'}`}>
          {value.toFixed(decimals)}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {markerPercent !== null && (
          <div
            className="absolute -top-0.5 w-px h-3 bg-flame pointer-events-none"
            style={{ left: `${markerPercent}%` }}
            title={marker!.label}
          />
        )}
      </div>
      {marker && beyond && (
        <p className="mt-1 text-[10px] text-flame">{marker.label} — beyond this is extrapolation</p>
      )}
    </div>
  )
}

/** A simple drawn figure of the flame under the chosen conditions.
 *  Labelled as illustrative: its shape follows the published description of
 *  these flames, not a calculation. */
function FlameFigure({
  mode, gravityOn, o2, flow, direction,
}: {
  mode: Mode
  gravityOn: boolean
  o2: number
  flow: number
  direction: 'concurrent' | 'opposed'
}) {
  // More oxygen and more flow mean a bigger, brighter flame. This drives the
  // drawing only — no number here is presented as a measurement.
  const intensity = Math.min(1, (o2 - 12) / 28)
  const height = gravityOn ? 120 : 62 + intensity * 16
  const width = gravityOn ? 46 : 60 + intensity * 12
  const colour = gravityOn ? '#FFB23D' : '#3C96E8'

  return (
    <div className="panel p-5 anim-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Flame shape</div>
        <span className="badge badge-dead">Illustrative</span>
      </div>

      <div className="relative h-56 grid place-items-center overflow-hidden rounded bg-void/60">
        {/* Airflow arrows for solids */}
        {mode === 'solids' && flow > 0 && (
          <div className="absolute inset-x-0 top-1/2 flex justify-between px-6 text-cryo/40 text-xs">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i}>{direction === 'concurrent' ? '→' : '←'}</span>
            ))}
          </div>
        )}

        <svg width="200" height="200" viewBox="0 0 200 200" className="relative">
          <defs>
            <radialGradient id="flameGradient">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="35%" stopColor={colour} stopOpacity="0.8" />
              <stop offset="100%" stopColor={colour} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* The fuel: a slab for solids, a sphere for droplets */}
          {mode === 'solids' ? (
            <rect x="70" y="140" width="60" height="8" rx="2" fill="#7D8DA6" />
          ) : (
            <circle cx="100" cy="140" r="9" fill="#9FD4F5" opacity="0.8" />
          )}

          {/* The flame, morphing between the two gravity states */}
          <ellipse
            cx="100"
            cy={gravityOn ? 140 - height / 2 : 140}
            rx={width / 2}
            ry={height / 2}
            fill="url(#flameGradient)"
            style={{ transition: 'all 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
      </div>

      <p className="mt-3 text-xs text-mute leading-relaxed">
        {gravityOn
          ? 'Under gravity the hot gas rises, stretching the flame upward and pulling fresh air in from below.'
          : 'Without gravity nothing rises. Fuel and oxygen meet only by diffusion, so the flame sits as a compact sphere and burns cooler and bluer.'}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`tabular text-sm mt-0.5 ${value ? 'text-slate-200' : 'text-mute/50'}`}>
        {value ?? 'Not recorded'}
      </div>
    </div>
  )
}

/** One nearby test, with its identity, key numbers and a link to its DOI. */
function TestChip({
  test, distance, investigations,
}: {
  test: TestRecord
  distance: number
  investigations: Dataset['investigations']
}) {
  const n = test.normalized
  const investigation = investigations.find((i) => i.psi_id === test.psi_id)

  return (
    <div className="panel-flat p-2.5 hover:border-cryo/40 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-cryo">
          {test.psi_id} · {test.test_number ?? `row ${test.row_index}`}
        </span>
        <span className="text-[9px] tabular text-mute">d={distance.toFixed(2)}</span>
      </div>

      <div className="text-[11px] text-slate-300 mt-1">
        {n.material_raw ?? n.material ?? '—'}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] tabular text-mute">
        {n.o2_percent != null && <span>O₂ {n.o2_percent}%</span>}
        {n.flow_cm_s != null && <span>{n.flow_cm_s} cm/s</span>}
        {n.pressure_atm != null && <span>{n.pressure_atm} atm</span>}
        {n.burn_time_s != null && <span>{n.burn_time_s} s</span>}
        {n.flow_direction && <span className="capitalize">{n.flow_direction}</span>}
      </div>

      {n.outcome && (
        <div className="mt-1.5 text-[11px] text-star">{n.outcome}</div>
      )}

      {test.anomalies.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {test.anomalies.map((a) => (
            <span key={a} className="badge badge-warn">{a.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      {investigation?.doi_url && (
        <a
          href={investigation.doi_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-1.5 text-[10px] text-mute hover:text-cryo transition-colors"
        >
          DOI {investigation.doi} ↗
        </a>
      )}
    </div>
  )
}
