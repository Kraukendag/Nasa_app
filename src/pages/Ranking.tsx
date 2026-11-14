// =============================================================================
//  RANKING
// =============================================================================
//  Which investigations tell a mission planner the most about fire safety for
//  a given mission? The page ranks the 14 PSI investigations -- and explains
//  every step of how, so anyone can check or disagree with it.
//
//  HOW IT WORKS (the same text is shown on the page)
//  -------------------------------------------------
//  1. Pick a mission. Each has an atmosphere and a gravity level.
//  2. Each investigation gets seven scores between 0 and 1:
//       oxygen match, pressure match, gravity match, hazard relevance,
//       test scale, outcomes recorded, number of tests.
//  3. Each score is multiplied by a weight (how much it counts, 0-3).
//  4. Final score = sum(weight x score) / sum(weights), shown out of 100.
//
//  Fuel type is a FILTER, not a weight. As a weight it let a droplet
//  experiment top a "solid materials" ranking because its oxygen range matched
//  well -- arithmetically consistent, practically misleading.
//
//  Mission atmospheres come from the challenge brief: ISS cabin 21% O2 at
//  101.3 kPa; lunar habitat about 30% O2 at 10.2 psi (70.3 kPa); spacesuit
//  100% O2 at 4.3 psi (29.6 kPa).
// =============================================================================

import { Fragment, useMemo, useState } from 'react'
import type { Dataset } from '../data'
import type { Investigation } from '../types'
import { Page, Section } from '../ui'

type Gravity = '0g' | 'partial' | '1g'
interface Scenario { id: string; name: string; o2: number; kpa: number; gravity: Gravity; gLabel: string }
const SCENARIOS: Scenario[] = [
  { id: 'moon', name: 'Lunar habitat', o2: 30, kpa: 70.3, gravity: 'partial', gLabel: '0.16 g' },
  { id: 'iss', name: 'ISS cabin', o2: 21, kpa: 101.3, gravity: '0g', gLabel: 'microgravity' },
  { id: 'suit', name: 'Spacesuit', o2: 100, kpa: 29.6, gravity: 'partial', gLabel: '0.16 g (lunar surface)' },
]

type Crit = 'o2' | 'pressure' | 'gravity' | 'hazard' | 'scale' | 'outcomes' | 'size'
interface CritInfo { k: Crit; label: string; what: string; how: string; why: string }
const CRITERIA: CritInfo[] = [
  { k: 'o2', label: 'Oxygen match',
    what: 'Did the investigation test at the mission\'s oxygen level?',
    how: '1 if the mission oxygen lies inside the tested range. Outside it, the score falls with distance: e^(−gap ÷ 5), so 5 percentage points away scores 0.37 and 10 points scores 0.14. 0 if the table records no oxygen.',
    why: 'Oxygen concentration is the strongest single control on whether a material burns.' },
  { k: 'pressure', label: 'Pressure match',
    what: 'Did it test at the mission\'s pressure?',
    how: '1 inside the tested pressure range, otherwise e^(−gap ÷ 25 kPa). 0 if the table records no pressure (true of every solid-fuel table here).',
    why: 'Lower pressure changes flame temperature and spread; habitats and suits run below sea-level pressure.' },
  { k: 'gravity', label: 'Gravity match',
    what: 'Was it tested at the mission\'s gravity?',
    how: 'Microgravity mission: 1 for every investigation (all PSI data is microgravity flight data). Partial gravity: 0 for every investigation, because PSI has no partial-gravity test. 1 g: 1 only where a normal-gravity reference was recorded (SAFFIRE-II).',
    why: 'Buoyancy sets flame shape and oxygen supply. A partial-gravity mission scores 0 here for everyone: that is a finding, not a bug.' },
  { k: 'hazard', label: 'Hazard relevance',
    what: 'How directly does the fuel represent a real cabin fire?',
    how: 'Solid materials 1.0 (the actual fire load: fabrics, plastics) · smoke and dust 0.8 (fire detection) · liquid droplets 0.5 · gas flames 0.4.',
    why: 'Most of a habitat\'s flammable mass is solid material; gas and droplet flames are mainly fundamental science.' },
  { k: 'scale', label: 'Test scale',
    what: 'How close is the sample size to a real fire?',
    how: 'From the RECORDED sample size where the table gives one: 1,000 cm² or more (SAFFIRE-I and -III, 40.6 × 94 cm) 1.0 · smaller recorded samples (SAFFIRE-II, 29 × 5 cm) 0.6. Where no size is recorded, by facility: glovebox samples (BASS, SAME-R, SPICE) 0.6 · ISS cabin air sampling (DAFT) 0.5 · small samples in a sealed chamber (CIR) 0.4.',
    why: 'Fires grow; whether a small sample\'s behaviour carries over to metre-scale fires is an open question.' },
  { k: 'outcomes', label: 'Outcomes recorded',
    what: 'Does the table say how each test ended?',
    how: 'The share of the investigation\'s tests with a recorded ending (burned through, went out, blew off, never lit...).',
    why: 'A table of conditions without results cannot answer "would it burn?".' },
  { k: 'size', label: 'Number of tests',
    what: 'How much evidence is there?',
    how: 'log₁₀(tests + 1) ÷ log₁₀(470), so the largest table (SPICE, 469 tests) scores 1 and a 2-test investigation about 0.18. The logarithm stops sheer volume from dominating.',
    why: 'More tests give more confidence, with diminishing returns.' },
]

