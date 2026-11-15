// =============================================================================
//  0 g vs 1 g BOUNDING ENVELOPE (Lunar habitat page)
// =============================================================================
//  Where the PSI tests sit, by oxygen and pressure, against the planned lunar
//  habitat (about 30% O2, 70.3 kPa, 0.16 g). PSI tests only: every dot is one
//  recorded row. Nothing is fitted or filled in.
//
//  - The plot shows every microgravity test that records BOTH oxygen and
//    pressure (gas and droplet tables; no solid table records pressure).
//  - The dashed box is the bounding envelope of those tests: their lowest and
//    highest recorded oxygen and pressure.
//  - Solid-fuel tables record oxygen only, so they appear as ranges in a lane
//    under the plot, split into microgravity and 1 g reference burns.
//  - 0.16 g has no PSI test at all; the target is marked, not filled in.
// =============================================================================

import { useMemo } from 'react'
import type { Dataset } from '../data'
import type { TestRecord } from '../types'

const COLOR: Record<string, string> = { gas: '#2a78d6', liquid: '#1baf7a', solid: '#eb6834' }
const STATE_WORD: Record<string, string> = { gas: 'gas', liquid: 'liquid droplet', solid: 'solid' }

export default function HabitatEnvelope({ data }: { data: Dataset }) {
  const mb = data.findings.moonbase
  const s = useMemo(() => {
    const real = data.tests.filter((t) => !t.is_note && !t.is_flow_vis && t.normalized.o2_percent != null
      && !t.anomalies.includes('implausible_o2_reading'))
    const zeroG = real.filter((t) => t.normalized.gravity === '0g')
    const withP = zeroG.filter((t) => typeof t.normalized.pressure_kpa === 'number')
    const o2Only = zeroG.filter((t) => typeof t.normalized.pressure_kpa !== 'number')
    // 1 g: the same samples burned on the ground for comparison (SAFFIRE-II).
    const oneG = real.filter((t) => t.normalized.has_1g_reference && t.normalized.outcome_1g_class)
    const o2 = (t: TestRecord) => t.normalized.o2_percent as number
    const kpa = (t: TestRecord) => t.normalized.pressure_kpa as number
    const range = (v: number[]) => (v.length ? { min: Math.min(...v), max: Math.max(...v) } : null)
    // Closest recorded test to the habitat target, scaled so 1 point of O2
    // counts the same as 10 kPa (a stated choice, shown in the caption).
    const nearest = withP.reduce<TestRecord | null>((b, t) => {
      const d = (u: TestRecord) => Math.hypot(o2(u) - mb.o2_percent, (kpa(u) - mb.pressure_kpa) / 10)
      return !b || d(t) < d(b) ? t : b
    }, null)
    const near = withP.filter((t) => Math.abs(o2(t) - mb.o2_percent) <= 2 && Math.abs(kpa(t) - mb.pressure_kpa) <= 10)
    const lanes = ['solid', 'gas', 'liquid'].map((st) => {
      const rows = o2Only.filter((t) => t.normalized.fuel_state === st)
      return { st, rows, r: range(rows.map(o2)), psi: [...new Set(rows.map((t) => t.psi_id))] }
    }).filter((l) => l.r)
    return {
      withP, lanes, oneG, nearest, near,
      env: { o2: range(withP.map(o2))!, kpa: range(withP.map(kpa))! },
      oneGRange: range(oneG.map(o2)), psiWithP: [...new Set(withP.map((t) => t.psi_id))],
      oneGPsi: [...new Set(oneG.map((t) => t.psi_id))],
    }
  }, [data.tests, mb])

  // ---- Scales: oxygen linear, pressure logarithmic (50 to 500 kPa) --------
  const W = 680, L = 52, R = 18, T = 18, PH = 300, LANE = 34
  const laneTop = T + PH + 70
  const H = laneTop + (s.lanes.length + 1) * LANE + 26
  const xMin = 10, xMax = 42
  const yMin = Math.log10(40), yMax = Math.log10(600)
  const x = (v: number) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R)
  const y = (kpa: number) => T + (1 - (Math.log10(kpa) - yMin) / (yMax - yMin)) * PH
  const xt = [10, 15, 20, 25, 30, 35, 40]
  const yt = [50, 70, 100, 200, 300, 500]
  const span = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}%` : `${r.min}–${r.max}%`)
  const name = (psi: string) => data.investigations.find((i) => i.psi_id === psi)?.acronym ?? psi

  return (
    <div>
      {/* Phones: keep the text readable and scroll sideways, like the wide tables. */}
      <div className="overflow-x-auto"><svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px] h-auto" role="img"
           aria-label={`PSI tests by oxygen and pressure, with the lunar habitat target at ${mb.o2_percent}% oxygen and ${mb.pressure_kpa} kPa`}>
        {/* grid and axes */}
        {xt.map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={T} y2={T + PH} stroke="#E3E1DA" />
          <text x={x(v)} y={T + PH + 16} textAnchor="middle" fontSize={11} fill="#646B78">{v}%</text></g>)}
        {yt.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E3E1DA" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#646B78">{v}</text></g>)}
        <text x={(L + W - R) / 2} y={T + PH + 34} textAnchor="middle" fontSize={11.5} fill="#3D424C">Oxygen (% by volume, as recorded)</text>
        <text x={14} y={T + PH / 2} textAnchor="middle" fontSize={11.5} fill="#3D424C" transform={`rotate(-90 14 ${T + PH / 2})`}>Pressure (kPa, log scale)</text>

        {/* microgravity bounding envelope */}
        <rect x={x(s.env.o2.min)} y={y(s.env.kpa.max)} width={x(s.env.o2.max) - x(s.env.o2.min)} height={y(s.env.kpa.min) - y(s.env.kpa.max)}
              fill="#2a78d6" fillOpacity={0.05} stroke="#2a78d6" strokeDasharray="5 4" strokeWidth={1.2} />
        <text x={x(s.env.o2.min) + 6} y={y(s.env.kpa.max) + 14} fontSize={11} fill="#2a78d6">Microgravity envelope (PSI)</text>

        {/* one dot per recorded test */}
        {s.withP.map((t) => (
          <circle key={t.id} cx={x(t.normalized.o2_percent as number)} cy={y(t.normalized.pressure_kpa as number)} r={2.6}
                  fill={COLOR[t.normalized.fuel_state ?? ''] ?? '#8a8f99'} fillOpacity={0.6}>
            <title>{`${t.psi_id} test ${t.test_number}: ${t.normalized.o2_percent}% O₂, ${t.normalized.pressure_kpa} kPa (${STATE_WORD[t.normalized.fuel_state ?? ''] ?? ''}, microgravity)`}</title>
          </circle>
        ))}

        {/* habitat target */}
        <line x1={x(mb.o2_percent)} x2={x(mb.o2_percent)} y1={T} y2={laneTop + s.lanes.length * LANE + LANE} stroke="#B5400F" strokeDasharray="2 3" />
        <line x1={L} x2={W - R} y1={y(mb.pressure_kpa)} y2={y(mb.pressure_kpa)} stroke="#B5400F" strokeDasharray="2 3" />
        <circle cx={x(mb.o2_percent)} cy={y(mb.pressure_kpa)} r={7} fill="none" stroke="#B5400F" strokeWidth={2} />
        <text x={x(mb.o2_percent) + 11} y={y(mb.pressure_kpa) + 18} fontSize={11.5} fill="#B5400F" fontWeight={600}>
          Lunar habitat: {mb.o2_percent}%, {mb.pressure_kpa} kPa
        </text>
        <text x={x(mb.o2_percent) + 11} y={y(mb.pressure_kpa) + 32} fontSize={11} fill="#B5400F">at 0.16 g: no PSI test</text>

        {/* oxygen-only lanes: tables that record no pressure */}
        <text x={L} y={laneTop - 10} fontSize={11.5} fill="#3D424C" fontWeight={600}>Pressure not recorded (oxygen only)</text>
        {s.lanes.map((l, i) => {
          const yy = laneTop + i * LANE + LANE / 2
          return (
            <g key={l.st}>
              <rect x={x(l.r!.min) - 2} y={yy + 2} width={Math.max(4, x(l.r!.max) - x(l.r!.min) + 4)} height={9} rx={3} fill={COLOR[l.st]} fillOpacity={0.75} />
              <text x={x(l.r!.min) - 2} y={yy - 3} fontSize={11} fill="#3D424C">
                {STATE_WORD[l.st]}, microgravity: {span(l.r!)} ({l.rows.length} test{l.rows.length === 1 ? '' : 's'}, {l.psi.map(name).join(', ')})
              </text>
            </g>
          )
        })}
        {s.oneGRange && (() => {
          const yy = laneTop + s.lanes.length * LANE + LANE / 2
          return (
            <g>
              <rect x={x(s.oneGRange.min) - 2} y={yy + 2} width={Math.max(4, x(s.oneGRange.max) - x(s.oneGRange.min) + 4)} height={9} rx={3}
                    fill="none" stroke="#eb6834" strokeWidth={1.6} />
              <text x={x(s.oneGRange.min) - 2} y={yy - 3} fontSize={11} fill="#3D424C">
                solid, 1 g reference burns: {span(s.oneGRange)} ({s.oneG.length} samples, {s.oneGPsi.map(name).join(', ')})
              </text>
            </g>
          )
        })()}
      </svg></div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 pt-2 caption">
        {['gas', 'liquid', 'solid'].map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR[st] }} />{STATE_WORD[st]}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm border-[1.6px]" style={{ borderColor: '#eb6834' }} />1 g reference</span>
      </div>

      <dl className="grid sm:grid-cols-3 gap-4 mt-5">
        <div className="card p-4">
          <dt className="caption">Microgravity (PSI)</dt>
          <dd className="small text-ink2 mt-1"><b className="text-ink num">{s.withP.length}</b> tests with oxygen and pressure
            ({s.psiWithP.map(name).join(', ')}): {s.env.o2.min}–{s.env.o2.max}% O₂, {s.env.kpa.min}–{s.env.kpa.max} kPa.</dd>
        </div>
        <div className="card p-4">
          <dt className="caption">1 g (PSI)</dt>
          <dd className="small text-ink2 mt-1"><b className="text-ink num">{s.oneG.length}</b> reference burns ({s.oneGPsi.map(name).join(', ')}),
            {s.oneGRange ? ` ${s.oneGRange.min}–${s.oneGRange.max}% O₂,` : ''} pressure not recorded. No 1 g test sits near the habitat point.</dd>
        </div>
        <div className="card p-4">
          <dt className="caption">0.16 g (PSI)</dt>
          <dd className="small text-ink2 mt-1"><b className="text-ink num">0</b> tests. Every PSI flight test ran in microgravity; the lunar
            gravity column is empty.</dd>
        </div>
      </dl>
      {s.nearest && (
        <p className="small text-ink2 mt-4">
          <b className="text-ink">Closest recorded test to the habitat point:</b> {s.nearest.psi_id} test {s.nearest.test_number},{' '}
          {s.nearest.normalized.material} ({STATE_WORD[s.nearest.normalized.fuel_state ?? '']}), {s.nearest.normalized.o2_percent}% O₂ at{' '}
          {s.nearest.normalized.pressure_kpa} kPa, in microgravity. {s.near.length} test{s.near.length === 1 ? '' : 's'} lie within ±2 points
          of oxygen and ±10 kPa of it{s.near.length ? `, all ${[...new Set(s.near.map((t) => STATE_WORD[t.normalized.fuel_state ?? '']))].join(' or ')} fuels` : ''}.
          No solid-fuel test is in that window.
        </p>
      )}
    </div>
  )
}
