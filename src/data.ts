// =============================================================================
//  DATA LOADING AND THE FLEX MODEL
// =============================================================================
//  Fetches the six JSON files once at start-up (literature.json holds the
//  verified results from outside PSI, kept apart from the PSI rows). After that the site makes no
//  network calls at all, so it works offline.
// =============================================================================

import type { Findings, FlexModel, Investigation, Literature, MaterialCard, TestRecord } from './types'

export interface Dataset {
  tests: TestRecord[]
  investigations: Investigation[]
  materials: MaterialCard[]
  findings: Findings
  flexModel: FlexModel
  literature: Literature
}

export async function loadDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const get = async <T>(name: string): Promise<T> => {
    const response = await fetch(`${base}data/${name}`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    return response.json() as Promise<T>
  }
  const [tests, investigations, materials, findings, flexModel, literature] = await Promise.all([
    get<TestRecord[]>('tests.json'),
    get<Investigation[]>('investigations.json'),
    get<MaterialCard[]>('materials.json'),
    get<Findings>('findings.json'),
    get<FlexModel>('flex_model.json'),
    get<Literature>('literature.json'),
  ])
  return { tests, investigations, materials, findings, flexModel, literature }
}

/** Find the card for a material in a given state (silicone-as-solid and
 *  silicone-as-smoke are separate cards). */
export function cardFor(data: Dataset, name: string, state: string) {
  return data.materials.find((m) => m.id === `${name}|${state}`)
}

/** Look up an investigation's display name, e.g. "PSI-25 · BASS-II". */
export function invLabel(data: Dataset, psiId: string) {
  const inv = data.investigations.find((i) => i.psi_id === psiId)
  return inv ? `${psiId} · ${inv.acronym}` : psiId
}

// -----------------------------------------------------------------------------
//  FLEX MODEL
// -----------------------------------------------------------------------------

export interface FlexInputs {
  isHeptane: boolean
  o2: number      // mole fraction, 0-1
  co2: number
  he: number
  pressureMmHg: number
  d0: number
}

export interface FlexResult {
  probability: number
  /** Whether it is honest to show the probability at all. */
  shown: boolean
  /** Why not, in plain words, when it is not shown. */
  reasons: string[]
  /** Distance to the nearest real FLEX test, in standardized units. */
  nearestDistance: number
}

/** Run the fitted model -- and decide whether its answer may be shown.
 *
 *  Three checks, all must pass:
 *   1. The gas mixture is physically possible (O2 + CO2 + He cannot exceed 1).
 *   2. Every input lies inside the range FLEX covered.
 *   3. The COMBINATION lies near at least one real FLEX test. Inputs that are
 *      each in range can still form a combination nobody ever tested.
 */
export function evaluateFlexModel(model: FlexModel, x: FlexInputs): FlexResult {
  const raw = [x.isHeptane ? 1 : 0, x.o2, x.co2, x.he, x.pressureMmHg, x.d0]
  const reasons: string[] = []

  if (x.o2 + x.co2 + x.he > 1.0001) {
    reasons.push('the gas fractions add up to more than 100%')
  }
  model.features.forEach((f, i) => {
    const r = model.feature_ranges[f]
    if (f !== 'is_heptane' && r && (raw[i] < r.min || raw[i] > r.max)) {
      reasons.push(`${f.replace(/_/g, ' ')} is outside the range FLEX tested`)
    }
  })

  const scaled = raw.map((v, i) => (v - model.feature_means[i]) / model.feature_stds[i])
  let nearest = Infinity
  for (const p of model.support.points) {
    let d = 0
    for (let i = 0; i < p.length; i++) d += (p[i] - scaled[i]) ** 2
    nearest = Math.min(nearest, Math.sqrt(d))
  }
  if (nearest > model.support.nn_threshold) {
    reasons.push('this combination is far from every condition FLEX actually ran')
  }

  const z = scaled.reduce((sum, s, i) => sum + model.weights[i] * s, model.bias)
  return {
    probability: 1 / (1 + Math.exp(-z)),
    shown: reasons.length === 0,
    reasons,
    nearestDistance: nearest,
  }
}
