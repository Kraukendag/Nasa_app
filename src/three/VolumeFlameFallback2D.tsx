// =============================================================================
//  SPECIMEN, 2D SCHEMATIC (shown when WebGL is unavailable, or on request)
// =============================================================================
//  The Lab's sample as an SVG diagram with a flame glyph for the behaviour the
//  NASA evidence supports (see src/lab/regime.ts): a front, flamelets, a cap,
//  a shell or a buoyant plume. Static; illustration only.
// =============================================================================

import type { Regime } from '../lab/regime'

export default function VolumeFlameFallback2D({ shape, gravity, lit, regime }: { shape: string; gravity: '0g' | '1g'; lit: boolean; regime: Regime }) {
  const flat = ['fabric', 'sheet', 'film', 'slab', 'composite sheet'].includes(shape)
  const g1 = gravity === '1g'
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" role="img" aria-label={`2D schematic: ${shape}, ${g1 ? '1 g' : 'microgravity'}, ${regime.label}`}>
      <rect width="400" height="300" fill="#0B0F17" />
      {flat && <rect x="170" y="50" width="60" height="200" fill="#D9CBA8" />}
      {flat && lit && <rect x="170" y="50" width="60" height="80" fill="#231E1B" />}
      {shape === 'rod' && <rect x="188" y="70" width="24" height="190" rx="4" fill="#CBD3DF" />}
      {(shape === 'sphere' || shape === 'spherical section' || shape === 'droplet' || shape === 'burner') && <circle cx="200" cy="150" r={shape === 'droplet' ? 14 : 34} fill={shape === 'droplet' ? '#BFE4FA' : '#C8B79B'} />}
      {shape === 'candle' && <rect x="182" y="150" width="36" height="110" fill="#EDE6D3" />}
      {lit && regime.behaviour === 'fingering' && [180, 194, 208, 222].map((x, i) => <circle key={x} cx={x} cy={130 + (i % 2) * 18} r="5" fill="#5a8cff" />)}
      {lit && regime.behaviour === 'front' && <rect x="166" y="126" width="68" height="8" rx="4" fill={g1 ? '#ffb22e' : '#5a8cff'} />}
      {lit && regime.behaviour === 'cap' && <path d="M184 72 A16 16 0 0 1 216 72" stroke="#5a8cff" strokeWidth="7" fill="none" />}
      {lit && (regime.behaviour === 'shell' || regime.behaviour === 'droplet' || regime.behaviour === 'burner') && <circle cx="200" cy={shape === 'candle' ? 140 : 150} r={shape === 'droplet' ? 34 : 48} stroke="#5a8cff" strokeWidth="5" fill="none" opacity="0.85" />}
      {lit && regime.behaviour === 'plume' && <path d="M200 20 C 226 60, 232 100, 214 126 C 206 136, 194 136, 186 126 C 168 100, 174 60, 200 20 Z" fill="#ffb22e" opacity="0.85" />}
      <text x="12" y="22" fill="#cbd5e1" fontSize="13" fontFamily="IBM Plex Sans, sans-serif">2D schematic · {regime.label}</text>
    </svg>
  )
}
