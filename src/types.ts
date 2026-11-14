// =============================================================================
//  TYPES
// =============================================================================
//  The shape of the JSON that scripts/build_data.py writes. If a component
//  reads a field that does not exist here, TypeScript refuses to build --
//  which is how we stop "undefined" from ever reaching the screen.
// =============================================================================

export type Range = { min: number; max: number } | null

/** Everything measured or derived for one test. null = not recorded, never 0. */
export interface Normalized {
  material: string | null
  material_raw: string | null
  substance: string | null
  fuel_fraction: number | null
  geometry: string | null
  thickness_mm: number | null
  width_mm: number | null
  diameter_mm: number | null
  fuel: string | null
  fuel_state: string | null
  o2_percent: number | null
  /** What NASA actually wrote when it is a list or a range ("21; 26.5; 40"). */
  o2_display: string | null
  o2_mole_fraction: number | null
  n2_mole_fraction: number | null
  co2_mole_fraction: number | null
  he_mole_fraction: number | null
  pressure_atm: number | null
  pressure_kpa: number | null
  pressure_mmhg: number | null
  /** First recorded airflow. BASS-II tests often stepped the flow; see below. */
  flow_cm_s: number | null
  flow_min_cm_s: number | null
  flow_max_cm_s: number | null
  /** Every anemometer reading in the order the crew set it (BASS-II). */
  flow_sequence_cm_s: number[]
  flow_raw: string | null
  flow_direction: string | null
  gravity: string | null
  droplet_d0_mm: number | null
  extinction_d_mm: number | null
  burn_rate: number | null
  burn_time_s: number | null
  spread_rate_mm_s: number | null
  /** Plain-language ending, e.g. "Blew off at high airflow". */
  outcome: string | null
  /** Machine category behind `outcome`, used for counting and colour. */
  outcome_class: string | null
  /** NASA's own words for how the test ended, where they exist. */
  outcome_text: string | null
  /** Where those words come from (table or report page). */
  outcome_source: string | null
  rt_r0: number | null
  temperature_c: number | null
  material_notes: string[]
  [extra: string]: unknown
}

export interface TestRecord {
  id: string
  psi_id: string
  acronym: string
  test_number: string | null
  row_index: number
  raw: Record<string, string | null>
  normalized: Normalized
  /** Data-quality problems: typos, failed sensors, inconsistent units. */
  anomalies: string[]
  /** Scientific markers, e.g. cool-flame territory. Never shown as errors. */
  science_flags: string[]
  is_note: boolean
  is_flow_vis: boolean
  duplicate_of?: string
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
  platform: string
  fuel_state: string
  pillar: string
  summary: string
  objectives: string | null
  sensors_evidenced: string[]
  sensors_basis: string
  row_count: number
  test_count: number
  materials: string[]
  substances: string[]
  variables_recorded: string[]
  o2_range: Range
  pressure_kpa_range: Range
  outcome_fraction: number
  has_1g_reference: boolean
  max_sample_length_cm: number | null
  scale_class: 'large' | 'glovebox' | 'chamber' | 'cabin'
  embedded_notes: string[]
  anomaly_count: number
}

export interface GravityComparison {
  test: string
  psi_id: string
  outcome_0g: string | null
  outcome_1g: string | null
  burn_length_0g: string | null
  burn_length_1g: string | null
}

export interface MaterialCard {
  id: string
  name: string
  substance: string
  fuel_state: string
  test_count: number
  investigations: string[]
  geometries: string[]
  dimensions: { diameter_mm: number[]; thickness_mm: number[] }
  o2_range: Range
  flow_range: Range
  pressure_range: Range
  pressure_kpa_range: Range
  rt_r0_range: Range
  burn_time_range: Range
  outcome_classes: Record<string, number>
  outcomes: Record<string, number>
  has_1g_reference: boolean
  gravity_comparisons: GravityComparison[]
  tested_at_moonbase_o2: boolean
  tested_at_reduced_pressure: boolean
  mission_context: Record<string, { status: string; note: string }>
  confidence: { level: string; reason: string }
  anomaly_count: number
  summary: string
  lowest_sustained_o2?: { o2: number; test: string } | null
  failed_attempts?: { o2: number; test: string }[]
  literature?: { points: LiteraturePoint[]; saffire: SaffireRow[] } | null
  caveat?: string
}

export interface KeyInsight {
  id: string
  headline: string
  detail: string
  psi_id: string | null
  doi: string | null
  /** Literature keys (see Literature.sources) this finding also cites. */
  lit: string[]
  source: string
}

export interface ResearchQuestion {
  id: string
  theme: string
  question: string
  why: string
  known: string
  gap: string
  answer_by: string
  measure: string
  refs: string[]
  priority: 'high' | 'medium'
}

export interface LiteratureSource { title: string; authors: string; venue: string; ntrs: string; url: string }
export interface LiteraturePoint { source: string; g: number; material: string; quantity: string; value: number; unit: string; compare_1g: number; where: string }
export interface SaffireRow { sample: string; material: string; length_cm: number; flow_cm_s: number; direction: string; pressure_kpa: number; o2_percent: number }
export interface Literature {
  sources: Record<string, LiteratureSource>
  points: LiteraturePoint[]
  luci_notes: string[]
  saffire_iv_vi: SaffireRow[]
  statements: { source: string; text: string; where: string; g?: number[] }[]
  note: string
}

export interface NegativeEntry {
  category: string
  title: string
  detail: string
  psi_id: string
  tests: (string | null)[]
  doi: string | null
  source: string | null
}

export interface Coverage {
  o2_bins: string[]
  gravity: string[]
  grid: Record<string, {
    cells: Record<string, Record<string, number>>
    o2_not_recorded_0g: number
    one_g_references: number
  }>
  pressure_note: string
}

export interface Findings {
  max_solid_o2_percent: number
  moonbase: { o2_percent: number; pressure_psi: number; pressure_kpa: number; pressure_atm: number; note: string }
  gravity: { tested: string[]; untested_zone: { min: number; max: number }; moon_g: number; mars_g: number; note: string }
  key_insights: KeyInsight[]
  surprises: { id: string; title: string; text: string; evidence_class: string; evidence: Record<string, unknown> }[]
  gaps: string[]
  negative_knowledge: NegativeEntry[]
  coverage: Coverage
  research_questions: ResearchQuestion[]
  spot_check: { checked: string[]; result: string; pages: number[] }
  cross_check: { checked: number; agree: number; rule: string; disagree: { test: string; cell: string; category: string; report: string }[] }
  not_included: { name: string; psi_id: string | null; doi: string | null }[]
  anomaly_summary: Record<string, number>
  science_flag_summary: Record<string, number>
  anomaly_descriptions: Record<string, string>
  science_flag_descriptions: Record<string, string>
  outcome_labels: Record<string, string>
  transcription_note: string
}

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
  n_condition_groups: number
  metrics: {
    accuracy: number
    balanced_accuracy: number
    auc: number
    baseline_accuracy: number
    fold_accuracy: number[]
    validation: string
  }
  base_rate: number
  support: { points: number[][]; nn_threshold: number; note: string }
  disclaimer: string
  source: { psi_id: string; doi: string }
}

export type PageId = 'home' | 'lab' | 'data' | 'findings' | 'ranking' | 'questions' | 'pipeline' | 'about'
