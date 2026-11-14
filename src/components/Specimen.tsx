// =============================================================================
//  SPECIMEN  (the 3D view in the Experiment Lab)
// =============================================================================
//  A sample in a schematic flow duct, ignited at the top, with a flame that
//  spreads down until it has engulfed the sample -- or stops, the way the
//  matching NASA tests actually ended.
//
//  WHAT DRIVES WHAT
//  ----------------
//  * Shape and size: the recorded geometry (rod diameter, sheet width, sphere
//    diameter, droplet diameter).
//  * Airflow: the recorded speed and direction, drawn as white particles
//    moving ALONG the sample, as in the BASS duct and the Saffire flow unit.
//  * Flame orientation: in 1 g the flame rises. In microgravity the airflow
//    decides: concurrent flow pushes the flame ahead of the front over fresh
//    fuel; opposed flow keeps it short at the leading edge; a rod in
//    stagnation flow carries a cap "like a candle flame at the end of a fat
//    wick" (Olson, NASA/TM-2004-213114).
//  * The ending: the most common recorded outcome of the matching tests --
//    burns through, goes out partway, flashes briefly, or blows off.
//  * Colour, flicker and exact flame size are illustration, and labelled so.
// =============================================================================

import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import FlameMesh from './FlameMesh'

export type SampleShape = 'rod' | 'sphere' | 'slab' | 'film' | 'fabric' | 'sheet' | 'composite sheet'
  | 'candle' | 'spherical section' | 'droplet' | 'burner'
export type BurnerKind = 'sphere' | 'disk' | 'jet'
export type Ending = 'full' | 'partial' | 'brief' | 'blowoff' | 'none'
type Dir = 'concurrent' | 'opposed' | 'stagnation' | null

export interface SpecimenProps {
  shape: SampleShape
  dims: { diameter_mm?: number | null; thickness_mm?: number | null; width_mm?: number | null }
  gravity: '0g' | '1g' | 'none'
  flowCmS: number | null
  direction: Dir
  o2: number | null
  lit: boolean
  ending: Ending
  /** Recorded spread rate (mm/s) for the time-lapse label; null = illustrative pace. */
  spreadMmS?: number | null
  fuel?: string | null
  droplet?: { d0: number; dExt: number | null; burnTime: number | null } | null
  fiber?: boolean
  burner?: BurnerKind
  burnerSizeMm?: number | null
}

// -----------------------------------------------------------------------------
//  How the flame looks under the chosen conditions
// -----------------------------------------------------------------------------
interface Style { shape: number; stretch: number; width: number; flicker: number; sooty: number; dim: number; flip: boolean; intensity: number }

function flameStyle(gravity: SpecimenProps['gravity'], dir: Dir, flow: number | null, o2: number | null): Style {
  const f = Math.min(1, (flow ?? 0) / 20)
  const intensity = o2 != null ? Math.max(0.2, Math.min(1, (o2 - 11) / 25)) : 0.55
  if (gravity === '1g') return { shape: 0, stretch: 1, width: 0.9, flicker: 1, sooty: 0.85, dim: 1, flip: false, intensity }
  if (dir === 'concurrent' && f > 0) return { shape: 0, stretch: 0.45 + 0.75 * f, width: 0.8, flicker: 0.12, sooty: 0.2 + 0.4 * intensity, dim: 0.85, flip: true, intensity }
  if (dir === 'opposed' && f > 0) return { shape: 0.15, stretch: 0.2 + 0.18 * f, width: 0.75, flicker: 0.1, sooty: 0.12, dim: 0.8, flip: false, intensity }
  if (dir === 'stagnation') return { shape: 0.7, stretch: 0.3, width: 0.95, flicker: 0.1, sooty: 0.18, dim: 0.8, flip: false, intensity }
  return { shape: 0.8, stretch: 0.25, width: 0.9, flicker: 0.08, sooty: 0.1, dim: 0.65, flip: false, intensity }
}

// -----------------------------------------------------------------------------
//  The spread clock: ignite at the top, then spread to engulf, then end the
//  way the data says. One clock per scene, read by every part each frame.
// -----------------------------------------------------------------------------
interface Clock { p: number; alive: number; igniter: number; lift: number }
const SPREAD_S = 11          // seconds of animation for a full spread
const PAUSE_S = 2.5

