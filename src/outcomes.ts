// =============================================================================
//  OUTCOMES ENGINE
// =============================================================================
//  Counts what happened in a set of real tests. Not a prediction: if eight of
//  twelve matched tests ignited, it says "8 of 12 ignited".
//
//  The set it receives always holds ONE material (the Lab's filters guarantee
//  that), so a silicone summary can never be padded with PMMA results.
// =============================================================================

import type { TestRecord } from './types'

export interface NumericSummary { min: number; max: number; median: number; count: number }

export interface OutcomeSummary {
  sampled: number
  withOutcome: number
  outcomes: { cls: string; label: string; count: number; share: number }[]
  ignition: { ignited: number; failed: number } | null
  burnTime: NumericSummary | null
  extinctionDiameter: NumericSummary | null
  spreadRate: NumericSummary | null
  peakTemp: NumericSummary | null
  /** Cool flames the TABLE records (CFI-G "Cool flame?" = yes). */
  coolFlamesRecorded: number
  /** Tests in cool-flame TERRITORY (FLEX heptane above 2.4 mm). A marker, not an observation. */
  coolFlameTerritory: number
  sources: string[]
  noOutcomeReason: string | null
  /** NASA's own words for a few of the endings, with where they come from. */
  quotes: { test: string; psi: string; text: string; source: string | null }[]
}

export function summarise(values: number[]): NumericSummary | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return { min: v[0], max: v[v.length - 1], median: v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2, count: v.length }
}

/** gravity: '0g' summarises the flight results; '1g' the normal-gravity
 *  reference columns (only SAFFIRE-II has them). */
export function summariseOutcomes(tests: TestRecord[], gravity: '0g' | '1g' = '0g', dropImplausibleO2 = false): OutcomeSummary {
  // Same counting rule as the data build: a doubtful oxygen reading does not
  // change how a test ended, so those rows are dropped only when oxygen is
  // the thing being matched.
  const usable = tests.filter((t) => !t.is_note && !t.is_flow_vis
    && !(dropImplausibleO2 && t.anomalies.includes('implausible_o2_reading')))

  const tally = new Map<string, { label: string; count: number }>()
  let ignited = 0, failed = 0, hasIgnition = false, coolRec = 0, coolTer = 0
  const burn: number[] = [], ext: number[] = [], spread: number[] = [], temp: number[] = []
  const quotes: OutcomeSummary['quotes'] = []

  for (const t of usable) {
    const n = t.normalized
    const cls = gravity === '1g' ? (n.outcome_1g_class as string | null) : n.outcome_class
    const label = gravity === '1g' ? (n.outcome_1g as string | null) : n.outcome
    if (cls && label && cls !== 'ignition_count') {
      const e = tally.get(cls) ?? { label, count: 0 }
      e.count++
      tally.set(cls, e)
    }
    if (gravity === '0g') {
      if (typeof n.hot_ignition === 'boolean') { hasIgnition = true; n.hot_ignition ? ignited++ : failed++ }
      if (n.cool_flame === true) coolRec++
      if (t.science_flags.includes('cool_flame_territory')) coolTer++
      // A test that never lit has no burn time to report; counting CFI-G's
      // recorded 0 s would drag the typical burn time down.
      const neverLit = n.hot_ignition === false || cls === 'no_ignition_gas' || cls === 'no_ignition'
      if (n.burn_time_s != null && !neverLit) burn.push(n.burn_time_s)
      if (n.extinction_d_mm != null) ext.push(n.extinction_d_mm)
      if (n.spread_rate_mm_s != null) spread.push(n.spread_rate_mm_s)
      if (typeof n.temperature_c === 'number') temp.push(n.temperature_c)
      if (n.outcome_text && quotes.length < 4 && t.psi_id === 'PSI-25') {
        quotes.push({ test: t.test_number ?? '', psi: t.psi_id, text: n.outcome_text, source: n.outcome_source })
      }
    } else if (typeof n.spread_rate_1g_mm_s === 'number') {
      spread.push(n.spread_rate_1g_mm_s)
    }
  }

  const withOutcome = [...tally.values()].reduce((a, b) => a + b.count, 0)
  const outcomes = [...tally.entries()]
    .map(([cls, e]) => ({ cls, label: e.label, count: e.count, share: e.count / Math.max(1, withOutcome) }))
    .sort((a, b) => b.count - a.count)
  const sources = [...new Set(usable.map((t) => t.psi_id))].sort()

  let noOutcomeReason: string | null = null
  if (!usable.length) noOutcomeReason = 'No recorded test matches these settings.'
  else if (!withOutcome && !hasIgnition && !burn.length) {
    noOutcomeReason = gravity === '1g'
      ? 'None of these tests has a normal-gravity result recorded.'
      : `These tests come from ${sources.join(', ')}, whose table records the conditions of each run but not how it ended.`
  }

  return {
    sampled: usable.length, withOutcome, outcomes,
    ignition: hasIgnition ? { ignited, failed } : null,
    burnTime: summarise(burn), extinctionDiameter: summarise(ext),
    spreadRate: summarise(spread), peakTemp: summarise(temp),
    coolFlamesRecorded: coolRec, coolFlameTerritory: coolTer,
    sources, noOutcomeReason, quotes,
  }
}

/** Plain-language meaning of each ending category. */
export const OUTCOME_MEANINGS: Record<string, string> = {
  Extinction: 'The flame went out on its own while fuel remained.',
  Disruption: 'The droplet or flame broke apart.',
  Completion: 'It burned until the fuel ran out.',
  self_extinguished_gas: 'The flame went out without the crew intervening.',
  flow_terminated: 'The crew cut the fuel flow to end the test.',
  no_ignition_gas: 'It never caught at all.',
  extinguished_low_flow: 'The crew stepped the airflow down until the flame could no longer survive.',
  extinguished_flow_stopped: 'The crew stopped the airflow; the flame went out.',
  self_extinguished: 'The flame went out by itself at a steady airflow.',
  extinguished: 'The flame went out; the notes do not say why.',
  blowoff: 'Airflow was raised until it blew the flame off.',
  burned_entire: 'The flame consumed the whole sample.',
  burned_sustained: 'The flame kept burning; no extinction was recorded.',
  no_sustained_flame: 'A flame appeared but never established itself.',
  no_ignition: 'It did not ignite.',
  negligible_burn: 'Burn length about 0 cm.',
  partial_burn: 'Part of the sample burned.',
}