const HAZARD: Record<string, number> = { solid: 1, smoke: 0.8, aerosol: 0.8, liquid: 0.5, gas: 0.4 }
const SCALE: Record<Investigation['scale_class'], number> = { large: 1, medium: 0.6, glovebox: 0.6, cabin: 0.5, chamber: 0.4 }
const SCALE_WORDS: Record<Investigation['scale_class'], string> = {
  large: 'recorded samples of 1,000 cm² or more', medium: 'recorded samples under 1,000 cm²',
  glovebox: 'glovebox-scale samples (no size recorded)', cabin: 'ISS cabin air sampling', chamber: 'small samples in a sealed chamber',
}
const RECOMMENDED: Record<Crit, number> = { o2: 3, pressure: 2, gravity: 1, hazard: 3, scale: 2, outcomes: 2, size: 1 }

type Fuel = 'all' | 'solid' | 'liquid' | 'gas' | 'detection'
const FUELS: [Fuel, string][] = [
  ['solid', 'Solid materials (cabin fire load)'], ['detection', 'Smoke and dust (detection)'],
  ['liquid', 'Liquid droplets'], ['gas', 'Gas fuels'], ['all', 'Any fuel'],
]
const fuelMatches = (i: Investigation, fuel: Fuel) =>
  fuel === 'all' ? true : fuel === 'detection' ? ['smoke', 'aerosol'].includes(i.fuel_state) : i.fuel_state === fuel

/** 1 inside the tested range, e^(-gap/scale) outside it, 0 if not recorded. */
function closeness(r: { min: number; max: number } | null, target: number, scale: number) {
  if (!r) return { v: 0, gap: null as number | null }
  if (target >= r.min && target <= r.max) return { v: 1, gap: 0 }
  const gap = target < r.min ? r.min - target : target - r.max
  return { v: Math.exp(-gap / scale), gap }
}

interface Scored { i: Investigation; s: Record<Crit, number>; why: Record<Crit, string>; value: number }

function score(i: Investigation, sc: Scenario): Omit<Scored, 'value'> {
  const o2 = closeness(i.o2_range, sc.o2, 5)
  const p = closeness(i.pressure_kpa_range, sc.kpa, 25)
  const g = sc.gravity === '0g' ? 1 : sc.gravity === '1g' ? (i.has_1g_reference ? 1 : 0) : 0
  const n = Math.min(1, Math.log10(i.test_count + 1) / Math.log10(470))
  const r = (x: { min: number; max: number } | null, u: string) => (x ? `${+x.min.toFixed(1)}–${+x.max.toFixed(1)}${u}` : '')
  return {
    i,
    s: { o2: o2.v, pressure: p.v, gravity: g, hazard: HAZARD[i.fuel_state] ?? 0, scale: SCALE[i.scale_class], outcomes: i.outcome_fraction, size: n },
    why: {
      o2: !i.o2_range ? 'Oxygen is not recorded in this table, so 0.'
        : o2.gap === 0 ? `Tested ${r(i.o2_range, '%')}, which includes ${sc.o2}%, so 1.`
          : `Tested ${r(i.o2_range, '%')}; ${sc.o2}% is ${o2.gap!.toFixed(1)} points outside, so e^(−${o2.gap!.toFixed(1)} ÷ 5) = ${o2.v.toFixed(2)}.`,
      pressure: !i.pressure_kpa_range ? 'Pressure is not recorded in this table, so 0.'
        : p.gap === 0 ? `Tested ${r(i.pressure_kpa_range, ' kPa')}, which includes ${sc.kpa} kPa, so 1.`
          : `Tested ${r(i.pressure_kpa_range, ' kPa')}; ${sc.kpa} kPa is ${p.gap!.toFixed(1)} kPa outside, so e^(−${p.gap!.toFixed(1)} ÷ 25) = ${p.v.toFixed(2)}.`,
      gravity: sc.gravity === '0g' ? 'Microgravity flight data, as the mission requires, so 1.'
        : sc.gravity === 'partial' ? 'No partial-gravity test exists in PSI, so 0 (the same for every investigation).'
          : i.has_1g_reference ? 'Records a normal-gravity reference, so 1.' : 'No normal-gravity reference recorded, so 0.',
      hazard: `${i.fuel_state.charAt(0).toUpperCase() + i.fuel_state.slice(1)} fuel scores ${(HAZARD[i.fuel_state] ?? 0).toFixed(1)}.`,
      scale: `${SCALE_WORDS[i.scale_class].charAt(0).toUpperCase() + SCALE_WORDS[i.scale_class].slice(1)}${i.max_sample_area_cm2 ? ` (largest ${i.max_sample_area_cm2.toLocaleString()} cm²)` : ''}: ${SCALE[i.scale_class].toFixed(1)}.`,
      outcomes: `${Math.round(i.outcome_fraction * 100)}% of its tests record how they ended, so ${i.outcome_fraction.toFixed(2)}.`,
      size: `${i.test_count} tests: log₁₀(${i.test_count + 1}) ÷ log₁₀(470) = ${n.toFixed(2)}.`,
    },
  }
}

