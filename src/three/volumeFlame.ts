// =============================================================================
//  VOLUMETRIC FLAME SHADER
// =============================================================================
//  Every flame on the site is drawn with this shader. Instead of painting a
//  flat picture on a card, it treats the flame as a 3D cloud of hot gas inside
//  an invisible box and, for every pixel, MARCHES a ray through that box,
//  adding up the light the hot gas gives off along the way. That is why the
//  flame has depth and looks right from every angle.
//
//  THE FLAME IS BUILT FROM "SOURCES"
//  ---------------------------------
//  A source is a blob of reaction zone with:
//    pos      where it sits
//    radius   how big it is
//    axis     the direction the hot gas is carried (buoyancy, or airflow)
//    stretch  how far it is drawn out along that axis (0 = round, 2 = tall
//             buoyant teardrop or long jet)
//    shell    0 = glowing all through (a sooty buoyant flame), 1 = a thin
//             glowing skin around the fuel (a quiet microgravity flame)
//    segment  > 0 turns the blob into a LINE along x of that half-length
//             (a flame front across the width of a sheet)
//    power    brightness, 0 = out
//  Up to 16 sources per flame: one for a match, a line for a sheet's front,
//  or 6-14 separate small caps when a starved front breaks into flamelets.
//
//  COLOUR
//  ------
//  Blue where the flame burns cleanly (its base and outer skin), yellow-orange
//  where it carries soot (its core, downstream). `sooty` sets the balance:
//  methanol droplets and quiet microgravity flames are blue; buoyant flames
//  and heptane are sooty.
//
//  COST
//  ----
//  40-64 steps per pixel on a small box. The page drops to fewer steps on a
//  slow computer (see PerformanceMonitor in the scenes).
// =============================================================================

export const MAX_SOURCES = 16

export interface FlameSource {
  pos: [number, number, number]
  radius: number
  stretch: number
  shell: number
  power: number
  axis?: [number, number, number]
  segment?: number
}

export const volumeVertexShader = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const volumeFragmentShader = /* glsl */ `
  precision highp float;
  #define MAX_SOURCES ${MAX_SOURCES}
  varying vec3 vLocal;

  uniform vec3  uCam;                 // camera position in the box's space
  uniform vec3  uHalf;                // half size of the box
  uniform int   uCount;
  uniform vec3  uPos[MAX_SOURCES];
  uniform vec4  uP[MAX_SOURCES];      // radius, stretch, shell, power
  uniform vec4  uQ[MAX_SOURCES];      // axis.xyz, segment half-length
  uniform float uTime;
  uniform float uFlicker;             // 0 steady (microgravity) .. 1 buoyant turbulence
  uniform float uSooty;               // 0 clean blue .. 1 sooty yellow
  uniform float uDim;                 // overall brightness
  uniform float uSteps;

  // ---- cheap 3D value noise (enough for licking flame edges) ----
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3); }

  // Colour ramp for soot glowing at flame temperatures (dark red -> white-yellow).
  vec3 sootColour(float t) {
    vec3 c = mix(vec3(0.35, 0.04, 0.0), vec3(1.0, 0.32, 0.03), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.68, 0.18), smoothstep(0.3, 0.7, t));
    return mix(c, vec3(1.0, 0.93, 0.72), smoothstep(0.7, 1.0, t));
  }

  // The flame field at point p: returns (heat, soot share).
  vec2 field(vec3 p) {
    // Turbulence carries the gas along: strong under buoyancy, slight in 0 g.
    vec3 w = vec3(fbm(p * 5.0 + vec3(0.0, -uTime * 2.2, 0.0)),
                  fbm(p * 5.0 + vec3(3.1, -uTime * 2.0, 1.7)),
                  fbm(p * 5.0 + vec3(5.2, -uTime * 2.4, 4.4))) - 0.5;
    p += w * (0.02 + 0.09 * uFlicker);
    float heat = 0.0, soot = 0.0;
    for (int i = 0; i < MAX_SOURCES; i++) {
      if (i >= uCount) break;
      vec4 P = uP[i]; vec4 Q = uQ[i];
      if (P.w <= 0.001) continue;
      vec3 a = normalize(Q.xyz);
      vec3 q = p - uPos[i];
      if (Q.w > 0.0) q.x -= clamp(q.x, -Q.w, Q.w);          // line source along x
      float along = dot(q, a);
      vec3 perp = q - a * along;
      float r = P.x;
      // Downstream the flame is drawn out and narrows toward a tip.
      float down = max(along, 0.0);
      float len = r * (1.0 + P.y * 2.0);
      float taper = 1.0 - 0.75 * smoothstep(0.0, len, down) * min(1.0, P.y);
      float alongS = along > 0.0 ? along / (1.0 + P.y * 2.0) : along * 1.25;
      float d = length(vec2(length(perp) / max(0.2, taper), alongS));
      float core = exp(-2.2 * (d * d) / (r * r));
      float skin = exp(-pow((d - r * 0.92) / (0.22 * r), 2.0));
      float h = P.w * mix(core, skin * 0.95 + core * 0.12, P.z);
      // Flickering tip: noise eats the top of a buoyant flame.
      h *= 1.0 - uFlicker * 0.6 * smoothstep(0.35, 1.0, down / len) * fbm(p * 7.0 - vec3(0.0, uTime * 3.0, 0.0));
      heat += h;
      // Soot lives in the hot core and downstream, not at the base or the skin.
      soot += h * smoothstep(-0.2 * r, 0.6 * r, along) * (1.0 - P.z * 0.7);
    }
    return vec2(heat, heat > 0.0 ? clamp(soot / heat, 0.0, 1.0) : 0.0);
  }

  void main() {
    vec3 ro = uCam;
    vec3 rd = normalize(vLocal - uCam);
    // Ray-box intersection.
    vec3 inv = 1.0 / rd;
    vec3 t0 = (-uHalf - ro) * inv, t1 = (uHalf - ro) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float tn = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
    float tf = min(min(tmax.x, tmax.y), tmax.z);
    if (tf <= tn) discard;

    float stepLen = (tf - tn) / uSteps;
    float t = tn + stepLen * hash(vec3(gl_FragCoord.xy, uTime));   // jitter hides banding
    vec3 col = vec3(0.0);
    float a = 0.0;
    for (int i = 0; i < 64; i++) {
      if (float(i) >= uSteps || a > 0.97) break;
      vec2 f = field(ro + rd * t);
      float h = f.x;
      if (h > 0.004) {
        float s = f.y * uSooty;
        float temp = clamp(h, 0.0, 1.4);
        // Clean burning glows blue and faint; soot glows bright yellow-orange.
        vec3 blue = vec3(0.10, 0.26, 1.0) * (0.55 + 0.5 * min(temp, 1.0)) + vec3(0.20, 0.30, 0.50) * smoothstep(1.0, 1.4, temp);
        vec3 c = mix(blue * 1.5, sootColour(temp * 0.85) * 1.6, s);
        float dens = h * stepLen * mix(16.0, 22.0, s);
        col += c * dens * (1.0 - a);
        a += dens * 0.35 * (1.0 - a);
      }
      t += stepLen;
    }
    if (a < 0.002 && dot(col, col) < 0.00001) discard;
    gl_FragColor = vec4(col * uDim, clamp(a, 0.0, 1.0));
  }
`
