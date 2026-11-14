// =============================================================================
//  LAB CONTROLS: RECORDED VALUES ONLY
// =============================================================================
//  Every control in the Experiment Lab offers ONLY values that NASA recorded.
//  You cannot dial in 19.5% oxygen if nobody tested 19.5% oxygen.
//
//  HOW THE CASCADE WORKS
//  ---------------------
//  Each control's options are computed from the tests that match ALL THE OTHER
//  controls' current choices. Pick 21% oxygen, and the airflow control shows
//  only the airflows that were run at 21%. Because every option comes from the
//  current matching set, whatever combination you end up with is guaranteed to
//  match at least one real test. Nothing is interpolated; nothing is guessed.
//
//  Two quantities are GROUPED, because NASA recorded them to a precision no
//  one could pick from: FLEX pressures (hundreds of distinct mmHg readings) and
//  droplet diameters. Each group's label shows the real range inside it.
// =============================================================================

import type { TestRecord } from '../types'

export type State = 'solid' | 'liquid' | 'gas'

export interface Dimension {
  key: string
  label: string
  states: State[]
  /** Group keys a test offers for this control. An array because a BASS-II
   *  test stepped through several airflows and offers each of them. */
  keys: (t: TestRecord) => string[]
  /** The raw value behind a key, so a group can show its true range. */
  raw?: (t: TestRecord, key: string) => number | null
  format: (key: string) => string
  unit?: string
  numeric: boolean
  /** Shown when no test of this material records the quantity at all. */
  missingNote: string
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const fixed = (v: number, d: number) => v.toFixed(d)

export const DIMENSIONS: Dimension[] = [
  {
    key: 'geometry', label: 'Sample shape', states: ['solid'], numeric: false,
    keys: (t) => (t.normalized.geometry ? [t.normalized.geometry] : []),
    format: (k) => k.charAt(0).toUpperCase() + k.slice(1),
    missingNote: 'No shape is recorded for these samples.',
  },
  {
    key: 'o2', label: 'Oxygen', unit: '%', states: ['solid', 'liquid', 'gas'], numeric: true,
    keys: (t) => {
      const n = t.normalized
      const levels = (n.o2_levels_tested as number[] | undefined) ?? []
      if (num(n.o2_percent)) return [fixed(n.o2_percent, 1)]
      return levels.filter(num).map((v) => fixed(v, 1))
    },
    format: (k) => `${Number(k)}%`,
    missingNote: 'This table does not record oxygen.',
  },
  {
    key: 'flow', label: 'Airflow', unit: 'cm/s', states: ['solid'], numeric: true,
    keys: (t) => {
      const n = t.normalized
      const seq = n.flow_sequence_cm_s?.length ? n.flow_sequence_cm_s : num(n.flow_cm_s) ? [n.flow_cm_s] : []
      return [...new Set(seq.map((v) => fixed(v, 2)))]
    },
    format: (k) => `${Number(k)} cm/s`,
    missingNote: 'This table does not record airflow.',
  },
  {
    key: 'direction', label: 'Flow direction', states: ['solid'], numeric: false,
    keys: (t) => (t.normalized.flow_direction ? [t.normalized.flow_direction] : []),
    format: (k) => k.charAt(0).toUpperCase() + k.slice(1),
    missingNote: 'Flow direction is not recorded for these tests.',
  },
  {
    key: 'pressure', label: 'Pressure', unit: 'atm', states: ['liquid', 'gas'], numeric: true,
    // Grouped to the nearest 0.05 atm; each group label shows its real range.
    keys: (t) => (num(t.normalized.pressure_atm) && t.normalized.pressure_atm > 0
      ? [fixed(Math.round(t.normalized.pressure_atm / 0.05) * 0.05, 2)] : []),
    raw: (t) => (num(t.normalized.pressure_atm) ? t.normalized.pressure_atm : null),
    format: (k) => `≈${Number(k).toFixed(2)} atm`,
    missingNote: 'This table does not record pressure.',
  },
  {
    key: 'd0', label: 'Droplet diameter', unit: 'mm', states: ['liquid'], numeric: true,
    keys: (t) => (num(t.normalized.droplet_d0_mm) ? [fixed(Math.round(t.normalized.droplet_d0_mm / 0.5) * 0.5, 1)] : []),
    raw: (t) => (num(t.normalized.droplet_d0_mm) ? t.normalized.droplet_d0_mm : null),
    format: (k) => `≈${Number(k).toFixed(1)} mm`,
    missingNote: 'This table does not record droplet diameter.',
  },
  {
    key: 'co2', label: 'CO₂ (suppressant)', unit: '%', states: ['liquid'], numeric: true,
    keys: (t) => (num(t.normalized.co2_mole_fraction) ? [fixed(t.normalized.co2_mole_fraction * 100, 0)] : []),
    format: (k) => `${k}%`,
    missingNote: 'This table does not record CO₂.',
  },
  {
    key: 'he', label: 'Helium (suppressant)', unit: '%', states: ['liquid'], numeric: true,
    keys: (t) => (num(t.normalized.he_mole_fraction) ? [fixed(t.normalized.he_mole_fraction * 100, 0)] : []),
    format: (k) => `${k}%`,
    missingNote: 'This table does not record helium.',
  },
  {
    key: 'fiber', label: 'Droplet support', states: ['liquid'], numeric: false,
    keys: (t) => {
      const f = t.normalized.fiber_supported
      return f === true ? ['fibre'] : f === false ? ['free-floated'] : []
    },
    format: (k) => (k === 'fibre' ? 'On a fibre' : 'Free-floated'),
    missingNote: 'Droplet support is not recorded for these tests.',
  },
]

export type Selection = Record<string, string | null>

function matches(t: TestRecord, sel: Selection, except?: string) {
  for (const d of DIMENSIONS) {
    if (d.key === except) continue
    const want = sel[d.key]
    if (want == null) continue
    if (!d.keys(t).includes(want)) return false
  }
  return true
}

/** Tests matching every current choice. */
export function applySelection(rows: TestRecord[], sel: Selection) {
  return rows.filter((t) => matches(t, sel))
}

export interface Option { key: string; label: string; count: number; detail?: string }

/** Options for one control, given every OTHER control's current choice. */
export function optionsFor(dim: Dimension, rows: TestRecord[], sel: Selection): Option[] {
  const subset = rows.filter((t) => matches(t, sel, dim.key))
  const tally = new Map<string, { count: number; lo: number; hi: number }>()
  for (const t of subset) {
    for (const k of dim.keys(t)) {
      const e = tally.get(k) ?? { count: 0, lo: Infinity, hi: -Infinity }
      e.count++
      const r = dim.raw?.(t, k)
      if (r != null) { e.lo = Math.min(e.lo, r); e.hi = Math.max(e.hi, r) }
      tally.set(k, e)
    }
  }
  const out = [...tally.entries()].map(([key, e]) => ({
    key,
    label: dim.format(key),
    count: e.count,
    detail: dim.raw && Number.isFinite(e.lo) && e.hi > e.lo
      ? `recorded ${e.lo.toFixed(2)}–${e.hi.toFixed(2)}` : undefined,
  }))
  return dim.numeric ? out.sort((a, b) => Number(a.key) - Number(b.key)) : out.sort((a, b) => b.count - a.count)
}

/** Whether ANY test of this material records the quantity at all. */
export function recorded(dim: Dimension, rows: TestRecord[]) {
  return rows.some((t) => dim.keys(t).length > 0)
}