export default function Ranking({ data }: { data: Dataset }) {
  const [scId, setScId] = useState('moon')
  const [custom, setCustom] = useState<Scenario>({ id: 'custom', name: 'Custom', o2: 30, kpa: 70, gravity: '0g', gLabel: 'microgravity' })
  const [fuel, setFuel] = useState<Fuel>('solid')
  const [w, setW] = useState<Record<Crit, number>>(RECOMMENDED)
  const [open, setOpen] = useState<string | null>(null)
  const sc = scId === 'custom' ? custom : SCENARIOS.find((s) => s.id === scId)!
  const totalW = Object.values(w).reduce((a, b) => a + b, 0)

  const ranked: Scored[] = useMemo(() => data.investigations.filter((i) => fuelMatches(i, fuel)).map((i) => {
    const x = score(i, sc)
    const value = totalW ? CRITERIA.reduce((sum, c) => sum + w[c.k] * x.s[c.k], 0) / totalW : 0
    return { ...x, value }
  }).sort((a, b) => b.value - a.value), [data.investigations, sc, fuel, w, totalW])
  const top = ranked[0]
  const changed = CRITERIA.some((c) => w[c.k] !== RECOMMENDED[c.k])

  return (
    <Page wide title="Ranking" intro={<>
      Which NASA investigations tell you the most about fire safety for a particular mission? This page ranks them, and
      shows every step of the arithmetic so that anyone can check it, change the weights, or disagree.
    </>}>

      <Section title="1 · Choose the mission and what counts">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-5">
            <h3 className="h3">Mission</h3>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {[...SCENARIOS, custom].map((s) => (
                <button key={s.id} onClick={() => setScId(s.id)} className={`chip ${scId === s.id ? 'chip-on' : ''}`}>{s.name}</button>
              ))}
            </div>
            <p className="small text-ink2 mt-3 num">{sc.o2}% O₂ · {sc.kpa} kPa · {sc.gLabel}</p>
            {scId === 'custom' ? (
              <div className="space-y-3 mt-3">
                <Slider label={`Oxygen ${custom.o2}%`} min={10} max={100} v={custom.o2} on={(v) => setCustom({ ...custom, o2: v })} />
                <Slider label={`Pressure ${custom.kpa} kPa`} min={20} max={320} v={custom.kpa} on={(v) => setCustom({ ...custom, kpa: v })} />
                <div className="flex gap-1.5">
                  {([['0g', 'microgravity'], ['partial', 'partial g'], ['1g', '1 g']] as const).map(([g, l]) => (
                    <button key={g} onClick={() => setCustom({ ...custom, gravity: g, gLabel: l })} className={`chip ${custom.gravity === g ? 'chip-on' : ''}`}>{l}</button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="caption mt-2">Atmosphere from the challenge brief.</p>
            )}
            <h3 className="h3 mt-6">Fuel of interest</h3>
            <select value={fuel} onChange={(e) => setFuel(e.target.value as Fuel)} className="field mt-2" aria-label="Fuel of interest">
              {FUELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <p className="caption mt-2">A filter: only investigations with this kind of fuel are ranked. Default: solid materials, because they are what actually burns in a habitat.</p>
          </div>

          <div className="card p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="h3">How much each criterion counts</h3>
              {changed && <button onClick={() => setW(RECOMMENDED)} className="small text-accent hover:underline">Reset to recommended</button>}
            </div>
            <p className="caption mt-1">0 = ignore, 3 = counts most. The recommended weights favour atmosphere match and hazard relevance.</p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-4">
              {CRITERIA.map((c) => (
                <Slider key={c.k} label={`${c.label}`} suffix={`× ${w[c.k]}`} min={0} max={3} v={w[c.k]} on={(v) => setW({ ...w, [c.k]: v })} />
              ))}
            </div>
            <p className="small text-ink2 mt-5 num">Total weight = {CRITERIA.map((c) => w[c.k]).join(' + ')} = {totalW}</p>
          </div>
        </div>
      </Section>

      <Section title="2 · The ranking" intro="Every criterion's score is shown, so nothing hides inside a single number. Click a row to see why it scores what it does.">
        {sc.gravity === 'partial' && (
          <p className="wash p-4 small text-ink2 mb-4"><b className="text-ink">Gravity scores 0 for everyone.</b> No PSI investigation ran at
            partial gravity. That lowers every score equally; it does not change the order. Lunar-gravity results that do exist
            (LUCI, outside PSI) are on the <a href="#/findings">Findings</a> page.</p>
        )}
        {fuel === 'all' && (scId === 'moon' || scId === 'iss') && (
          <p className="wash p-4 small text-ink2 mb-4"><b className="text-ink">Careful with “Any fuel”.</b> Droplet and gas experiments
            covered wider oxygen and pressure ranges, so they can outrank every solid-material experiment even though a habitat’s
            fire load is solid materials. For a habitat question, use the “Solid materials” filter.</p>
        )}
        {top && top.value < 0.5 && (
          <p className="wash p-4 small text-ink2 mb-4">No investigation in this selection reaches 50. That is the finding: this part of the
            mission envelope is barely tested in PSI.</p>
        )}
        {/* Phones: one card per investigation instead of a wide table. */}
        <ol className="md:hidden space-y-3">
          {ranked.map((r, n) => (
            <li key={r.i.psi_id} className="card p-4">
              <button className="w-full text-left" onClick={() => setOpen(open === r.i.psi_id ? null : r.i.psi_id)} aria-expanded={open === r.i.psi_id}>
                <div className="flex items-baseline gap-3">
                  <span className="num caption">{n + 1}</span>
                  <span className="flex-1"><span className="num">{r.i.psi_id}</span> <b className="font-medium">{r.i.acronym}</b></span>
                  <span className="num text-xl">{Math.round(r.value * 100)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 caption num">
                  {CRITERIA.map((c) => <div key={c.k} className="flex justify-between gap-2"><dt>{c.label}</dt><dd>{r.s[c.k].toFixed(2)}</dd></div>)}
                </dl>
              </button>
              {open === r.i.psi_id && <WhyItRanks r={r} w={w} totalW={totalW} />}
            </li>
          ))}
        </ol>
        <div className="card overflow-x-auto hidden md:block">
          <table className="tbl min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10">#</th><th>Investigation</th>
                {CRITERIA.map((c) => <th key={c.k} className="text-right">{c.label}<div className="caption font-normal">× {w[c.k]}</div></th>)}
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, n) => (
                <Fragment key={r.i.psi_id}>
                  <tr onClick={() => setOpen(open === r.i.psi_id ? null : r.i.psi_id)} className="cursor-pointer hover:bg-wash">
                    <td className="num text-mute">{n + 1}</td>
                    <td><span className="num">{r.i.psi_id}</span> <b className="font-medium">{r.i.acronym}</b><div className="caption truncate max-w-[260px]">{r.i.title}</div></td>
                    {CRITERIA.map((c) => (
                      <td key={c.k} className={`text-right num ${w[c.k] === 0 ? 'text-mute/60' : ''}`}>{r.s[c.k].toFixed(2)}</td>
                    ))}
                    <td className="text-right">
                      <div className="num text-lg">{Math.round(r.value * 100)}</div>
                      <div className="h-1 w-20 ml-auto rounded-full bg-wash overflow-hidden"><div className="h-full bg-accent" style={{ width: `${r.value * 100}%` }} /></div>
                    </td>
                  </tr>
                  {open === r.i.psi_id && (
                    <tr className="bg-wash/60">
                      <td />
                      <td colSpan={CRITERIA.length + 2} className="py-4">
                        <WhyItRanks r={r} w={w} totalW={totalW} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="3 · How the score is calculated" intro="The whole method, in plain words. Nothing else goes into the number.">
        <ol className="space-y-3 text-ink2 list-decimal pl-5 max-w-3xl">
          <li>Pick a mission. It sets a target oxygen level, pressure and gravity.</li>
          <li>Keep only the investigations whose fuel matches the fuel of interest.</li>
          <li>Give each investigation seven scores between 0 (no help) and 1 (fully relevant), defined in the table below.</li>
          <li>Multiply each score by its weight, add the results, and divide by the total weight. Multiply by 100.</li>
        </ol>
        <p className="font-mono text-[14px] bg-card border border-rule rounded-md px-4 py-3 mt-5 inline-block">
          score = (w₁·s₁ + w₂·s₂ + … + w₇·s₇) ÷ (w₁ + w₂ + … + w₇) × 100
        </p>
        <div className="card overflow-x-auto mt-6">
          <table className="tbl min-w-[860px]">
            <thead><tr><th className="w-40">Criterion</th><th>Question it answers</th><th>How the 0–1 score is computed</th><th>Why it matters</th></tr></thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.k}><td className="font-medium">{c.label}</td><td className="text-ink2">{c.what}</td><td>{c.how}</td><td className="text-ink2">{c.why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {top && (
        <Section title="4 · Worked example" intro={`The top result for ${sc.name.toLowerCase()}, fuel filter “${FUELS.find((f) => f[0] === fuel)?.[1]}”, computed by hand.`}>
          <div className="card p-5 max-w-3xl">
            <h3 className="h3">{top.i.psi_id} {top.i.acronym}: {top.i.title}</h3>
            <WhyItRanks r={top} w={w} totalW={totalW} />
          </div>
        </Section>
      )}

      <Section title="5 · Limitations">
        <ul className="list-disc pl-5 space-y-2 text-ink2 max-w-3xl">
          <li>The ranking measures how <i>relevant</i> an investigation's conditions are to a mission, not how good the science is.</li>
          <li>Hazard and scale values (for example solid = 1.0, gas = 0.4) are this team's judgement, stated openly so they can be argued with. The weights can be changed above.</li>
          <li>An investigation that records no oxygen or pressure scores 0 on that criterion even if the hardware controlled it: the score reflects what the table records.</li>
          <li>Ranges are summarised by their minimum and maximum, so an investigation with one test at 30% O₂ counts as covering everything up to 30%.</li>
          <li>Literature outside PSI (LUCI, Saffire IV–VI) is not ranked, because it has no PSI table to score.</li>
        </ul>
      </Section>
    </Page>
  )
}

function WhyItRanks({ r, w, totalW }: { r: Scored; w: Record<Crit, number>; totalW: number }) {
  const sum = CRITERIA.reduce((a, c) => a + w[c.k] * r.s[c.k], 0)
  return (
    <div className="mt-2">
      <table className="w-full small">
        <thead><tr className="text-left caption"><th className="font-medium py-1 pr-3">Criterion</th><th className="font-medium py-1 pr-3">Reason</th><th className="font-medium py-1 text-right whitespace-nowrap">weight × score</th></tr></thead>
        <tbody>
          {CRITERIA.map((c) => (
            <tr key={c.k} className="border-t border-rule/70 align-top">
              <td className="py-1.5 pr-3 whitespace-nowrap">{c.label}</td>
              <td className="py-1.5 pr-3 text-ink2">{r.why[c.k]}</td>
              <td className="py-1.5 text-right num whitespace-nowrap">{w[c.k]} × {r.s[c.k].toFixed(2)} = {(w[c.k] * r.s[c.k]).toFixed(2)}</td>
            </tr>
          ))}
          <tr className="border-t border-ink2/40">
            <td className="py-2 font-medium" colSpan={2}>Sum ÷ total weight × 100</td>
            <td className="py-2 text-right num font-medium whitespace-nowrap">{sum.toFixed(2)} ÷ {totalW} × 100 = {Math.round(r.value * 100)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Slider({ label, suffix, min, max, v, on }: { label: string; suffix?: string; min: number; max: number; v: number; on: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between small text-ink2"><span>{label}</span>{suffix && <span className="num">{suffix}</span>}</span>
      <input type="range" min={min} max={max} step={1} value={v} onChange={(e) => on(Number(e.target.value))} />
    </label>
  )
}