function useSpreadClock(lit: boolean, ending: Ending) {
  const clock = useRef<Clock>({ p: 0, alive: 0, igniter: 0, lift: 0 })
  const start = useRef<number | null>(null)
  const stopAt = ending === 'partial' ? 0.5 : ending === 'brief' ? 0.05 : ending === 'blowoff' ? 0.4 : ending === 'none' ? 0 : 1
  useFrame((state) => {
    const c = clock.current
    const now = state.clock.elapsedTime
    if (!lit) { start.current = null; c.p = 0; c.alive = 0; c.igniter = 0; c.lift = 0; return }
    if (start.current == null) start.current = now
    const ignite = 1.2
    const travel = SPREAD_S * Math.max(0.05, stopAt)
    const cycle = ignite + travel + 1.6 + PAUSE_S
    const t = (now - start.current) % cycle
    c.igniter = t < ignite ? 1 : Math.max(0, 1 - (t - ignite) * 2)
    if (ending === 'none') { c.alive = 0; c.p = 0; return }
    const s = Math.max(0, t - ignite * 0.6) / SPREAD_S
    c.p = Math.min(stopAt, s)
    const ended = t > ignite + travel
    // After the front stops, the flame dies away (or lifts off for blowoff).
    const fade = ended ? Math.max(0, 1 - (t - ignite - travel) / 1.4) : 1
    c.lift = ending === 'blowoff' && ended ? (t - ignite - travel) * 0.6 : 0
    c.alive = t < ignite * 0.6 ? 0 : fade
  })
  return clock
}

// -----------------------------------------------------------------------------
//  Shared pieces
// -----------------------------------------------------------------------------
const SAMPLE = { color: '#CBD3DF', roughness: 0.55, metalness: 0.04 }
const CHAR = { color: '#2B2724', roughness: 0.95 }

/** A pair of complementary clipping planes at the flame front: one keeps the
 *  unburned part below the front, the other the charred part above it. */
function useFrontPlanes() {
  return useMemo(() => ({
    below: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    above: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  }), [])
}

function Igniter({ clock, y, w }: { clock: React.MutableRefObject<Clock>; y: number; w: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (mat.current) mat.current.emissiveIntensity = 3 * clock.current.igniter })
  return (
    <mesh position={[0, y + 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.012, 0.012, w, 8]} />
      <meshStandardMaterial ref={mat} color="#8a8f99" emissive="#ff6a1a" emissiveIntensity={0} metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

/** White dots moving along the sample at a speed set by the recorded flow. */
function Airflow({ flowCmS, direction, height }: { flowCmS: number; direction: Dir; height: number }) {
  const COUNT = 240
  const ref = useRef<THREE.Points>(null)
  const dot = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d')!; const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c)
  }, [])
  const seeds = useMemo(() => Array.from({ length: COUNT }, () => ({
    a: Math.random(), x: (Math.random() - 0.5) * 1.9, z: (Math.random() - 0.5) * 1.1, j: 0.7 + Math.random() * 0.6,
  })), [])
  useFrame((state) => {
    if (!ref.current) return
    const speed = Math.min(2, 0.1 + flowCmS * 0.05)
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const H = height + 0.6
    seeds.forEach((s, i) => {
      const u = (s.a + state.clock.elapsedTime * speed * s.j * 0.16) % 1
      // Concurrent and stagnation flow travel DOWN the sample (the way the
      // flame spreads from its top ignition point); opposed flow travels UP.
      const y = direction === 'opposed' ? -H / 2 + u * H : H / 2 - u * H
      const squeeze = direction === 'stagnation' ? Math.max(0.15, (y + 0.2) / (H / 2)) : 1
      pos.setXYZ(i, s.x * squeeze, y, s.z * squeeze)
    })
    pos.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(COUNT * 3), 3]} /></bufferGeometry>
      <pointsMaterial size={0.045} map={dot} color="#FFFFFF" transparent opacity={0.75} alphaTest={0.05} depthWrite={false} />
    </points>
  )
}

/** The flow duct (or chamber) drawn as a faint outline, so the sample sits in
 *  its apparatus rather than on a floor. In microgravity there is no floor. */
