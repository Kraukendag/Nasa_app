// =============================================================================
//  TYPES
// =============================================================================
//  These describe the shape of the JSON that scripts/build_data.py writes.
//  Keeping them here means TypeScript will warn us if we ever read a field
//  that does not exist, instead of silently showing "undefined" to a user.
// =============================================================================

/** Every measurable thing we pulled out of a raw CSV row.
 *  Anything null means NASA did not record it. Null never means zero. */
export interface Normalized {
  material: string | null
  material_raw: string | null
  geometry: string | null
  thickness_mm: number | null
  width_mm: number | null
  diameter_mm: number | null
  fuel: string | null
  fuel_state: string | null
  o2_percent: number | null
  o2_mole_fraction: number | null
  n2_mole_fraction: number | null
  co2_mole_fraction: number | null
  he_mole_fraction: number | null
  pressure_atm: number | null
  pressure_kpa: number | null
  pressure_mmhg: number | null
  flow_cm_s: number | null
  flow_raw: string | null
  flow_direction: string | null
  gravity: string | null
  droplet_d0_mm: number | null
  extinction_d_mm: number | null
  burn_rate: number | null
  burn_time_s: number | null
  outcome: string | null
  rt_r0: number | null
  temperature_c: number | null
  material_notes: string[]
  // Fields that only some investigations have. Index signature lets us read
  // them without declaring all 40, while the named fields above stay checked.
  [extra: string]: unknown
}

/** One row from one NASA experimental table. */
export interface TestRecord {
  id: string
  psi_id: string
  acronym: string
  test_number: string | null
  row_index: number
  raw: Record<string, string | null>
  normalized: Normalized
  anomalies: string[]
  is_note: boolean
  is_flow_vis: boolean
  search_text: string
}

export interface Investigation {
  psi_id: string
  acronym: string
  title: string
  doi: string | null
  doi_url: string | null
  psi_url: string
  hardware: string
  fuel_state: string
  tier: string
  pillar: string
  summary: string
  row_count: number
  test_count: number
  materials: string[]
  o2_range: { min: number; max: number } | null
  embedded_notes: string[]
  anomaly_count: number
}

export interface MaterialCard {
  name: string
  fuel_state: string
  test_count: number
  investigations: string[]
  geometries: string[]
  o2_range: { min: number; max: number } | null
  flow_range: { min: number; max: number } | null
  pressure_range: { min: number; max: number } | null
  rt_r0_range: { min: number; max: number } | null
  outcomes: Record<string, number>
  has_1g_reference: boolean
  tested_at_moonbase_o2: boolean
}

export interface Findings {
  max_solid_o2_percent: number
  moonbase: { o2_percent: number; pressure_psi: number; pressure_kpa: number; note: string }
  gravity: {
    tested: string[]
    untested_zone: { min: number; max: number }
    moon_g: number
    mars_g: number
    note: string
  }
  surprises: { id: string; title: string; text: string; evidence: Record<string, unknown> }[]
  gaps: string[]
  anomaly_summary: Record<string, number>
  anomaly_descriptions: Record<string, string>
}

/** The logistic regression fitted to FLEX droplet outcomes at build time.
 *  The website evaluates it in the browser; it never calls a server. */
export interface FlexModel {
  available: boolean
  target: string
  features: string[]
  bias: number
  weights: number[]
  feature_means: number[]
  feature_stds: number[]
  feature_ranges: Record<string, { min: number; max: number }>
  n_training_rows: number
  cv_accuracy: number
  cv_folds: number[]
  base_rate: number
  disclaimer: string
  source: { psi_id: string; doi: string }
}

export type TabId = 'match' | 'lab' | 'library' | 'about'
