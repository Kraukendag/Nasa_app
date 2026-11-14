// =============================================================================
//  PROCEDURAL FLAME SHADER
// =============================================================================
//  This draws fire by calculating a colour for every pixel, instead of moving
//  a pre-made shape around. That is what makes it look like fire rather than
//  like a stretching blob.
//
//  THE IDEA IN PLAIN WORDS
//  -----------------------
//  1. Work out a "flame envelope" — the region the flame could occupy. Under
//     gravity that is a teardrop standing on the wick. Without gravity it is
//     a thin glowing shell wrapped around the fuel.
//  2. Distort that region with animated noise. Noise is a cloudy random
//     pattern; scrolling it upward makes the edges flicker and lick the way
//     real flame tongues do.
//  3. Turn the result into a temperature from 0 (outside) to 1 (core), then
//     look that temperature up in a colour ramp.
//
//  WHY IT STILL RUNS ON A MODERATE LAPTOP
//  --------------------------------------
//  It is one flat quad that always turns to face the camera, not a cloud of
//  particles and not a volume raymarch. The only real cost is the noise, and
//  we use four octaves, which is the point where adding more stops being
//  visible. Expect a fraction of a millisecond per frame.
//
//  WHAT IS PHYSICS AND WHAT IS ART
//  -------------------------------
//  The SHAPE difference between gravity on and off is real, and it is the
//  whole point of the project: buoyancy stretches a flame upward, and with no
//  buoyancy a diffusion flame is a sphere. The colours are real in direction
//  too — microgravity flames burn bluer because soot is oxidised rather than
//  left glowing. Exact flicker rate and brightness are illustration, and the
//  interface labels the flame as illustrative.
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
  uniform float uGravity;    // 0.0 = microgravity, 1.0 = Earth gravity
  uniform float uAlive;      // 0.0 = out, 1.0 = fully lit (animates on ignite)
  uniform float uIntensity;  // 0.0 - 1.0, driven by oxygen in the Lab
  uniform float uFlow;       // sideways airflow, 0 = still
  uniform float uSoot;       // 0 = oxygen-rich and clean, 1 = sooty

  // ---------------------------------------------------------------------
  //  Gradient noise. hash3 turns a grid corner into a random direction;
  //  gnoise smoothly blends the eight corners around a point. The third
  //  dimension is time, so the pattern evolves instead of merely scrolling.
  // ---------------------------------------------------------------------
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);   // smoothstep, so there are no creases
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }

  // Stacked noise: each octave twice as fine and half as strong.
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * gnoise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  // ---------------------------------------------------------------------
  //  Colour ramps. Both run cold -> hot, so one temperature drives either.
  // ---------------------------------------------------------------------

  // Earth flame: dark red rim, orange body, yellow soot glow, white core.
  vec3 sootyRamp(float t) {
    vec3 c = mix(vec3(0.30, 0.02, 0.00), vec3(0.95, 0.22, 0.01), smoothstep(0.00, 0.33, t));
    c = mix(c, vec3(1.00, 0.58, 0.08), smoothstep(0.28, 0.60, t));
    c = mix(c, vec3(1.00, 0.88, 0.45), smoothstep(0.56, 0.84, t));
    c = mix(c, vec3(1.00, 0.97, 0.88), smoothstep(0.84, 1.00, t));
    return c;
  }

  // Microgravity flame: deep blue through cyan to a pale blue-white.
  vec3 cleanRamp(float t) {
    vec3 c = mix(vec3(0.01, 0.03, 0.16), vec3(0.04, 0.22, 0.72), smoothstep(0.00, 0.40, t));
    c = mix(c, vec3(0.16, 0.56, 0.98), smoothstep(0.35, 0.68, t));
    c = mix(c, vec3(0.62, 0.88, 1.00), smoothstep(0.66, 0.90, t));
    c = mix(c, vec3(0.92, 0.98, 1.00), smoothstep(0.90, 1.00, t));
    return c;
  }

  void main() {
    // q uses the SAME unit on both axes: x runs -0.5..0.5, y runs 0..1, and
    // the quad is square. Mixing units here (x over 2, y over 1) is what made
    // earlier versions of this flame look stretched — a circle came out twice
    // as tall as it was wide.
    vec2 q = vec2(vUv.x - 0.5, vUv.y);
    float g = uGravity;

    // The fuel sits a little above the bottom edge of the quad, so the
    // microgravity shell has room to wrap all the way around it.
    const float BASE = 0.22;
    float y = q.y - BASE;                 // height above the fuel

    // ---- Turbulence ------------------------------------------------------
    // Sampling noise at a y that falls with time makes the pattern travel up.
    // Microgravity flames are famously steady, so churn nearly vanishes at 0 g.
    float rise  = mix(0.18, 1.70, g);
    float churn = mix(0.06, 1.00, g);
    vec3 nc = vec3(q.x * 5.0, y * 3.2 - uTime * rise, uTime * 0.30);
    float n1 = fbm(nc);
    // Feeding one noise into another gives tongues and necking, not fuzz.
    float n2 = fbm(nc * 0.55 + vec3(n1 * 1.2, 0.0, 3.1));
    float turb = mix(n1, n2, 0.5) * churn;

    float lean = uFlow * max(y, 0.0) * 0.45 + sin(uTime * 1.7) * 0.012 * g;

    // ---- Earth: a teardrop standing on the fuel --------------------------
    float flameH = mix(0.45, 0.70, uIntensity);
    float h  = y / flameH;                // 0 at the fuel, 1 at the tip
    float hc = clamp(h, 0.0, 1.0);
    // Already part-width at the fuel (it engulfs the wick), widest about a
    // quarter of the way up, then tapering to a point.
    float widthE = 0.21 * pow(1.0 - hc, 0.70) * pow(clamp(hc * 2.6 + 0.30, 0.0, 1.0), 0.50);
    // Smooth and laminar near the wick, breaking up toward the tip.
    float turbH = turb * (0.12 + 0.88 * hc);
    float xE = q.x - lean - turbH * 0.07;
    float earthField = 1.0 - abs(xE) / max(0.0001, widthE);
    earthField -= turbH * 0.75 * smoothstep(0.15, 1.0, h);
    earthField *= smoothstep(-0.06, 0.03, y);           // round the base: no hard cut
    earthField *= 1.0 - smoothstep(0.85, 1.12, h);      // soften the very tip
    float coolTop = 1.0 - 0.50 * hc;                     // the tip is the coolest part

    // ---- Microgravity: a thin glowing shell around the fuel --------------
    // A microgravity diffusion flame is a thin reaction zone wrapped round
    // the fuel. Seen from outside, a thin shell looks brightest at its rim,
    // so we draw a ring with a faint glow inside it.
    float radius = mix(0.15, 0.21, uIntensity);
    vec2 c = vec2(q.x - lean * 0.3, y - 0.035);
    // Slow, gentle noise of its own: microgravity flames are near-spherical
    // but never a perfect circle.
    float r = length(c) / radius + n1 * 0.10;
    float shell = exp(-pow((r - 0.78) / 0.30, 2.0));   // wide, soft rim
    float glow  = (1.0 - smoothstep(0.0, 1.0, r)) * 0.38;
    // Microgravity flames are DIM — they burn cooler and emit far less light
    // than an Earth flame of the same fuel. Cap the shell's brightness.
    float microField = (shell * 0.78 + glow) * 0.82;

    // ---- Blend and convert to a temperature ------------------------------
    // smoothstep over the FULL 0..1 range keeps the white-hot core small. A
    // steeper ramp saturated most of the flame to white, hiding the colours.
    float field = mix(microField, earthField * coolTop, g);
    float temperature = smoothstep(0.0, 1.0, clamp(field, 0.0, 1.0)) * uAlive;
    if (temperature <= 0.002) discard;

    // ---- Colour ------------------------------------------------------------
    vec3 colour = mix(cleanRamp(temperature), sootyRamp(temperature), g);

    // The base of a flame is blue even on Earth: oxygen is plentiful at the
    // wick and soot has not formed yet. Oxygen-rich flames (low uSoot) carry
    // that blue zone further up.
    float blueTop  = mix(0.32, 0.15, uSoot);
    float baseBlue = (1.0 - smoothstep(0.0, blueTop, h)) * g;
    colour = mix(colour, vec3(0.22, 0.48, 1.0) * (0.6 + temperature), baseBlue * 0.8);

    float alpha = smoothstep(0.0, 0.55, temperature);
    gl_FragColor = vec4(colour * (0.55 + 0.85 * temperature), alpha);
  }
`

/** The uniform block, in one place so the mesh and the shader cannot drift. */
export function makeFlameUniforms() {
  return {
    uTime:      { value: 0 },
    uGravity:   { value: 1 },
    uAlive:     { value: 0 },
    uIntensity: { value: 0.5 },
    uFlow:      { value: 0 },
    uSoot:      { value: 1 },
  }
}
