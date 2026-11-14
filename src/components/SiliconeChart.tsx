// =============================================================================
//  SILICONE: 0 g vs 1 g BURN LENGTH  (home page figure)
// =============================================================================
//  The four SAFFIRE-II silicone samples, each burned in microgravity and in a
//  normal-gravity reference. Grouped bars, one axis (cm), two series: blue =
//  microgravity, orange = 1 g. "Complete" in NASA's table means the whole 29 cm
//  sample burned, so it is drawn at the recorded sample length and labelled.
//  Hover a bar for NASA's exact table entry.
// =============================================================================

import { useState } from 'react'
import type { Dataset } from '../data'

const C0 = '#2a78d6'   // microgravity
const C1 = '#eb6834'   // 1 g

export default function SiliconeChart({ data }: { data: Dataset }) {
  const rows = data.tests.filter((t) => t.psi_id === 'PSI-99' && t.normalized.material === 'Silicone')
  const [hover, setHover] = useState<string | null>(null)
  if (!rows.length) return null
  const maxL = Math.max(...rows.map((t) => (t.normalized.sample_length_cm as number) ?? 29))
  const W = 520, H = 230, L = 40, R = 10, T = 14, B = 46
  const y = (v: number) => T + (1 - v / maxL) * (H - T - B)
  const group = (W - L - R) / rows.length
  const bw = Math.min(26, group / 3.2)
  const ticks = [0, 10, 20, 29].filter((v) => v <= maxL)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label="Burn length of four SAFFIRE-II silicone samples: about 0 cm in microgravity for all four; at 1 g, two burned completely, one 7.6 cm, one about 0 cm.">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E3E1DA" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#646B78">{v}</text>
          </g>
        ))}
        <text x={12} y={T + (H - T - B) / 2} fontSize={12} fill="#646B78" transform={`rotate(-90 12 ${T + (H - T - B) / 2})`} textAnchor="middle">burn length, cm</text>
        {rows.map((t, i) => {
          const n = t.normalized
          const cx = L + group * (i + 0.5)
          const bars = [
            { key: `${t.id}-0`, v: (n.burn_length_0g_cm as number) ?? 0, raw: n.burn_length_0g_raw as string, c: C0, x: cx - bw - 1, g: 'microgravity' },
            { key: `${t.id}-1`, v: (n.burn_length_1g_cm as number) ?? 0, raw: n.burn_length_1g_raw as string, c: C1, x: cx + 1, g: '1 g' },
          ]
          return (
            <g key={t.id}>
              {bars.map((b) => {
                const top = y(Math.max(b.v, 0.25))     // a sliver keeps "~0" visible
                return (
                  <g key={b.key} onMouseEnter={() => setHover(`${t.test_number} · ${b.g}: “${b.raw}” (NASA table)`)} onMouseLeave={() => setHover(null)}>
                    <rect x={b.x - 3} y={T} width={bw + 6} height={H - T - B} fill="transparent" />
                    <path d={`M${b.x},${y(0)} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z`} fill={b.c} />
                    <text x={b.x + bw / 2} y={top - 5} textAnchor="middle" fontSize={11.5} fill="#3D424C">
                      {b.raw === 'Complete' ? 'all' : b.raw}
                    </text>
                  </g>
                )
              })}
              <text x={cx} y={H - B + 17} textAnchor="middle" fontSize={12} fill="#16181D">{t.test_number}</text>
              <text x={cx} y={H - B + 32} textAnchor="middle" fontSize={11} fill="#646B78">{n.thickness_mm} mm</text>
            </g>
          )
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#3D424C" />
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 caption mt-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C0 }} /> microgravity (Cygnus)</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: C1 }} /> 1 g reference</span>
        <span>“all” = complete burn of the 29 cm sample</span>
      </div>
      <p className="caption mt-1 min-h-[1.5em]" aria-live="polite">{hover ?? 'Hover a bar for NASA’s exact table entry.'}</p>
    </div>
  )
}
