// =============================================================================
//  INSIGHTS · MISSION RANKING
// =============================================================================
//  Which investigations tell you the most about fire safety for a given
//  mission? Pick a scenario, set how much each criterion matters, and the
//  ranking recomputes. Every criterion's score is shown, so nothing is hidden
//  inside a single number.
//
//  Scenario atmospheres are framing values from the challenge text (E3):
//  ISS cabin 21% O2 at 101.3 kPa; lunar habitat about 30% O2 at 10.2 psi
//  (70.3 kPa); suit 100% O2 at 4.3 psi (29.6 kPa).
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'
import type { Investigation } from '../../types'

type Gravity = '0g' | 'partial' | '1g'
interface Scenario { id: string; name: string; o2: number; kpa: number; gravity: Gravity }
const SCENARIOS: Scenario[] = [
  { id: 'iss', name: 'ISS cabin', o2: 21, kpa: 101.3, gravity: '0g' },
  { id: 'moon', name: 'Lunar habitat', o2: 30, kpa: 70.3, gravity: 'partial' },
  { id: 'suit', name: 'Spacesuit', o2: 100, kpa: 29.6, gravity: 'partial' },
]
const CRITERIA = [
  { k: 'o2', label: 'Oxygen match' }, { k: 'pressure', label: 'Pressure match' },
  { k: 'gravity', label: 'Gravity match' },
  { k: 'outcomes', label: 'Outcomes recorded' }, { k: 'size', label: 'Number of tests' },
] as const
type Crit = typeof CRITERIA[number]['k']

/** 1 inside the tested range, decaying with distance outside it, 0 when the
 *  investigation does not record the quantity at all. */
function closeness(r: { min: number; max: number } | null, target: number, scale: number) {
  if (!r) return 0
  if (target >= r.min && target <= r.max) return 1
  const gap = target < r.min ? r.min - target : target - r.max
  return Math.exp(-gap / scale)
}

// Fuel of interest is a FILTER, not a weighted criterion. As a weight it let a
// droplet experiment top a "solid materials" ranking because its oxygen and
// pressure matched so well -- technically consistent, practically misleading.
const fuelMatches = (i: Investigation, fuel: string) =>
  fuel === 'all' ? true : fuel === 'detection' ? ['smoke', 'aerosol'].includes(i.fuel_state) : i.fuel_state === fuel

function score(i: Investigation, s: Scenario): Record<Crit, number> {
  return {
    o2: closeness(i.o2_range, s.o2, 5),
    pressure: closeness(i.pressure_kpa_range, s.kpa, 25),
    // Every investigation here is 0 g flight data. No partial-g data exists,
    // so a partial-g scenario scores 0 for everyone; 1 g needs a reference.
    gravity: s.gravity === '0g' ? 1 : s.gravity === '1g' ? (i.has_1g_reference ? 1 : 0) : 0,
    outcomes: i.outcome_fraction,
    size: Math.min(1, Math.log10(i.test_count + 1) / Math.log10(470)),
  }
}

