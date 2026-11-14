// =============================================================================
//  OUTCOMES ENGINE
// =============================================================================
//  Takes the real NASA tests that match what the user set up, and summarises
//  what actually happened in them: did it ignite, how long did it burn, how did
//  it end.
//
//  THIS IS NOT A PREDICTION. It is a count of recorded results. If NASA ran
//  twelve tests near these conditions and nine of them self-extinguished, this
//  says "9 of 12 self-extinguished" — it never says "this will extinguish".
//
//  Where a table has no outcome column at all (BASS and BASS-II record the
//  conditions but not the result), this reports that honestly instead of
//  leaving the panel blank or inventing a verdict.
// =============================================================================

import type { TestRecord } from './types'

export interface NumericSummary {
  min: number
  max: number
  median: number
  count: number
}

export interface OutcomeSummary {
  /** How many matched tests we looked at. */
  sampled: number
  /** How many of those actually recorded an outcome of any kind. */
  withOutcome: number
  /** Recorded end-states and how often each occurred, most common first. */
  outcomes: { label: string; count: number; share: number }[]
  /** Ignition, where the table records it explicitly (CFI-G does). */
  ignition: { ignited: number; failed: number } | null
  /** Burn time in seconds, across tests that recorded one. */
  burnTime: NumericSummary | null
  /** Droplet extinction diameter in mm, for FLEX and CFI rows. */
  extinctionDiameter: NumericSummary | null
  /** Peak burner temperature in C, for CFI-G rows. */
  peakTemp: NumericSummary | null
  /** How many matched tests showed cool-flame behaviour. */
  coolFlames: number
  /** Investigations the evidence came from. */
  sources: string[]
  /** Set when no matched test recorded any outcome at all. */
  noOutcomeReason: string | null
}

/** Min / median / max for whichever tests recorded this measurement. */
function summarise(values: number[]): NumericSummary | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (clean.length === 0) return null
  const mid = Math.floor(clean.length / 2)
  return {
    min: clean[0],
    max: clean[clean.length - 1],
    median: clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2,
    count: clean.length,
  }
}

export function summariseOutcomes(tests: TestRecord[]): OutcomeSummary {
  // Rows flagged with a failed sensor are kept in the Data Library but must
  // not shape a summary — a broken oxygen reading is not a result.
  const usable = tests.filter(
    (t) => !t.is_note && !t.is_flow_vis && !t.anomalies.includes('sensor_failure'),
  )

  const tally = new Map<string, number>()
  let ignited = 0
  let failedToIgnite = 0
  let hasIgnitionColumn = false
  let coolFlames = 0

  const burnTimes: number[] = []
  const extinctionDiameters: number[] = []
  const peakTemps: number[] = []

  for (const test of usable) {
    const n = test.normalized

    if (n.outcome) tally.set(n.outcome, (tally.get(n.outcome) ?? 0) + 1)

    // CFI-G is the one set of tables with a plain yes/no ignition column.
    const hotIgnition = n.hot_ignition
    if (typeof hotIgnition === 'boolean') {
      hasIgnitionColumn = true
      hotIgnition ? ignited++ : failedToIgnite++
    }

    if (n.cool_flame === true) coolFlames++
    if (test.anomalies.includes('cool_flame_candidate')) coolFlames++

    // Only count burn time for tests that actually burned. CFI-G records a
    // burn time of 0 for attempts that never caught; folding those zeros in
    // would drag the "typical burn time" down with tests that did not burn.
    const neverLit = hotIgnition === false || n.outcome === 'No ignition'
    if (n.burn_time_s != null && !neverLit) burnTimes.push(n.burn_time_s)
    if (n.extinction_d_mm != null) extinctionDiameters.push(n.extinction_d_mm)
    if (typeof n.temperature_c === 'number') peakTemps.push(n.temperature_c)
  }

  const withOutcome = [...tally.values()].reduce((a, b) => a + b, 0)
  const outcomes = [...tally.entries()]
    .map(([label, count]) => ({ label, count, share: count / Math.max(1, withOutcome) }))
    .sort((a, b) => b.count - a.count)

  const sources = [...new Set(usable.map((t) => t.psi_id))].sort()

  // Explain an empty panel rather than just showing nothing.
  let noOutcomeReason: string | null = null
  if (usable.length === 0) {
    noOutcomeReason = 'No recorded tests match these conditions closely enough.'
  } else if (withOutcome === 0 && !hasIgnitionColumn && burnTimes.length === 0) {
    const names = sources.join(', ')
    noOutcomeReason =
      `The nearest tests come from ${names}, whose experimental tables record the ` +
      'conditions of each run but not how it ended. Those results exist only in the ' +
      'mission reports, which are not part of this dataset.'
  }

  return {
    sampled: usable.length,
    withOutcome,
    outcomes,
    ignition: hasIgnitionColumn ? { ignited, failed: failedToIgnite } : null,
    burnTime: summarise(burnTimes),
    extinctionDiameter: summarise(extinctionDiameters),
    peakTemp: summarise(peakTemps),
    coolFlames,
    sources,
    noOutcomeReason,
  }
}

/** Plain-language reading of an outcome label, for people who are not
 *  combustion researchers. Only labels that genuinely appear are listed. */
export const OUTCOME_MEANINGS: Record<string, string> = {
  Extinction: 'The flame went out on its own while fuel remained.',
  Disruption: 'The flame broke up — the droplet fragmented or the flame tore apart.',
  Completion: 'It burned until the fuel ran out.',
  'Self-extinguished': 'The flame went out without the crew intervening.',
  'Flow terminated': 'The crew cut the fuel flow to end the test.',
  'No ignition': 'It never caught at all.',
}
