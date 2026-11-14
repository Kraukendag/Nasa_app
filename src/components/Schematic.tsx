// =============================================================================
//  SCHEMATIC  (2D side view)
// =============================================================================
//  A labelled drawing of what was tested: the apparatus, the sample with its
//  RECORDED dimensions, the igniter at the top, and the airflow direction and
//  speed. Not to scale (a 0.1 mm film and a 94 cm sheet cannot share a
//  drawing), so every size is written on it instead.
// =============================================================================

import type { SampleShape } from './Specimen'

const APPARATUS: Record<string, string> = {
  'PSI-25': 'BASS-II: flow duct in the Microgravity Science Glovebox, ISS',
  'PSI-26': 'BASS: flow duct in the Microgravity Science Glovebox, ISS',
  'PSI-98': 'SAFFIRE-I: flow unit aboard an uncrewed Cygnus',
  'PSI-99': 'SAFFIRE-II: flow unit aboard an uncrewed Cygnus',
  'PSI-100': 'SAFFIRE-III: flow unit aboard an uncrewed Cygnus',
  'PSI-69': 'FLEX: combustion chamber of the CIR (MDCA insert), ISS',
  'PSI-39': 'CFI: combustion chamber of the CIR (MDCA insert), ISS',
  'PSI-159': 'CFI-G: CIR chamber with the ACME insert; porous spherical burner',
  'PSI-20': 'ACME BRE: CIR chamber; flat porous burner',
  'PSI-22': 'ACME E-FIELD: CIR chamber; coflow / gas-jet burner with a high-voltage mesh',
  'PSI-107': 'SPICE: gas-jet nozzle in co-flowing air, Microgravity Science Glovebox',
}

export interface SchematicProps {
  shape: SampleShape
  material: string | undefined
  psi: string[]
  dims: { diameter_mm?: number | null; thickness_mm?: number | null; width_mm?: number | null }
  lengthCm?: number | null
  widthCm?: number | null
  flowCmS: number | null
  direction: string | null
  gravity: '0g' | '1g' | 'none'
  d0?: number | null
  nozzleMm?: number | null
  burnerMm?: number | null
  fiber?: boolean
}

function Arrow({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const down = y2 > y1
  return (
    <g stroke="#2a78d6" fill="#2a78d6">
      <line x1={x} x2={x} y1={y1} y2={y2 - (down ? 7 : -7)} strokeWidth={2} />
      <path d={down ? `M${x - 5},${y2 - 9} L${x + 5},${y2 - 9} L${x},${y2} Z` : `M${x - 5},${y2 + 9} L${x + 5},${y2 + 9} L${x},${y2} Z`} stroke="none" />
    </g>
  )
}

function Dim({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g stroke="#3D424C" fontSize={12.5} fill="#16181D">
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - 5} y2={y + 5} /><line x1={x2} x2={x2} y1={y - 5} y2={y + 5} />
      <text x={(x1 + x2) / 2} y={y + 18} textAnchor="middle" stroke="none">{label}</text>
    </g>
  )
}