export default function Ranking({ data }: { data: Dataset }) {
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[1])
  const [custom, setCustom] = useState<Scenario>({ id: 'custom', name: 'Custom', o2: 30, kpa: 70, gravity: '0g' })
  const [fuel, setFuel] = useState('all')
  const [w, setW] = useState<Record<Crit, number>>({ o2: 3, pressure: 2, gravity: 1, outcomes: 2, size: 1 })
  const active = scenario.id === 'custom' ? custom : scenario

  const ranked = useMemo(() => {
    const total = Object.values(w).reduce((a, b) => a + b, 0) || 1
    return data.investigations.filter((i) => fuelMatches(i, fuel)).map((i) => {
      const s = score(i, active)
      const value = CRITERIA.reduce((sum, c) => sum + w[c.k] * s[c.k], 0) / total
      return { i, s, value }
    }).sort((a, b) => b.value - a.value)
  }, [data.investigations, active, fuel, w])

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5">
      <div className="space-y-4">
        <div>
          <div className="label mb-1.5">Mission scenario</div>
          <div className="grid grid-cols-2 gap-1">
            {[...SCENARIOS, custom].map((s) => (
              <button key={s.id} onClick={() => setScenario(s)} className={`btn !py-1.5 text-[11px] ${scenario.id === s.id ? 'btn-active' : ''}`}>{s.name}</button>
            ))}
          </div>
          <p className="text-[10px] text-mute mt-1.5 tabular">
            {active.o2}% O₂ · {active.kpa} kPa · {active.gravity === 'partial' ? 'partial gravity' : active.gravity}
          </p>
          {scenario.id === 'custom' && (
            <div className="space-y-2 mt-2">
              <Slide label={`Oxygen ${custom.o2}%`} min={10} max={100} v={custom.o2} on={(v) => setCustom({ ...custom, o2: v })} />
              <Slide label={`Pressure ${custom.kpa} kPa`} min={20} max={320} v={custom.kpa} on={(v) => setCustom({ ...custom, kpa: v })} />
              <div className="grid grid-cols-3 gap-1">
                {(['0g', 'partial', '1g'] as Gravity[]).map((g) => (
                  <button key={g} onClick={() => setCustom({ ...custom, gravity: g })} className={`btn !py-1 text-[10px] ${custom.gravity === g ? 'btn-active' : ''}`}>{g}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="label mb-1.5">Fuel of interest (filter)</div>
          <select value={fuel} onChange={(e) => setFuel(e.target.value)} className="w-full bg-navy/60 border border-edge rounded px-2 py-1.5 text-[11px] text-slate-200">
            <option value="all">Any fuel</option><option value="solid">Solid materials (cabin fuel load)</option>
            <option value="liquid">Liquid droplets</option><option value="gas">Gas fuels</option><option value="detection">Smoke and dust (detection)</option>
          </select>
        </div>
        <div>
          <div className="label mb-1.5">How much each criterion counts</div>
          <div className="space-y-2">
            {CRITERIA.map((c) => <Slide key={c.k} label={`${c.label} · ×${w[c.k]}`} min={0} max={3} v={w[c.k]} on={(v) => setW({ ...w, [c.k]: v })} />)}
          </div>
        </div>
        <p className="text-[10px] text-mute leading-snug">
          Score = Σ (weight × criterion) ÷ Σ weights. Oxygen and pressure score 1 inside an investigation's tested range and fall
          off outside it; 0 if not recorded. {active.gravity === 'partial' && <span className="text-star">No investigation has partial-gravity data, so gravity scores 0 for all.</span>}
        </p>
      </div>

      <div className="space-y-2">
      {ranked.length > 0 && ranked[0].value < 0.4 && (
        <div className="panel-flat p-3 border-star/40 text-[11px] text-slate-300">
          No investigation in this selection comes close to the {active.name.toLowerCase()} conditions, so every score stays low.
          That is the finding: this part of the mission envelope is untested in this dataset.
        </div>
      )}
      <ol className="space-y-1.5">
        {ranked.map(({ i, s, value }, n) => (
          <li key={i.psi_id} className={`panel-flat p-2.5 ${n < 5 ? 'border-cryo/40' : 'opacity-80'}`}>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[11px] text-mute w-5">{n + 1}</span>
              <span className="font-mono text-[11px] text-cryo">{i.psi_id} · {i.acronym}</span>
              <span className="text-[11px] text-slate-300 truncate">{i.title}</span>
              <span className="ml-auto tabular text-sm text-slate-100">{Math.round(value * 100)}</span>
            </div>
            <div className="ml-7 mt-1 h-1.5 rounded-full bg-navy overflow-hidden">
              <div className="h-full bg-cryo rounded-full transition-all duration-500" style={{ width: `${value * 100}%` }} />
            </div>
            <div className="ml-7 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9.5px] tabular text-mute">
              {CRITERIA.map((c) => <span key={c.k}>{c.label.split(' ')[0].toLowerCase()} {s[c.k].toFixed(2)}</span>)}
            </div>
          </li>
        ))}
      </ol>
      </div>
    </div>
  )
}

function Slide({ label, min, max, v, on }: { label: string; min: number; max: number; v: number; on: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] text-mute">{label}</span>
      <input type="range" min={min} max={max} step={1} value={v} onChange={(e) => on(Number(e.target.value))} />
    </label>
  )
}
