// =============================================================================
//  PROCEDURAL FLAME SHADER
// =============================================================================
//  Draws fire by calculating a colour for every pixel rather than moving a
//  pre-made shape around.
//
//  THE IDEA IN PLAIN WORDS
//  -----------------------
//  1. Work out a "flame envelope". Two families: a PLUME (a teardrop standing
//     on the fuel, stretched by buoyancy or by airflow) and a SHELL (a thin
//     reaction zone wrapped around a droplet, sphere or quiescent fuel). Each
//     sample picks its family, length, width, flicker and sootiness from its
//     shape and the recorded conditions; nothing here is fixed to "0 g = ring".
//  2. Distort the envelope with animated noise so the edges lick and flicker
//     (strongly under buoyancy, barely at all in microgravity).
//  3. Turn the result into a temperature, 0 outside to 1 at the core, and look
//     that up in a colour ramp: clean blue, or sooty orange-yellow.
//
//  COST: one camera-facing quad per flame and four octaves of noise -- light
//  enough for a moderate laptop even with a dozen flames on screen.
//
//  PHYSICS VS ART: the plume/shell choice and the orientation follow how these
//  flames are described in the literature. Exact colour, flicker rate and
//  size are illustration, and the interface says so.
// =============================================================================

export const flameVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const flameFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uAlive;      // 0 = out, 1 = fully lit (animates on ignite / extinction)
  uniform float uShape;      // 0 = plume (teardrop), 1 = shell enveloping the fuel
  uniform float uStretch;    // plume length: ~0.2 compact, 1 = buoyant, 1.4 long jet
  uniform float uWidth;      // width multiplier
  uniform float uFlicker;    // 0 = steady (microgravity), 1 = buoyant turbulence
  uniform float uSooty;      // 0 = clean blue burn, 1 = sooty yellow
  uniform float uIntensity;  // 0-1, oxygen-driven vigour
  uniform float uLean;       // sideways lean, already projected to the screen
  uniform float uDim;        // overall brightness (microgravity flames are dim)

  // Gradient noise; the third dimension is time so the pattern evolves.
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * gnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  // Colour ramps, cold to hot.
  vec3 sootyRamp(float t) {
    vec3 c = mix(vec3(0.30, 0.02, 0.00), vec3(0.95, 0.22, 0.01), smoothstep(0.00, 0.33, t));
    c = mix(c, vec3(1.00, 0.58, 0.08), smoothstep(0.28, 0.60, t));
    c = mix(c, vec3(1.00, 0.88, 0.45), smoothstep(0.56, 0.84, t));
    c = mix(c, vec3(1.00, 0.97, 0.88), smoothstep(0.84, 1.00, t));
    return c;
  }
  vec3 cleanRamp(float t) {
    vec3 c = mix(vec3(0.01, 0.03, 0.16), vec3(0.04, 0.22, 0.72), smoothstep(0.00, 0.40, t));
    c = mix(c, vec3(0.16, 0.56, 0.98), smoothstep(0.35, 0.68, t));
    c = mix(c, vec3(0.62, 0.88, 1.00), smoothstep(0.66, 0.90, t));
    c = mix(c, vec3(0.92, 0.98, 1.00), smoothstep(0.90, 1.00, t));
    return c;
  }

  void main() {
    // Same unit on both axes: x -0.5..0.5, y 0..1 on a square quad.
    vec2 q = vec2(vUv.x - 0.5, vUv.y);
    const float BASE = 0.22;            // the fuel sits here, leaving room below
    float y = q.y - BASE;

    // ---- Turbulence: strong under buoyancy, almost none in microgravity ----
    float rise  = mix(0.18, 1.70, uFlicker);
    float churn = mix(0.06, 1.00, uFlicker);
    vec3 nc = vec3(q.x * 5.0, y * 3.2 - uTime * rise, uTime * 0.30);
    float n1 = fbm(nc);
    float n2 = fbm(nc * 0.55 + vec3(n1 * 1.2, 0.0, 3.1));
    float turb = mix(n1, n2, 0.5) * churn;
    float lean = uLean * max(y, 0.0) * 0.6 + sin(uTime * 1.7) * 0.012 * uFlicker;

    // ---- Plume: a teardrop standing on the fuel -----------------------------
    float flameH = (0.22 + 0.48 * uStretch) * (0.75 + 0.25 * uIntensity);
    float h  = y / max(0.05, flameH);
    float hc = clamp(h, 0.0, 1.0);
    float widthE = 0.21 * uWidth * pow(1.0 - hc, 0.70) * pow(clamp(hc * 2.6 + 0.30, 0.0, 1.0), 0.50);
    float turbH = turb * (0.12 + 0.88 * hc);
    float xE = q.x - lean - turbH * 0.07;
    float plume = 1.0 - abs(xE) / max(0.0001, widthE);
    plume -= turbH * 0.75 * smoothstep(0.15, 1.0, h);
    plume *= smoothstep(-0.06, 0.03, y);
    plume *= 1.0 - smoothstep(0.85, 1.12, h);
    plume *= 1.0 - 0.50 * hc;            // the tip is the coolest part

    // ---- Shell: a thin reaction zone wrapped around the fuel ----------------
    float radius = mix(0.15, 0.21, uIntensity) * uWidth;
    vec2 c = vec2(q.x - lean * 0.3, y - 0.035);
    float r = length(c) / max(0.0001, radius) + n1 * 0.10;
    float shell = (exp(-pow((r - 0.78) / 0.30, 2.0)) * 0.78 + (1.0 - smoothstep(0.0, 1.0, r)) * 0.38) * 0.82;

    float field = mix(plume, shell, uShape);
    float temperature = smoothstep(0.0, 1.0, clamp(field, 0.0, 1.0)) * uAlive;
    if (temperature <= 0.002) discard;

    vec3 colour = mix(cleanRamp(temperature), sootyRamp(temperature), uSooty);
    // The root of a sooty plume is still blue: oxygen-rich, no soot yet.
    float baseBlue = (1.0 - smoothstep(0.0, 0.22, h)) * uSooty * (1.0 - uShape);
    colour = mix(colour, vec3(0.22, 0.48, 1.0) * (0.6 + temperature), baseBlue * 0.8);

    float alpha = smoothstep(0.0, 0.55, temperature);
    gl_FragColor = vec4(colour * (0.55 + 0.85 * temperature) * uDim, alpha);
  }
`

/** The uniform block, in one place so the mesh and the shader cannot drift. */
export function makeFlameUniforms() {
  return {
    uTime: { value: 0 }, uAlive: { value: 0 }, uShape: { value: 0 }, uStretch: { value: 1 },
    uWidth: { value: 1 }, uFlicker: { value: 1 }, uSooty: { value: 1 }, uIntensity: { value: 0.6 },
    uLean: { value: 0 }, uDim: { value: 1 },
  }
}