export default function Schematic(p: SchematicProps) {
  const W = 640, H = 320, cx = 300
  const solid = !['droplet', 'burner'].includes(p.shape)
  const top = 70, bottom = 250
  const flowDown = p.direction !== 'opposed'
  const dims: string[] = []
  if (p.dims.diameter_mm) dims.push(`diameter ${p.dims.diameter_mm} mm`)
  if (p.dims.thickness_mm) dims.push(`thickness ${p.dims.thickness_mm} mm`)
  if (p.dims.width_mm && p.shape !== 'rod') dims.push(`width ${p.dims.width_mm} mm`)
  if (p.lengthCm) dims.push(`length ${p.lengthCm} cm`)
  if (p.widthCm) dims.push(`width ${p.widthCm} cm`)
  const app = [...new Set(p.psi.map((x) => APPARATUS[x]).filter(Boolean))]

  return (
    <div className="p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Schematic of the apparatus and sample with recorded dimensions">
        {/* apparatus outline */}
        <rect x={150} y={30} width={300} height={260} fill="#FAFAF7" stroke="#B9BDC6" strokeDasharray={solid ? '' : '5 4'} />
        <text x={158} y={48} fontSize={12} fill="#646B78">{solid ? 'flow duct' : 'combustion chamber'}</text>

        {/* sample */}
        {(p.shape === 'fabric' || p.shape === 'sheet' || p.shape === 'film' || p.shape === 'composite sheet') && (
          <g><rect x={cx - 45} y={top} width={90} height={bottom - top} fill={p.shape === 'fabric' ? '#E8DDC3' : '#DDE3EC'} stroke="#3D424C" />
            <Dim x1={cx - 45} x2={cx + 45} y={bottom + 14} label={p.dims.width_mm ? `${p.dims.width_mm} mm` : p.widthCm ? `${p.widthCm} cm` : 'width not recorded'} /></g>
        )}
        {p.shape === 'slab' && (
          <g><rect x={cx - 40} y={top} width={80} height={bottom - top} fill="#DDE3EC" stroke="#3D424C" />
            <Dim x1={cx - 40} x2={cx + 40} y={bottom + 14} label={p.dims.width_mm ? `${p.dims.width_mm} mm wide` : 'slab'} /></g>
        )}
        {p.shape === 'rod' && (
          <g><rect x={cx - 14} y={top} width={28} height={bottom - top} rx={3} fill="#DDE3EC" stroke="#3D424C" />
            <Dim x1={cx - 14} x2={cx + 14} y={bottom + 14} label={p.dims.diameter_mm ? `Ø ${p.dims.diameter_mm} mm` : 'Ø not recorded'} /></g>
        )}
        {(p.shape === 'sphere' || p.shape === 'spherical section') && (
          <g>{p.shape === 'sphere' ? <circle cx={cx} cy={160} r={50} fill="#DDE3EC" stroke="#3D424C" />
            : <path d={`M${cx - 55},175 A55,55 0 0 1 ${cx + 55},175 Z`} fill="#DDE3EC" stroke="#3D424C" />}
            <Dim x1={cx - 50} x2={cx + 50} y={235} label={p.dims.diameter_mm ? `Ø ${p.dims.diameter_mm} mm` : 'Ø not recorded'} /></g>
        )}
        {p.shape === 'candle' && <g><rect x={cx - 22} y={130} width={44} height={120} fill="#F1EADB" stroke="#3D424C" /><line x1={cx} x2={cx} y1={118} y2={130} stroke="#16181D" strokeWidth={2} /></g>}
        {p.shape === 'droplet' && (
          <g>{p.fiber && <line x1={170} x2={430} y1={160} y2={160} stroke="#8C9AB0" />}
            <circle cx={cx} cy={160} r={24} fill="#CDE9F8" stroke="#3D424C" />
            <circle cx={cx} cy={160} r={64} fill="none" stroke="#2a78d6" strokeDasharray="3 4" />
            <text x={cx + 70} y={120} fontSize={12} fill="#646B78">flame shell (standoff not recorded)</text>
            <Dim x1={cx - 24} x2={cx + 24} y={235} label={p.d0 ? `d₀ ${p.d0.toFixed(2)} mm (median)` : 'diameter not recorded'} /></g>
        )}
        {p.shape === 'burner' && (
          <g>
            {p.psi.includes('PSI-159') ? <><circle cx={cx} cy={150} r={26} fill="#E8DDC3" stroke="#3D424C" /><line x1={cx} x2={cx} y1={176} y2={250} stroke="#3D424C" strokeWidth={4} /></>
              : p.psi.includes('PSI-20') ? <><rect x={cx - 50} y={180} width={100} height={12} fill="#E8DDC3" stroke="#3D424C" /><line x1={cx} x2={cx} y1={192} y2={250} stroke="#3D424C" strokeWidth={4} />
                  <Dim x1={cx - 50} x2={cx + 50} y={265} label={p.burnerMm ? `${p.burnerMm} mm porous disk` : 'porous disk'} /></>
              : <><rect x={cx - 6} y={150} width={12} height={100} fill="#D5DAE2" stroke="#3D424C" />
                  <text x={cx + 14} y={160} fontSize={12.5} fill="#16181D">{p.nozzleMm ? `nozzle ${p.nozzleMm} mm` : 'nozzle'}</text></>}
          </g>
        )}

        {/* igniter at the top of solid samples */}
        {solid && <g><line x1={cx - 50} x2={cx + 50} y1={top - 10} y2={top - 10} stroke="#B5400F" strokeWidth={2.5} /><text x={cx + 56} y={top - 6} fontSize={12} fill="#B5400F">igniter (top)</text></g>}

        {/* airflow along the sample */}
        {solid && p.flowCmS != null && p.flowCmS > 0 && (
          <g>
            {[cx - 110, cx + 110].map((x) => <Arrow key={x} x={x} y1={flowDown ? top - 20 : bottom + 10} y2={flowDown ? bottom + 10 : top - 20} />)}
            <text x={cx + 120} y={(top + bottom) / 2} fontSize={12.5} fill="#2a78d6">{p.flowCmS} cm/s</text>
            <text x={cx + 120} y={(top + bottom) / 2 + 16} fontSize={12.5} fill="#2a78d6">{p.direction ?? 'direction not recorded'}</text>
          </g>
        )}

        {/* gravity */}
        {p.gravity === '1g'
          ? <g><Arrow x={540} y1={120} y2={200} /><text x={552} y={165} fontSize={13} fill="#16181D">g (1 g)</text></g>
          : <text x={520} y={165} fontSize={13} fill="#646B78">microgravity</text>}
      </svg>
      <div className="px-1 pb-2 text-[13.5px] text-ink2 space-y-0.5">
        {app.map((a) => <div key={a}>{a}</div>)}
        <div>{p.material}{dims.length ? `: ${dims.join(', ')}` : ''} <span className="text-mute">(recorded values; drawing not to scale)</span></div>
      </div>
    </div>
  )
}
