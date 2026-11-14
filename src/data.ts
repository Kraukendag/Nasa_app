// =============================================================================
//  DATA LOADING
// =============================================================================
//  Loads the five JSON files the Python pipeline produced. They are fetched
//  once when the site opens and then held in memory -- there is no backend and
//  no network call after that first load, so the site works offline.
// =============================================================================

import type { Findings, FlexModel, Investigation, MaterialCard, TestRecord } from './types'

export interface Dataset {
  tests: TestRecord[]
  investigations: Investigation[]
  materials: MaterialCard[]
  findings: Findings
  flexModel: FlexModel
}

/** Fetch all five data files at the same time rather than one after another. */
export async function loadDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const get = async <T>(name: string): Promise<T> => {
    const response = await fetch(`${base}data/${name}`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    return response.json() as Promise<T>
  }
  const [tests, investigations, materials, findings, flexModel] = await Promise.all([
    get<TestRecord[]>('tests.json'),
    get<Investigation[]>('investigations.json'),
    get<MaterialCard[]>('materials.json'),
    get<Findings>('findings.json'),
    get<FlexModel>('flex_model.json'),
  ])
  return { tests, investigations, materials, findings, flexModel }
}

// -----------------------------------------------------------------------------
//  FLEX MODEL EVALUATION
// -----------------------------------------------------------------------------

/** Run the fitted logistic regression for one set of droplet conditions.
 *
 *  Returns the probability that the test ends in Extinction, and whether the
 *  inputs sit inside the range FLEX actually covered. If any input is outside
 *  that range we still return the number but mark `inRange: false`, and the
 *  interface refuses to display it -- predicting beyond measured conditions
 *  would be inventing a result.
 */
export function evaluateFlexModel(
  model: FlexModel,
  inputs: { isHeptane: boolean; o2: number; co2: number; he: number; pressureMmHg: number; d0: number },
): { probability: number; inRange: boolean; outOfRange: string[] } {
  const raw = [
    inputs.isHeptane ? 1 : 0,
    inputs.o2,
    inputs.co2,
    inputs.he,
    inputs.pressureMmHg,
    inputs.d0,
  ]

  const outOfRange: string[] = []
  model.features.forEach((feature, i) => {
    const range = model.feature_ranges[feature]
    // The fuel flag is a yes/no, not a measured range, so skip it.
    if (!range || feature === 'is_heptane') return
    if (raw[i] < range.min || raw[i] > range.max) outOfRange.push(feature)
  })

  // Standardize exactly the way the Python script did before fitting.
  const z = model.features.reduce((sum, _feature, i) => {
    const scaled = (raw[i] - model.feature_means[i]) / model.feature_stds[i]
    return sum + model.weights[i] * scaled
  }, model.bias)

  return {
    probability: 1 / (1 + Math.exp(-z)),
    inRange: outOfRange.length === 0,
    outOfRange,
  }
}

// -----------------------------------------------------------------------------
//  FINDING THE NEAREST REAL TESTS
// -----------------------------------------------------------------------------

/** Score how far a real test sits from the conditions the user picked.
 *
 *  Lower is closer. Each parameter is divided by its own range first so that
 *  oxygen percent (a span of ~10) and pressure in mmHg (a span of ~2000) carry
 *  comparable weight. A mismatched material adds a flat penalty, because a
 *  PMMA test is not "nearly" a silicone test no matter how close the numbers.
 */
export function distanceToTest(
  test: TestRecord,
  target: { material?: string | null; o2?: number | null; flow?: number | null; pressure?: number | null },
  ranges: { o2: number; flow: number; pressure: number },
): number {
  const n = test.normalized
  let sum = 0

  // A different material is not "nearly" the same material, however close the
  // numbers are, so a mismatch costs a flat penalty.
  if (target.material && n.material && target.material !== n.material) sum += 4

  // Compare one measurement. If the test never recorded that measurement we
  // charge a penalty instead of skipping it.
  //
  // WHY: skipping used to reward empty rows. A BASS row records no oxygen and
  // no airflow, so it differed from the user's settings on nothing at all and
  // scored a perfect 0 -- rows with the least data were ranked as the best
  // matches. Charging for a blank keeps rows that actually measured something
  // ahead of rows that measured nothing.
  const MISSING_PENALTY = 1.5
  const compare = (wanted: number | null | undefined, actual: number | null, range: number) => {
    if (wanted == null) return          // the user is not filtering on this
    if (actual == null) { sum += MISSING_PENALTY; return }
    sum += ((wanted - actual) / range) ** 2
  }

  compare(target.o2, n.o2_percent, ranges.o2)
  compare(target.flow, n.flow_cm_s, ranges.flow)
  compare(target.pressure, n.pressure_atm, ranges.pressure)

  return Math.sqrt(sum)
}

/** Pick the N closest real tests to a set of conditions. */
export function nearestTests(
  tests: TestRecord[],
  target: Parameters<typeof distanceToTest>[1],
  count = 5,
): { test: TestRecord; distance: number }[] {
  const usable = tests.filter((t) => !t.is_note && !t.is_flow_vis)
  const spread = (pick: (t: TestRecord) => number | null) => {
    const values = usable.map(pick).filter((v): v is number => v != null)
    return values.length ? Math.max(1e-6, Math.max(...values) - Math.min(...values)) : 1
  }
  const ranges = {
    o2: spread((t) => t.normalized.o2_percent),
    flow: spread((t) => t.normalized.flow_cm_s),
    pressure: spread((t) => t.normalized.pressure_atm),
  }
  return usable
    .map((test) => ({ test, distance: distanceToTest(test, target, ranges) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
}
