// =============================================================================
//  FLAMMABILITY MAP  (solid materials)
// =============================================================================
//  Every recorded BASS-II and SAFFIRE test of the chosen material, by oxygen
//  (up) and airflow (across). A BASS-II test that stepped its airflow is a line
//  from its lowest to its highest recorded anemometer reading; the marker
//  shows how it ended:
//      ▼ blue    went out (airflow turned down or off, or self-extinguished)
//      ▲ orange  blew off as airflow was turned up
//      ● green   kept burning across its range, or burned the whole sample
//      ○ grey    never established a flame, or ending not stated
//  No boundary is fitted. The points are the evidence.
// =============================================================================

import { useMemo, useState } from 'react'
import type { TestRecord } from '../types'

// First three categorical slots of the validated palette (light mode): they
// pass the all-pairs colour-vision checks; shapes carry identity as well.
const C = { low: '#2a78d6', blow: '#eb6834', burn: '#1baf7a', none: '#8a8f99' }
type Kind = 'low' | 'blow' | 'burn' | 'none'

export function kindOf(cls: string | null): Kind {
  if (!cls) return 'none'
  if (['extinguished_low_flow', 'extinguished_flow_stopped', 'self_extinguished', 'extinguished'].includes(cls)) return 'low'
  if (cls === 'blowoff') return 'blow'
  if (['burned_entire', 'burned_sustained', 'partial_burn'].includes(cls)) return 'burn'
  return 'none'
}
const LABEL: Record<Kind, string> = {
  low: 'Went out (airflow down/off, or by itself)', blow: 'Blew off (airflow up)',
  burn: 'Kept burning / burned through', none: 'No sustained flame, or not stated',
}

function Marker({ k, x, y, size = 1 }: { k: Kind; x: number; y: number; size?: number }) {
  const s = 5 * size
  if (k === 'low') return <path d={`M${x - s},${y - s * 0.75} L${x + s},${y - s * 0.75} L${x},${y + s} Z`} fill={C.low} stroke="#fff" strokeWidth={1} />
  if (k === 'blow') return <path d={`M${x - s},${y + s * 0.75} L${x + s},${y + s * 0.75} L${x},${y - s} Z`} fill={C.blow} stroke="#fff" strokeWidth={1} />
  if (k === 'burn') return <circle cx={x} cy={y} r={s * 0.85} fill={C.burn} stroke="#fff" strokeWidth={1} />
  return <circle cx={x} cy={y} r={s * 0.75} fill="#fff" stroke={C.none} strokeWidth={1.5} />
}

export default function FlammabilityMap({ tests, highlight, selectedO2, selectedFlow }: {
  tests: TestRecord[]; highlight: Set<string>; selectedO2: number | null; selectedFlow: number | null
}) {
  const [hover, setHover] = useState<TestRecord | null>(null)
  const pts = useMemo(() => tests.filter((t) => t.normalized.o2_percent != null
    && (t.normalized.flow_min_cm_s != null || t.normalized.flow_cm_s != null)
    && !t.anomalies.includes('implausible_o2_reading')), [tests])
  if (pts.length < 2) return <div className="p-6 caption">Not enough tests with both oxygen and airflow recorded to draw a map for this material.</div>

  const W = 640, H = 340, L = 46, R = 16, T = 16, B = 40
  const lo = (t: TestRecord) => t.normalized.flow_min_cm_s ?? t.normalized.flow_cm_s ?? 0
  const hi = (t: TestRecord) => t.normalized.flow_max_cm_s ?? t.normalized.flow_cm_s ?? 0
  const xMax = Math.max(10, ...pts.map(hi)) * 1.06
  const o2 = pts.map((t) => t.normalized.o2_percent as number)
  const yMin = Math.floor(Math.min(...o2) - 0.6), yMax = Math.ceil(Math.max(...o2) + 0.6)
  const x = (v: number) => L + (v / xMax) * (W - L - R)
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B)
  const xt = [0, 5, 10, 20, 30, 40, 50].filter((v) => v <= xMax)
  const yt: number[] = []; for (let v = Math.ceil(yMin); v <= yMax; v += yMax - yMin > 7 ? 2 : 1) yt.push(v)

  return (
    <div className="relative px-3 pt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Oxygen versus airflow for each recorded test, marked by how it ended">
        {yt.map((v) => (<g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#ECEAE3" /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#646B78">{v}%</text></g>))}
        {xt.map((v) => (<g key={v}><line x1={x(v)} x2={x(v)} y1={T} y2={H - B} stroke="#F2F0EA" /><text x={x(v)} y={H - B + 18} textAnchor="middle" fontSize={12} fill="#646B78">{v}</text></g>))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={12.5} fill="#3D424C">Airflow, cm/s (recorded anemometer readings)</text>
        <text transform={`translate(13 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={12.5} fill="#3D424C">Initial oxygen</text>
        {selectedO2 != null && <line x1={L} x2={W - R} y1={y(selectedO2)} y2={y(selectedO2)} stroke="#B5400F" strokeDasharray="4 4" />}
        {selectedFlow != null && <line x1={x(selectedFlow)} x2={x(selectedFlow)} y1={T} y2={H - B} stroke="#B5400F" strokeDasharray="4 4" />}
        {pts.map((t) => {
          const k = kindOf(t.normalized.outcome_class)
          const yy = y(t.normalized.o2_percent as number), x0 = x(lo(t)), x1 = x(hi(t))
          const on = highlight.has(t.id)
          return (
            <g key={t.id} onMouseEnter={() => setHover(t)} onMouseLeave={() => setHover(null)} opacity={highlight.size && !on ? 0.3 : 1}>
              {x1 > x0 && <line x1={x0} x2={x1} y1={yy} y2={yy} stroke={k === 'burn' ? C.burn : '#B9BDC6'} strokeWidth={on ? 2.5 : 1.5} />}
              <circle cx={k === 'blow' ? x1 : x0} cy={yy} r={9} fill="transparent" />
              <Marker k={k} x={k === 'blow' ? x1 : x0} y={yy} size={on ? 1.25 : 1} />
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 pb-3 text-[13px] text-ink2">
        {(['low', 'blow', 'burn', 'none'] as Kind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden><Marker k={k} x={0} y={0} size={1} /></svg>{LABEL[k]}
          </span>
        ))}
      </div>
      {hover && (
        <div className="absolute top-4 right-5 max-w-[260px] card px-3 py-2 shadow-sm pointer-events-none text-[13px]">
          <div className="num text-ink">{hover.psi_id} {hover.acronym} · {hover.test_number}</div>
          <div className="text-ink2">O₂ {hover.normalized.o2_percent}% · {lo(hover)}{hi(hover) > lo(hover) ? `–${hi(hover)}` : ''} cm/s · {hover.normalized.flow_direction ?? 'direction not recorded'}</div>
          <div className="text-ink mt-0.5">{hover.normalized.outcome ?? 'Ending not stated'}</div>
        </div>
      )}
    </div>
  )
}