function Enclosure({ label, w, h, d }: { label: string; w: number; h: number; d: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d])
  return (
    <group>
      <lineSegments geometry={geo}><lineBasicMaterial color="#3a4660" transparent opacity={0.6} /></lineSegments>
      <Html position={[-w / 2, h / 2, d / 2]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#8b97ab', fontSize: 12, whiteSpace: 'nowrap', transform: 'translate(4px,-18px)', fontFamily: 'IBM Plex Sans, sans-serif' }}>{label}</div>
      </Html>
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Sheet-like samples: fabric, sheet, film, slab
// -----------------------------------------------------------------------------
function SheetSample({ dims, shape, style, lit, clock }: {
  dims: SpecimenProps['dims']; shape: SampleShape; style: Style; lit: boolean; clock: React.MutableRefObject<Clock>
}) {
  const H = 1.5, top = H / 2
  const W = THREE.MathUtils.clamp(((dims.width_mm ?? 20) / 20) * 0.75, 0.4, 1.2)
  const thick = shape === 'slab' ? THREE.MathUtils.clamp(((dims.thickness_mm ?? 3) / 10) * 0.3, 0.05, 0.3) : 0.02
  const planes = useFrontPlanes()
  const front = useRef<THREE.Group>(null)
  const ember = useRef<THREE.Mesh>(null)
  const alive = useRef(1)
  const N = Math.max(3, Math.round(W / 0.16))
  const colour = shape === 'fabric' ? '#D9CBA8' : shape === 'composite sheet' ? '#C9B79A' : SAMPLE.color

  useFrame(() => {
    const c = clock.current
    const yf = top - c.p * H
    planes.below.constant = yf
    planes.above.constant = -yf
    alive.current = c.alive
    if (front.current) { front.current.position.y = yf + c.lift; front.current.position.x = 0 }
    if (ember.current) { ember.current.position.y = yf; (ember.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * c.alive }
  })

  // Fabric and films leave a dark residue; a slab leaves charred material.
  const charOpacity = shape === 'film' ? 0.25 : shape === 'fabric' ? 0.85 : 0.95
  const flameScale = shape === 'slab' ? 0.55 : 0.45
  return (
    <group>
      <mesh><boxGeometry args={[W, H, thick]} /><meshStandardMaterial color={colour} roughness={0.8} clippingPlanes={[planes.below]} side={THREE.DoubleSide} /></mesh>
      <mesh><boxGeometry args={[W, H, thick]} /><meshStandardMaterial {...CHAR} transparent opacity={charOpacity} clippingPlanes={[planes.above]} side={THREE.DoubleSide} /></mesh>
      <mesh ref={ember}><boxGeometry args={[W, 0.018, thick + 0.012]} /><meshBasicMaterial color="#ff7a2a" transparent opacity={0} /></mesh>
      <Igniter clock={clock} y={top} w={W} />
      {/* The flame front: a row of flames across the width, on both faces. */}
      <group ref={front}>
        {Array.from({ length: N }).flatMap((_, i) => {
          const x = -W / 2 + (W * (i + 0.5)) / N
          return [1, -1].map((side) => (
            <FlameMesh key={`${i}${side}`} lit={lit} aliveRef={alive} shape={style.shape} stretch={style.stretch}
                       width={style.width} flicker={style.flicker} sooty={style.sooty} dim={style.dim}
                       intensity={style.intensity} flip={style.flip} scale={flameScale}
                       position={[x, 0, side * (thick / 2 + 0.015)]} castLight={i === Math.floor(N / 2) && side === 1} />
          ))
        })}
      </group>
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Rod: a flame cap on the tip; the rod burns back as the cap moves down
// -----------------------------------------------------------------------------
function RodSample({ dims, style, lit, clock }: { dims: SpecimenProps['dims']; style: Style; lit: boolean; clock: React.MutableRefObject<Clock> }) {
  const r = THREE.MathUtils.clamp(((dims.diameter_mm ?? 9.5) / 12.7) * 0.2, 0.07, 0.24)
  const H = 1.4, top = H / 2
  const planes = useFrontPlanes()
  const cap = useRef<THREE.Group>(null)
  const charRing = useRef<THREE.Mesh>(null)
  const alive = useRef(1)
  useFrame(() => {
    const c = clock.current
    const tip = top - c.p * H * 0.55            // the end regresses as it burns
    planes.below.constant = tip
    alive.current = c.alive
    if (cap.current) cap.current.position.y = tip + c.lift
    if (charRing.current) charRing.current.position.y = tip - 0.02
  })
  return (
    <group>
      <mesh><cylinderGeometry args={[r, r, H, 40]} /><meshStandardMaterial {...SAMPLE} clippingPlanes={[planes.below]} /></mesh>
      {/* The melting, charred end of the rod */}
      <mesh ref={charRing}><cylinderGeometry args={[r * 1.02, r * 1.02, 0.05, 40]} /><meshStandardMaterial color="#5a3a24" roughness={0.6} /></mesh>
      <Igniter clock={clock} y={top} w={r * 3} />
      <group ref={cap}>
        <FlameMesh lit={lit} aliveRef={alive} shape={Math.max(style.shape, style.flip ? 0 : 0.35)}
                   stretch={style.stretch} width={style.width * 1.1} flicker={style.flicker} sooty={style.sooty}
                   dim={style.dim} intensity={style.intensity} flip={style.flip}
                   scale={r * 7 + 0.25} position={[0, style.flip ? 0.02 : -0.03, 0]} castLight />
      </group>
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Sphere / spherical section: a ring of flame slides down, then envelops it
// -----------------------------------------------------------------------------
function SphereSample({ dims, half, style, lit, clock }: {
  dims: SpecimenProps['dims']; half: boolean; style: Style; lit: boolean; clock: React.MutableRefObject<Clock>
}) {
  const R = THREE.MathUtils.clamp(((dims.diameter_mm ?? 20) / 20) * 0.36, 0.16, 0.6)
  const planes = useFrontPlanes()
  const ring = useRef<(THREE.Group | null)[]>([])
  const ringAlive = useRef(1)
  const envelope = useRef(0)
  const N = 8
  const thetaMax = half ? Math.PI / 2 : Math.PI
  useFrame(() => {
    const c = clock.current
    const th = Math.max(0.12, c.p * thetaMax)
    const yf = R * Math.cos(th)
    planes.below.constant = yf
    planes.above.constant = -yf
    // The ring fades as the flame closes around the whole sample.
    ringAlive.current = c.alive * (1 - THREE.MathUtils.smoothstep(c.p, 0.65, 1))
    envelope.current = c.alive * THREE.MathUtils.smoothstep(c.p, 0.25, 0.85)
    ring.current.forEach((g, i) => {
      if (!g) return
      const ph = (i / N) * Math.PI * 2
      g.position.set((R + 0.02) * Math.sin(th) * Math.cos(ph), yf + c.lift, (R + 0.02) * Math.sin(th) * Math.sin(ph))
    })
  })
  const geo = half ? <sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /> : <sphereGeometry args={[R, 48, 32]} />
  return (
    <group>
      <mesh>{geo}<meshStandardMaterial {...SAMPLE} side={THREE.DoubleSide} clippingPlanes={[planes.below]} /></mesh>
      <mesh>{geo}<meshStandardMaterial {...CHAR} side={THREE.DoubleSide} clippingPlanes={[planes.above]} /></mesh>
      <Igniter clock={clock} y={R} w={R * 0.8} />
      {Array.from({ length: N }).map((_, i) => (
        <group key={i} ref={(g) => { ring.current[i] = g }}>
          <FlameMesh lit={lit} aliveRef={ringAlive} shape={style.shape * 0.5} stretch={style.stretch * 0.7}
                     width={style.width} flicker={style.flicker} sooty={style.sooty} dim={style.dim}
                     intensity={style.intensity} flip={style.flip} scale={R * 1.1 + 0.12} />
        </group>
      ))}
      {/* Once engulfed: a shell around the sample in microgravity, a rising
          plume in 1 g, a downstream wake if concurrent flow pushes it. */}
      <FlameMesh lit={lit} aliveRef={envelope} shape={style.flicker > 0.5 ? 0.15 : style.flip ? 0.25 : 0.9}
                 stretch={style.flicker > 0.5 ? 1 : style.stretch + 0.3} width={1.05} flicker={style.flicker}
                 sooty={style.sooty} dim={style.dim} intensity={style.intensity} flip={style.flip}
                 scale={(R * 2.6) / 0.36} position={[0, style.flip ? R * 0.35 : -R * 0.55, 0]} castLight />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Candle, droplet, burners
// -----------------------------------------------------------------------------
function CandleSample({ style, lit, gravity, clock }: { style: Style; lit: boolean; gravity: SpecimenProps['gravity']; clock: React.MutableRefObject<Clock> }) {
  const alive = useRef(1)
  useFrame(() => { alive.current = clock.current.alive })
  return (
    <group position={[0, -0.25, 0]}>
      <mesh><cylinderGeometry args={[0.17, 0.17, 1.0, 40]} /><meshStandardMaterial color="#EDE6D3" roughness={0.7} /></mesh>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 6]} /><meshStandardMaterial color="#2A2420" /></mesh>
      <FlameMesh lit={lit} aliveRef={alive} shape={gravity === '1g' ? 0 : 0.85} stretch={gravity === '1g' ? 1 : 0.3}
                 width={0.9} flicker={style.flicker} sooty={gravity === '1g' ? 0.9 : 0.15} dim={gravity === '1g' ? 1 : 0.6}
                 intensity={style.intensity} scale={0.75} position={[0, 0.58, 0]} castLight />
    </group>
  )
}

function DropletSample({ anim, fiber, lit, gravity, fuel, style }: {
  anim: NonNullable<SpecimenProps['droplet']>; fiber: boolean; lit: boolean; gravity: SpecimenProps['gravity']; fuel?: string | null; style: Style
}) {
  const drop = useRef<THREE.Mesh>(null)
  const flame = useRef<THREE.Group>(null)
  const alive = useRef(1)
  const r0 = THREE.MathUtils.clamp(anim.d0 / 12, 0.08, 0.4)
  // Methanol burns with an almost invisible blue flame; heptane and dodecane
  // are sootier and brighter.
  const isMethanol = (fuel ?? '').toLowerCase().includes('methanol')
  const sooty = gravity === '1g' ? 0.9 : isMethanol ? 0.04 : 0.45
  const dim = isMethanol ? 0.5 : 0.85
  useFrame((state) => {
    const T = anim.burnTime && anim.burnTime > 0 ? anim.burnTime : 8
    const dEnd = anim.dExt ?? anim.d0 * 0.4
    const K = (anim.d0 ** 2 - dEnd ** 2) / T
    const playback = Math.max(1, T / 9)
    const cycle = T + 2.2
    const t = ((state.clock.elapsedTime * playback) % (cycle * playback)) / playback
    const d = Math.sqrt(Math.max(0, anim.d0 ** 2 - K * Math.min(t, T)))
    const s = d / anim.d0
    alive.current = t < T ? Math.min(1, t * 3) : 0      // ignites over a third of a second
    if (drop.current) drop.current.scale.setScalar(s)
    if (flame.current) flame.current.scale.setScalar(Math.max(0.001, s))
  })
  return (
    <group>
      {fiber && (
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.004, 0.004, 2.2, 6]} /><meshStandardMaterial color="#8C9AB0" /></mesh>
      )}
      <mesh ref={drop}><sphereGeometry args={[r0, 40, 28]} />
        <meshPhysicalMaterial color="#BFE4FA" roughness={0.06} transmission={0.85} thickness={0.4} ior={1.37} /></mesh>
      <group ref={flame}>
        <FlameMesh lit={lit} aliveRef={alive} shape={gravity === '1g' ? 0.1 : 1} stretch={gravity === '1g' ? 1 : 0.3}
                   width={1} flicker={gravity === '1g' ? 1 : 0.05} sooty={sooty} dim={dim} intensity={style.intensity}
                   scale={(r0 * 3.4) / 0.18} position={[0, -r0 * 0.75, 0]} castLight />
      </group>
    </group>
  )
}

function BurnerSample({ kind, sizeMm, lit, gravity, style }: { kind: BurnerKind; sizeMm?: number | null; lit: boolean; gravity: SpecimenProps['gravity']; style: Style }) {
  const g1 = gravity === '1g'
  if (kind === 'sphere') {
    // CFI-G / ACME: a porous spherical burner; in microgravity the flame is a
    // sphere around it.
    return (
      <group>
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.03, 0.03, 1.0, 10]} /><meshStandardMaterial color="#8A94A6" metalness={0.5} /></mesh>
        <mesh><sphereGeometry args={[0.2, 40, 28]} /><meshStandardMaterial color="#C8B79B" roughness={0.95} /></mesh>
        <FlameMesh lit={lit} shape={g1 ? 0.1 : 1} stretch={g1 ? 1 : 0.3} width={1.05} flicker={g1 ? 1 : 0.06}
                   sooty={g1 ? 0.8 : 0.3} dim={0.85} intensity={style.intensity} scale={g1 ? 1.8 : 2.9}
                   position={[0, g1 ? -0.1 : -0.42, 0]} castLight />
      </group>
    )
  }
  if (kind === 'disk') {
    // ACME BRE: a flat porous disk burner (25 or 50 mm); a dome-shaped flame.
    const rad = THREE.MathUtils.clamp(((sizeMm ?? 25) / 50) * 0.5, 0.25, 0.5)
    return (
      <group position={[0, -0.25, 0]}>
        <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[rad, rad, 0.1, 48]} /><meshStandardMaterial color="#C8B79B" roughness={0.95} /></mesh>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 12]} /><meshStandardMaterial color="#8A94A6" metalness={0.5} /></mesh>
        <FlameMesh lit={lit} shape={g1 ? 0.1 : 0.75} stretch={g1 ? 1 : 0.45} width={g1 ? 1 : 1.25} flicker={g1 ? 1 : 0.06}
                   sooty={g1 ? 0.85 : 0.35} dim={0.85} intensity={style.intensity} scale={rad * 4}
                   position={[0, g1 ? 0 : -rad * 0.6, 0]} castLight />
      </group>
    )
  }
  // SPICE / E-FIELD: fuel issues from a nozzle into co-flowing air; a long jet
  // flame. Microgravity jet flames are wider, round-tipped and sooty.
  return (
    <group position={[0, -0.55, 0]}>
      <mesh><cylinderGeometry args={[0.035, 0.05, 0.9, 20]} /><meshStandardMaterial color="#B4BDCB" metalness={0.4} roughness={0.4} /></mesh>
      <FlameMesh lit={lit} shape={0} stretch={g1 ? 1 : 1.3} width={g1 ? 0.75 : 1.05} flicker={g1 ? 1 : 0.08}
                 sooty={0.9} dim={1} intensity={style.intensity} scale={1.5} position={[0, 0.45, 0]} castLight />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Scene
// -----------------------------------------------------------------------------
function Scene(props: SpecimenProps) {
  const { shape, dims, gravity, flowCmS, direction, o2, lit, ending, droplet, fiber, burner, burnerSizeMm, fuel } = props
  const clock = useSpreadClock(lit && gravity !== 'none', ending)
  const style = flameStyle(gravity, direction, flowCmS, o2)
  const on = lit && gravity !== 'none'
  const solid = !['droplet', 'burner'].includes(shape)
  return (
    <>
      <Enclosure label={solid ? 'Flow duct (schematic)' : 'Combustion chamber (schematic)'} w={2.2} h={2.4} d={1.4} />
      {solid && flowCmS != null && flowCmS > 0 && <Airflow flowCmS={flowCmS} direction={direction} height={2.0} />}
      {gravity === '1g' && (
        <Html position={[1.15, 0.9, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#cbd5e1', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif' }}>g ↓</div>
        </Html>
      )}
      {(shape === 'fabric' || shape === 'sheet' || shape === 'film' || shape === 'slab' || shape === 'composite sheet') &&
        <SheetSample dims={dims} shape={shape} style={style} lit={on} clock={clock} />}
      {shape === 'rod' && <RodSample dims={dims} style={style} lit={on} clock={clock} />}
      {(shape === 'sphere' || shape === 'spherical section') && <SphereSample dims={dims} half={shape === 'spherical section'} style={style} lit={on} clock={clock} />}
      {shape === 'candle' && <CandleSample style={style} lit={on} gravity={gravity} clock={clock} />}
      {shape === 'droplet' && droplet && <DropletSample anim={droplet} fiber={!!fiber} lit={on} gravity={gravity} fuel={fuel} style={style} />}
      {shape === 'burner' && <BurnerSample kind={burner ?? 'jet'} sizeMm={burnerSizeMm} lit={on} gravity={gravity} style={style} />}
    </>
  )
}

export default function Specimen(props: SpecimenProps) {
  return (
    <Canvas camera={{ position: [2.4, 0.9, 3.6], fov: 40 }} dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}>
      <color attach="background" args={['#0B0F17']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-3, 1, -3]} intensity={0.25} color="#9fb8ff" />
      <Scene {...props} />
      <OrbitControls enablePan={false} minDistance={2.2} maxDistance={8} target={[0, 0, 0]} makeDefault />
    </Canvas>
  )
}
