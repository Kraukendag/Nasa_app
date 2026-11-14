// =============================================================================
//  FLAMMABILITY MAP  (solid materials)
// =============================================================================
//  Every BASS-II and SAFFIRE test of the chosen material, placed by its oxygen
//  (up) and the airflows it was run at (across). A BASS-II test that stepped
//  its airflow is drawn as a line from its lowest to its highest recorded
//  reading; the marker shows how it ended:
//
//    blue  ▼  at the LOW end  -> went out as the airflow was turned down / off
//    orange ▲ at the HIGH end -> blew off as the airflow was turned up
//    aqua  ●                  -> kept burning across its whole range
//    grey  ○                  -> never established a flame / ending not stated
//
//  Nothing here is fitted or interpolated: there is no boundary line, only the
//  recorded tests. Where flames went out at low flow and where they blew off
//  at high flow is visible in the points themselves.
// =============================================================================

import { useMemo, useState } from 'react'
import type { TestRecord } from '../types'

const C = { low: '#3987e5', blow: '#d95926', burn: '#199e70', none: '#7D8DA6' }

type Kind = 'low' | 'blow' | 'burn' | 'none'

function kindOf(cls: string | null): Kind {
  if (!cls) return 'none'
  if (['extinguished_low_flow', 'extinguished_flow_stopped', 'self_extinguished', 'extinguished'].includes(cls)) return 'low'
  if (cls === 'blowoff') return 'blow'
  if (['burned_entire', 'burned_sustained', 'partial_burn'].includes(cls)) return 'burn'
  return 'none'
}

const LABEL: Record<Kind, string> = {
  low: 'Went out (airflow down or off)',
  blow: 'Blew off (airflow up)',
  burn: 'Kept burning',
  none: 'No sustained flame / not stated',
}

export default function FlammabilityMap({ tests, highlight, selectedO2, selectedFlow }: {
  tests: TestRecord[]
  highlight: Set<string>
  selectedO2: number | null
  selectedFlow: number | null
}) {
  const [hover, setHover] = useState<TestRecord | null>(null)

  const pts = useMemo(() => tests.filter((t) => t.normalized.o2_percent != null
    && (t.normalized.flow_min_cm_s != null || t.normalized.flow_cm_s != null)
    && !t.anomalies.includes('implausible_o2_reading')), [tests])

  if (pts.length < 3) return null

  const W = 300, H = 190, L = 34, R = 10, T = 10, B = 28
  const lo = (t: TestRecord) => t.normalized.flow_min_cm_s ?? t.normalized.flow_cm_s ?? 0
  const hi = (t: TestRecord) => t.normalized.flow_max_cm_s ?? t.normalized.flow_cm_s ?? 0
  const xMax = Math.max(10, ...pts.map(hi)) * 1.05
  const o2s = pts.map((t) => t.normalized.o2_percent as number)
  const yMin = Math.floor(Math.min(...o2s) - 0.5), yMax = Math.ceil(Math.max(...o2s) + 0.5)
  const x = (v: number) => L + (v / xMax) * (W - L - R)
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B)
  const xTicks = [0, 10, 20, 30, 40, 50].filter((v) => v <= xMax)
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin); v <= yMax; v += yMax - yMin > 6 ? 2 : 1) yTicks.push(v)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label="Oxygen versus airflow for each recorded test, marked by how it ended">
        {/* Recessive grid */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#1E2D44" strokeWidth={1} />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#7D8DA6">{v}%</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={`x${v}`} x={x(v)} y={H - B + 12} textAnchor="middle" fontSize={8} fill="#7D8DA6">{v}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize={8} fill="#7D8DA6">airflow, cm/s (recorded readings)</text>

        {/* The user's current choice, as a crosshair */}
        {selectedO2 != null && <line x1={L} x2={W - R} y1={y(selectedO2)} y2={y(selectedO2)} stroke="#FBB03B" strokeDasharray="3 3" strokeWidth={1} opacity={0.7} />}
        {selectedFlow != null && <line x1={x(selectedFlow)} x2={x(selectedFlow)} y1={T} y2={H - B} stroke="#FBB03B" strokeDasharray="3 3" strokeWidth={1} opacity={0.7} />}

        {pts.map((t) => {
          const k = kindOf(t.normalized.outcome_class)
          const yy = y(t.normalized.o2_percent as number)
          const x0 = x(lo(t)), x1 = x(hi(t))
          const on = highlight.has(t.id)
          const mx = k === 'blow' ? x1 : x0
          return (
            <g key={t.id} onMouseEnter={() => setHover(t)} onMouseLeave={() => setHover(null)}
               style={{ cursor: 'default' }} opacity={highlight.size && !on ? 0.35 : 1}>
              {x1 > x0 && <line x1={x0} x2={x1} y1={yy} y2={yy} stroke={k === 'burn' ? C.burn : '#3A4A63'} strokeWidth={on ? 2 : 1.2} />}
              {/* Hit target larger than the mark */}
              <circle cx={mx} cy={yy} r={7} fill="transparent" />
              {k === 'low' && <path d={`M${mx - 4},${yy - 3} L${mx + 4},${yy - 3} L${mx},${yy + 4} Z`} fill={C.low} stroke="#0B1120" strokeWidth={1} />}
              {k === 'blow' && <path d={`M${mx - 4},${yy + 3} L${mx + 4},${yy + 3} L${mx},${yy - 4} Z`} fill={C.blow} stroke="#0B1120" strokeWidth={1} />}
              {k === 'burn' && <circle cx={mx} cy={yy} r={3.6} fill={C.burn} stroke="#0B1120" strokeWidth={1} />}
              {k === 'none' && <circle cx={mx} cy={yy} r={3.2} fill="#0B1120" stroke={C.none} strokeWidth={1.3} />}
            </g>
          )
        })}
      </svg>

      {/* Legend: shape AND colour, so identity never rests on colour alone */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[9.5px] text-mute">
        {(['low', 'blow', 'burn', 'none'] as Kind[]).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              {k === 'low' && <path d="M1,2 L9,2 L5,9 Z" fill={C.low} />}
              {k === 'blow' && <path d="M1,8 L9,8 L5,1 Z" fill={C.blow} />}
              {k === 'burn' && <circle cx="5" cy="5" r="3.6" fill={C.burn} />}
              {k === 'none' && <circle cx="5" cy="5" r="3.2" fill="none" stroke={C.none} strokeWidth="1.3" />}
            </svg>
            <span>{LABEL[k]}</span>
          </div>
        ))}
      </div>

      {hover && (
        <div className="absolute top-1 right-1 max-w-[190px] panel px-2 py-1.5 text-[10px] pointer-events-none anim-fade-in">
          <div className="font-mono text-cryo">{hover.psi_id} · {hover.test_number}</div>
          <div className="text-slate-300 mt-0.5">O₂ {hover.normalized.o2_percent}% · {lo(hover)}{hi(hover) > lo(hover) ? `–${hi(hover)}` : ''} cm/s</div>
          <div className="text-slate-200 mt-0.5">{hover.normalized.outcome ?? 'Ending not stated'}</div>
        </div>
      )}
    </div>
  )
}
