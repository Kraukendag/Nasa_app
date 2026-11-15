// =============================================================================
//  MATCH, 2D SCHEMATIC (shown when WebGL is unavailable, or on request)
// =============================================================================
//  The same idea as the 3D match, as an SVG diagram: with gravity a rising,
//  yellow, sooty teardrop; in microgravity a small, round, blue flame, because
//  nothing rises and oxygen arrives only by diffusion. Illustration.
// =============================================================================

export default function MatchSceneFallback2D({ lit, gravityOn }: { lit: boolean; gravityOn: boolean }) {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" role="img"
         aria-label={`2D schematic of a match, ${lit ? 'burning' : 'unlit'}, ${gravityOn ? 'with gravity: tall yellow teardrop flame' : 'in microgravity: small round blue flame'}`}>
      <defs>
        <radialGradient id="mf-sooty" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#fff6d0" /><stop offset="45%" stopColor="#ffb22e" /><stop offset="100%" stopColor="#ff5a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mf-blue" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#0b0f17" stopOpacity="0" /><stop offset="80%" stopColor="#4f8cff" /><stop offset="100%" stopColor="#4f8cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="#0B0F17" />
      <rect x="194" y="120" width="12" height="170" rx="3" fill="#D8B98A" />
      <circle cx="200" cy="116" r="11" fill={lit ? '#2A1410' : '#9E2B2B'} />
      {lit && (gravityOn
        ? <path d="M200 30 C 222 70, 228 100, 214 124 C 206 136, 194 136, 186 124 C 172 100, 178 70, 200 30 Z" fill="url(#mf-sooty)" />
        : <circle cx="200" cy="116" r="30" fill="url(#mf-blue)" />)}
      <text x="12" y="22" fill="#cbd5e1" fontSize="13" fontFamily="IBM Plex Sans, sans-serif">2D schematic · {gravityOn ? '1 g' : 'microgravity'}</text>
    </svg>
  )
}
