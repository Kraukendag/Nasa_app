// =============================================================================
//  SPECIMEN  (the 3D view in the Experiment Lab)
// =============================================================================
//  The recorded sample in its apparatus, burning the way the matching NASA
//  tests burned. Every flame is VOLUMETRIC (src/three/volumeFlame.ts) and its
//  behaviour comes from src/lab/regime.ts, where each behaviour carries the
//  NASA evidence for it:
//
//    sheet, fabric, film, slab  lit at the top; a flame front spreads down
//                               and engulfs the sample, or, for thin fuels at
//                               very low airflow, breaks into FLAMELETS that
//                               eat branching char fingers (and re-form a
//                               front if the airflow is turned back up)
//    rod                        a cap on the tip; quench (shrinks to a blue
//                               hemisphere and oscillates) or blow-off (a hole
//                               opens at the tip)
//    sphere, candle             a shell around the sample
//    droplet                    a shell shrinking with the droplet; extinction
//                               at the recorded diameter, disruption, or a
//                               faint cool-flame glow after visible extinction
//    gas burners                sphere, disk or jet; a faint cool flame where
//                               CFI-G records one
//
//  TIMING. One timeline per run (`timeline` ref, owned by the Lab so it can
//  show play / pause / scrub). Everything is a pure function of time t, so
//  dragging the slider backwards works, and nothing jumps when settings change
//  (the Lab restarts the run instead).
//
//  Colour, flicker and exact flame size are illustration; shape, orientation,
//  behaviour and ending follow the data.
// =============================================================================

import { Html, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import VolumeFlame from './VolumeFlame'
import { lowPower, startQuality, useInView } from '../three/perf'
import type { FlameSource } from '../three/volumeFlame'
import type { Regime } from '../lab/regime'

export type SampleShape = 'rod' | 'sphere' | 'slab' | 'film' | 'fabric' | 'sheet' | 'composite sheet'
  | 'candle' | 'spherical section' | 'droplet' | 'burner'
export type BurnerKind = 'sphere' | 'disk' | 'jet'
export type Ending = 'full' | 'partial' | 'brief' | 'blowoff' | 'none'
type Dir = 'concurrent' | 'opposed' | 'stagnation' | null

/** The run's clock, shared with the Lab's play / pause / scrub controls. */
export interface Timeline { t: number; playing: boolean; duration: number; reignite: number | null; phase: string }
export const newTimeline = (): Timeline => ({ t: 0, playing: false, duration: 1, reignite: null, phase: 'Ready' })

export interface SpecimenProps {
  shape: SampleShape
  dims: { diameter_mm?: number | null; thickness_mm?: number | null; width_mm?: number | null }
  gravity: '0g' | '1g' | 'none'
  flowCmS: number | null
  direction: Dir
  o2: number | null
  lit: boolean
  regime: Regime
  timeline: MutableRefObject<Timeline>
  fuel?: string | null
  droplet?: { d0: number; dExt: number | null; burnTime: number | null } | null
  fiber?: boolean
  burner?: BurnerKind
  burnerSizeMm?: number | null
  /** Changing this restarts the run (new conditions). */
  runKey?: string
  /** Small label drawn in the scene, e.g. "0 g" / "1 g" in the split view. */
  tag?: string
}

// -----------------------------------------------------------------------------
//  Time
// -----------------------------------------------------------------------------
const IGN = 1.2          // igniter glowing at the top
const SPREAD_S = 11      // seconds of animation for a full spread
const END_S = 2.2        // the ending (fade, quench, blow-off)
const stopAtFor = (e: Ending) => (e === 'partial' ? 0.55 : e === 'brief' ? 0.05 : e === 'blowoff' ? 0.4 : e === 'none' ? 0 : 1)

interface Phase { p: number; alive: number; igniter: number; ended: boolean; endU: number; travel: number }
function phaseAt(t: number, ending: Ending): Phase {
  const stopAt = stopAtFor(ending)
  const travel = SPREAD_S * Math.max(0.05, stopAt)
  const igniter = t < IGN ? 1 : Math.max(0, 1 - (t - IGN) * 2)
  if (ending === 'none') return { p: 0, alive: 0, igniter, ended: t > IGN, endU: 1, travel }
  const p = Math.min(stopAt, Math.max(0, t - IGN * 0.6) / SPREAD_S)
  const ended = t > IGN + travel
  const endU = ended ? Math.min(1, (t - IGN - travel) / END_S) : 0
  const alive = t < IGN * 0.6 ? 0 : ended ? 1 - endU : Math.min(1, (t - IGN * 0.6) * 3)
  return { p, alive, igniter, ended, endU, travel }
}
const durationFor = (ending: Ending) => IGN + SPREAD_S * Math.max(0.05, stopAtFor(ending)) + END_S + 0.4

/** Seeded random numbers, so a run is the same every time (and scrubbable). */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// -----------------------------------------------------------------------------
//  Shared pieces: airflow, apparatus outline, igniter
// -----------------------------------------------------------------------------
function Airflow({ flowCmS, direction, height }: { flowCmS: number; direction: Dir; height: number }) {
  const COUNT = lowPower ? 70 : 200
  const ref = useRef<THREE.Points>(null)
  const dot = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32
    const g = c.getContext('2d')!; const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c)
  }, [])
  const seeds = useMemo(() => Array.from({ length: COUNT }, () => ({ a: Math.random(), x: (Math.random() - 0.5) * 1.9, z: (Math.random() - 0.5) * 1.1, j: 0.7 + Math.random() * 0.6 })), [])
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
      <pointsMaterial size={0.04} map={dot} color="#FFFFFF" transparent opacity={0.55} alphaTest={0.05} depthWrite={false} />
    </points>
  )
}

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

function Igniter({ ph, y, w }: { ph: MutableRefObject<Phase>; y: number; w: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (mat.current) mat.current.emissiveIntensity = 3 * ph.current.igniter })
  return (
    <mesh position={[0, y + 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.012, 0.012, w, 8]} />
      <meshStandardMaterial ref={mat} color="#8a8f99" emissive="#ff6a1a" emissiveIntensity={0} metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

const SAMPLE = { color: '#CBD3DF', roughness: 0.55, metalness: 0.04 }

// -----------------------------------------------------------------------------
//  Sheet-like samples: front or flamelets, with char painted onto the sample
// -----------------------------------------------------------------------------
interface Flamelet { id: number; x: number; y: number }

/** Pre-simulate the flamelets for the whole run (fixed steps, seeded), so the
 *  pattern is identical every time and the slider can scrub through it. */
function simulateFlamelets(W: number, H: number, travel: number, seed: number): { dt: number; steps: Flamelet[][]; breakP: number } {
  const r = rng(seed)
  const dt = 0.05
  const breakP = 0.12
  const n0 = THREE.MathUtils.clamp(Math.round(W / 0.12), 3, 10)
  const minSep = W / (n0 * 1.6)
  const speed = H / SPREAD_S * 0.85
  let id = 0
  let live: Flamelet[] = Array.from({ length: n0 }, (_, i) => ({ id: id++, x: -W / 2 + (W * (i + 0.5)) / n0 + (r() - 0.5) * minSep * 0.4, y: 0 }))
  const steps: Flamelet[][] = []
  const total = Math.ceil(travel / dt) + 1
  for (let s = 0; s < total; s++) {
    live = live.map((f) => ({ ...f, y: f.y + speed * dt * (0.8 + r() * 0.4), x: THREE.MathUtils.clamp(f.x + (r() - 0.5) * 0.02, -W / 2 + 0.01, W / 2 - 0.01) }))
    // Births: a flamelet with room on one side splits (a branch in the char).
    const born: Flamelet[] = []
    for (const f of live) {
      const near = Math.min(...live.filter((g) => g !== f).map((g) => Math.abs(g.x - f.x)), 9)
      if (near > minSep * 1.8 && r() < 0.35 * dt && live.length + born.length < 14) {
        const side = r() < 0.5 ? -1 : 1
        born.push({ id: id++, x: THREE.MathUtils.clamp(f.x + side * minSep * 0.7, -W / 2 + 0.01, W / 2 - 0.01), y: f.y })
      }
    }
    live = live.concat(born)
    // Deaths: a flamelet hemmed in by a neighbour is starved of oxygen.
    live = live.filter((f) => !live.some((g) => g !== f && g.id < f.id && Math.abs(g.x - f.x) < minSep * 0.55 && Math.abs(g.y - f.y) < 0.05) && r() > 0.04 * dt)
    if (!live.length) live = [{ id: id++, x: (r() - 0.5) * W * 0.6, y: steps.length ? steps[steps.length - 1][0]?.y ?? 0 : 0 }]
    steps.push(live)
  }
  return { dt, steps, breakP }
}

function SheetSample({ p }: { p: Scenep }) {
  const { dims, shape, regime, tl, g1, dir, ph } = p
  const H = 1.5, top = H / 2
  const W = THREE.MathUtils.clamp(((dims.width_mm ?? 20) / 20) * 0.75, 0.4, 1.2)
  const thick = shape === 'slab' ? THREE.MathUtils.clamp(((dims.thickness_mm ?? 3) / 10) * 0.3, 0.05, 0.3) : 0.02
  const fingering = regime.behaviour === 'fingering' && !g1
  const travel = phaseAt(0, regime.ending).travel
  const sim = useMemo(() => (fingering ? simulateFlamelets(W, H, travel, 7 + Math.round(W * 100)) : null), [fingering, W, travel])
  const sources = useRef<FlameSource[]>([])
  const live = useRef<{ sooty?: number; dim?: number; flicker?: number }>({})

  // The sample's appearance is painted on canvases: char where it burned,
  // and a glowing ember edge at the flame.
  const { charTex, emberTex, charCtx, emberCtx } = useMemo(() => {
    const mk = () => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; return c }
    const a = mk(), b = mk()
    const t1 = new THREE.CanvasTexture(a), t2 = new THREE.CanvasTexture(b)
    t1.colorSpace = THREE.SRGBColorSpace
    return { charTex: t1, emberTex: t2, charCtx: a.getContext('2d')!, emberCtx: b.getContext('2d')! }
  }, [])
  const painted = useRef(-1)
  const base = shape === 'fabric' ? '#D9CBA8' : shape === 'composite sheet' ? '#C9B79A' : shape === 'film' ? '#D6E0EA' : '#CBD3DF'
  const char = shape === 'film' ? '#6E6A66' : '#231E1B'
  const px = (x: number) => ((x + W / 2) / W) * 128
  const py = (yDown: number) => (yDown / H) * 256

  const lastKey = useRef('')
  useFrame(() => {
    const t = tl.current.t
    const f = ph.current
    const yFront = f.p * H
    // Redraw only when something visible changed (phones choked on uploading
    // two canvases every frame): front row, flamelet step, brightness steps.
    const re = tl.current.reignite
    const key = sim
      ? `${Math.floor(Math.max(0, (t - IGN * 0.6) - sim.breakP * SPREAD_S) / sim.dt)}|${Math.round(f.p * 256)}|${Math.round(f.alive * 12)}|${re != null && t > re ? Math.round(Math.min(1, (t - re) / 1.6) * 12) : 0}`
      : `${Math.round(f.p * 256)}|${Math.round(f.alive * 12)}|${Math.round(f.endU * 12)}`
    if (key === lastKey.current) return
    lastKey.current = key
    const out: FlameSource[] = []
    const ec = emberCtx
    ec.clearRect(0, 0, 128, 256)

    if (!sim) {
      // ---- A continuous front -------------------------------------------
      charCtx.fillStyle = base; charCtx.fillRect(0, 0, 128, 256)
      charCtx.fillStyle = char; charCtx.fillRect(0, 0, 128, py(yFront))
      if (f.alive > 0.05) { ec.fillStyle = `rgba(255,120,40,${0.9 * f.alive})`; ec.fillRect(0, py(yFront) - 2, 128, 4) }
      const axis: [number, number, number] = g1 ? [0, 1, 0] : dir === 'concurrent' ? [0, -1, 0] : [0, 1, 0]
      out.push({ pos: [0, top - yFront, 0], radius: 0.11, segment: W / 2 - 0.04, axis,
        stretch: g1 ? 1.6 : dir === 'concurrent' ? 0.9 : dir === 'opposed' ? 0.25 : 0.4,
        shell: g1 ? 0.1 : 0.3, power: f.alive * 1.2 * (regime.ending === 'blowoff' && f.ended ? 1 - f.endU : 1) })
      if (regime.ending === 'blowoff' && f.ended) out[0].pos[1] -= f.endU * 0.4   // lifted off downstream
      painted.current = -1
    } else {
      // ---- Front, then flamelets --------------------------------------------
      const breakY = sim.breakP * H
      const tSince = Math.max(0, (t - IGN * 0.6) - sim.breakP * SPREAD_S)
      const step = Math.min(sim.steps.length - 1, Math.floor(tSince / sim.dt))
      const broken = f.p >= sim.breakP
      if (!broken || step < painted.current || painted.current < 0) {
        charCtx.fillStyle = base; charCtx.fillRect(0, 0, 128, 256)
        charCtx.fillStyle = char; charCtx.fillRect(0, 0, 128, py(Math.min(yFront, breakY)))
        painted.current = broken ? -1 : -1
      }
      if (broken) {
        // Paint every flamelet trail from the last painted step to now.
        const from = Math.max(0, painted.current + 1)
        charCtx.fillStyle = char
        for (let s = from; s <= step; s++) for (const fl of sim.steps[s]) {
          charCtx.beginPath(); charCtx.arc(px(fl.x), py(breakY + fl.y), (0.035 / W) * 128, 0, Math.PI * 2); charCtx.fill()
        }
        painted.current = step
        const flames = sim.steps[step]
        const u = re != null && t > re ? Math.min(1, (t - re) / 1.6) : 0
        const meanY = flames.reduce((a, b) => a + b.y, 0) / Math.max(1, flames.length)
        for (const fl of flames.slice(0, 14)) {
          ec.fillStyle = `rgba(90,150,255,${0.9 * f.alive})`
          ec.beginPath(); ec.arc(px(fl.x), py(breakY + fl.y), 3, 0, Math.PI * 2); ec.fill()
          out.push({ pos: [fl.x, top - breakY - fl.y, 0], radius: 0.05 * (1 + 1.5 * u), stretch: 0.15, shell: 0.6,
            axis: dir === 'concurrent' ? [0, -1, 0] : [0, 1, 0], power: f.alive * 0.9 })
        }
        // Airflow turned back up: the flamelets flare up and re-form a front.
        if (u > 0) out.push({ pos: [0, top - breakY - meanY, 0], radius: 0.08, segment: W / 2 - 0.04, axis: [0, 1, 0], stretch: 0.6, shell: 0.3, power: u * f.alive })
      } else if (f.alive > 0.05) {
        ec.fillStyle = `rgba(255,120,40,${0.9 * f.alive})`; ec.fillRect(0, py(yFront) - 2, 128, 4)
        out.push({ pos: [0, top - yFront, 0], radius: 0.07, segment: W / 2 - 0.04, axis: [0, 1, 0], stretch: 0.3, shell: 0.4, power: f.alive })
      }
    }
    charTex.needsUpdate = true; emberTex.needsUpdate = true
    sources.current = out
    live.current = { sooty: g1 ? 0.9 : sim ? 0.05 : 0.25 }
  })

  return (
    <group>
      <mesh><boxGeometry args={[W, H, thick]} />
        <meshStandardMaterial map={charTex} emissiveMap={emberTex} emissive="#ffffff" emissiveIntensity={1.4} roughness={0.85} /></mesh>
      <Igniter ph={ph} y={top} w={W} />
      <VolumeFlame sources={sources} box={[W + 0.5, g1 ? 1.5 : 0.9, 0.55]} flicker={g1 ? 1 : 0.1} sooty={g1 ? 0.9 : 0.25}
                   dim={g1 ? 1 : 0.85} quality={p.quality} live={live} light />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Rod: a cap on the tip; quench or blow-off at the end
// -----------------------------------------------------------------------------
function RodSample({ p }: { p: Scenep }) {
  const { dims, regime, g1, ph, tl } = p
  const r = THREE.MathUtils.clamp(((dims.diameter_mm ?? 9.5) / 12.7) * 0.2, 0.07, 0.24)
  const H = 1.4, top = H / 2
  const rodRef = useRef<THREE.Mesh>(null)
  const sources = useRef<FlameSource[]>([])
  const live = useRef<{ sooty?: number; dim?: number; flicker?: number }>({})
  useFrame(() => {
    const f = ph.current
    const t = tl.current.t
    const tip = top - f.p * H * 0.5                 // the end regresses as it burns
    if (rodRef.current) { const len = H / 2 + tip; rodRef.current.scale.y = Math.max(0.01, len / H); rodRef.current.position.y = tip - len / 2 }
    const out: FlameSource[] = []
    let power = f.alive, rad = r * 1.7, sooty = g1 ? 0.9 : 0.35
    if (!g1 && regime.quench && f.ended) {
      // "the flame shrinks to a hemispherical blue flame and oscillates with
      //  increasing amplitude just before going out" (BASS-II report p. 64)
      const u = f.endU
      rad *= 1 - 0.5 * u
      sooty = 0.35 * (1 - Math.min(1, u * 2))
      power = (1 - u * u) * (1 + 0.7 * u * Math.sin(t * 14))
    }
    const hole = !g1 && regime.holeBlowoff && f.ended ? f.endU : 0
    if (g1) out.push({ pos: [0, tip + r * 0.2, 0], radius: r * 1.5, axis: [0, 1, 0], stretch: 1.8, shell: 0.1, power })
    else {
      // centre of the cap: the stagnation region, where a blow-off hole opens
      out.push({ pos: [0, tip + r * 0.45, 0], radius: rad * 0.75, axis: [0, -1, 0], stretch: 0.3, shell: 0.65, power: power * (1 - Math.min(1, hole * 2.5)) })
      // the cap's skirt around the tip, carried downstream along the rod
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        out.push({ pos: [Math.cos(a) * r * 1.05, tip - hole * 0.5, Math.sin(a) * r * 1.05], radius: rad * 0.42, axis: [0, -1, 0], stretch: 0.5, shell: 0.55, power: power * (1 - hole) * 0.55 })
      }
    }
    sources.current = out
    live.current = { sooty }
  })
  return (
    <group>
      <mesh ref={rodRef}><cylinderGeometry args={[r, r, H, 40]} /><meshStandardMaterial {...SAMPLE} /></mesh>
      <Igniter ph={ph} y={top} w={r * 3} />
      <VolumeFlame sources={sources} box={[r * 6 + 0.4, g1 ? 1.4 : 0.9, r * 6 + 0.4]} flicker={g1 ? 1 : 0.08}
                   sooty={g1 ? 0.9 : 0.35} dim={g1 ? 1 : 0.85} quality={p.quality} live={live} light />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Sphere / spherical section and candle: a shell around the sample
// -----------------------------------------------------------------------------
function SphereSample({ p, half }: { p: Scenep; half: boolean }) {
  const { dims, g1, ph } = p
  const R = THREE.MathUtils.clamp(((dims.diameter_mm ?? 20) / 20) * 0.36, 0.16, 0.6)
  const sources = useRef<FlameSource[]>([])
  const charMat = useRef<THREE.MeshStandardMaterial>(null)
  const thetaMax = half ? Math.PI / 2 : Math.PI
  useFrame(() => {
    const f = ph.current
    const th = Math.max(0.15, f.p * thetaMax)
    const yf = R * Math.cos(th)
    const out: FlameSource[] = []
    if (g1) out.push({ pos: [0, yf, 0], radius: R * 0.9, axis: [0, 1, 0], stretch: 1.6, shell: 0.1, power: f.alive })
    else {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        out.push({ pos: [(R + 0.03) * Math.sin(th) * Math.cos(a), yf, (R + 0.03) * Math.sin(th) * Math.sin(a)], radius: R * 0.5, axis: [0, 1, 0], stretch: 0.2, shell: 0.6, power: f.alive * 0.55 })
      }
      // once engulfed, a shell around the whole sample
      out.push({ pos: [0, 0, 0], radius: R * 1.35, axis: [0, 1, 0], stretch: 0.05, shell: 0.85, power: f.alive * THREE.MathUtils.smoothstep(f.p, 0.5, 1) })
    }
    sources.current = out
    if (charMat.current) charMat.current.color.setRGB(0.8 - 0.65 * f.p, 0.83 - 0.68 * f.p, 0.87 - 0.72 * f.p)
  })
  const geo = half ? <sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /> : <sphereGeometry args={[R, 48, 32]} />
  return (
    <group>
      <mesh>{geo}<meshStandardMaterial ref={charMat} roughness={0.7} side={THREE.DoubleSide} /></mesh>
      <Igniter ph={ph} y={R} w={R * 0.8} />
      <VolumeFlame sources={sources} box={[R * 3.4, g1 ? R * 4.5 : R * 3.4, R * 3.4]} flicker={g1 ? 1 : 0.08}
                   sooty={g1 ? 0.9 : 0.2} dim={g1 ? 1 : 0.8} quality={p.quality} light />
    </group>
  )
}

function CandleSample({ p }: { p: Scenep }) {
  const { g1, ph } = p
  const sources = useRef<FlameSource[]>([])
  useFrame(() => {
    const a = ph.current.alive
    sources.current = [{ pos: [0, 0.32, 0], radius: g1 ? 0.13 : 0.16, axis: [0, 1, 0], stretch: g1 ? 2.2 : 0.1, shell: g1 ? 0.1 : 0.8, power: a }]
  })
  return (
    <group position={[0, -0.25, 0]}>
      <mesh><cylinderGeometry args={[0.17, 0.17, 1.0, 40]} /><meshStandardMaterial color="#EDE6D3" roughness={0.7} /></mesh>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.012, 0.012, 0.1, 6]} /><meshStandardMaterial color="#2A2420" /></mesh>
      <group position={[0, 0.25, 0]}>
        <VolumeFlame sources={sources} box={[0.8, g1 ? 1.4 : 0.8, 0.8]} flicker={g1 ? 1 : 0.06} sooty={g1 ? 0.95 : 0.15}
                     dim={g1 ? 1 : 0.8} quality={p.quality} light />
      </group>
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Droplet: shrinking shell; extinction, disruption, cool-flame glow
// -----------------------------------------------------------------------------
function DropletSample({ p }: { p: Scenep }) {
  const { g1, ph, regime, droplet, fiber, fuel, tl } = p
  const anim = droplet ?? { d0: 2.5, dExt: null, burnTime: null }
  const drops = useRef<(THREE.Mesh | null)[]>([])
  const sources = useRef<FlameSource[]>([])
  const live = useRef<{ sooty?: number; dim?: number; flicker?: number }>({})
  const r0 = THREE.MathUtils.clamp(anim.d0 / 12, 0.08, 0.4)
  const isMethanol = (fuel ?? '').toLowerCase().includes('methanol')
  // Ends: where the flame goes out, as a share of the starting diameter.
  const extFrac = regime.ending === 'full' ? 0 : anim.dExt && anim.dExt < anim.d0 ? anim.dExt / anim.d0 : 0.45
  useFrame(() => {
    const f = ph.current
    const t = tl.current.t
    // d^2 law: the droplet's area shrinks steadily over the burn.
    const s = Math.sqrt(Math.max(0, 1 - f.p * (1 - extFrac * extFrac)))
    const out: FlameSource[] = []
    const breakUp = regime.disruption && f.p > 0.55 ? Math.min(1, (f.p - 0.55) / 0.3) : 0
    const N = breakUp > 0 ? 4 : 1
    for (let i = 0; i < 4; i++) {
      const m = drops.current[i]
      if (!m) continue
      const a = (i / 4) * Math.PI * 2 + 0.4
      const off = breakUp * 0.5
      m.visible = i < N && s > 0.02
      m.position.set(i === 0 && N === 1 ? 0 : Math.cos(a) * off, i === 0 && N === 1 ? 0 : Math.sin(a) * off * 0.7, 0)
      m.scale.setScalar(N === 1 ? s : s * 0.55)
    }
    // Visible flame; after it goes out, the droplet may keep shrinking with a
    // faint cool-flame glow (cool-flame territory, not observed in the table).
    const hot = f.alive
    for (let i = 0; i < N; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      const off = N === 1 ? 0 : breakUp * 0.5
      out.push({ pos: [Math.cos(a) * off, Math.sin(a) * off * 0.7, 0], radius: r0 * (N === 1 ? 2.6 : 1.5) * Math.max(0.25, s),
        axis: [0, 1, 0], stretch: g1 ? 1.4 : 0.05, shell: g1 ? 0.15 : 1, power: hot * (g1 ? 0.9 : 0.32) * (N === 1 ? 1 : 1 - breakUp * 0.6) })
    }
    if (regime.coolFlameAfter && f.ended) out.push({ pos: [0, 0, 0], radius: r0 * 2.2 * s, axis: [0, 1, 0], stretch: 0, shell: 0.95, power: 0.18 * (1 - f.endU * 0.3) })
    if (regime.coolFlameAfter && f.ended && drops.current[0]) drops.current[0].scale.setScalar(Math.max(0.02, s * (1 - f.endU * 0.4)))
    sources.current = out
    live.current = { sooty: g1 ? 0.9 : isMethanol ? 0.02 : regime.coolFlameAfter && f.ended ? 0 : 0.45, dim: isMethanol ? 0.6 : 0.9 }
    void t
  })
  return (
    <group>
      {fiber && <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.004, 0.004, 2.2, 6]} /><meshStandardMaterial color="#8C9AB0" /></mesh>}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => { drops.current[i] = m }} visible={i === 0}>
          <sphereGeometry args={[r0, 40, 28]} />
          <meshPhysicalMaterial color="#BFE4FA" roughness={0.06} transmission={0.85} thickness={0.4} ior={1.37} />
        </mesh>
      ))}
      <VolumeFlame sources={sources} box={[r0 * 8 + 0.3, g1 ? r0 * 12 : r0 * 8 + 0.3, r0 * 8 + 0.3]} flicker={g1 ? 1 : 0.04}
                   sooty={0.45} dim={0.9} quality={p.quality} live={live} light />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Gas burners
// -----------------------------------------------------------------------------
function BurnerSample({ p }: { p: Scenep }) {
  const { g1, ph, regime, burner = 'jet', burnerSizeMm } = p
  const sources = useRef<FlameSource[]>([])
  const live = useRef<{ sooty?: number; dim?: number; flicker?: number }>({})
  const rad = THREE.MathUtils.clamp(((burnerSizeMm ?? 25) / 50) * 0.5, 0.25, 0.5)
  useFrame(() => {
    const f = ph.current
    const hot = f.alive
    const cool = regime.coolFlameAfter && f.ended ? 0.2 : 0
    const out: FlameSource[] = []
    if (burner === 'sphere') out.push({ pos: [0, 0, 0], radius: g1 ? 0.3 : 0.4, axis: [0, 1, 0], stretch: g1 ? 1.5 : 0.04, shell: g1 ? 0.15 : 1, power: g1 ? hot + cool : (hot + cool) * 0.32 })
    else if (burner === 'disk') {
      out.push({ pos: [0, 0.03, 0], radius: rad * 0.6, axis: [0, 1, 0], stretch: g1 ? 1.4 : 0.15, shell: g1 ? 0.15 : 0.8, power: (hot + cool) * (g1 ? 1 : 0.45) })
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; out.push({ pos: [Math.cos(a) * rad * 0.65, 0.03, Math.sin(a) * rad * 0.65], radius: rad * 0.4, axis: [0, 1, 0], stretch: g1 ? 1.2 : 0.15, shell: 0.6, power: (hot + cool) * 0.6 }) }
    } else out.push({ pos: [0, 0.05, 0], radius: g1 ? 0.12 : 0.17, axis: [0, 1, 0], stretch: g1 ? 2.4 : 2.8, shell: 0.1, power: hot + cool })
    sources.current = out
    live.current = { sooty: cool > 0 ? 0 : g1 ? 0.85 : burner === 'jet' ? 0.85 : 0.3 }
  })
  return (
    <group position={[0, burner === 'jet' ? -0.6 : burner === 'disk' ? -0.25 : 0, 0]}>
      {burner === 'sphere' && <>
        <mesh position={[0, -0.6, 0]}><cylinderGeometry args={[0.03, 0.03, 1.0, 10]} /><meshStandardMaterial color="#8A94A6" metalness={0.5} /></mesh>
        <mesh><sphereGeometry args={[0.2, 40, 28]} /><meshStandardMaterial color="#C8B79B" roughness={0.95} /></mesh>
      </>}
      {burner === 'disk' && <>
        <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[rad, rad, 0.1, 48]} /><meshStandardMaterial color="#C8B79B" roughness={0.95} /></mesh>
        <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 12]} /><meshStandardMaterial color="#8A94A6" metalness={0.5} /></mesh>
      </>}
      {burner === 'jet' && <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.035, 0.05, 0.9, 20]} /><meshStandardMaterial color="#B4BDCB" metalness={0.4} roughness={0.4} /></mesh>}
      <VolumeFlame sources={sources} box={burner === 'jet' ? [0.9, 2.4, 0.9] : [1.5, g1 ? 1.8 : 1.4, 1.5]}
                   flicker={g1 ? 1 : 0.06} sooty={0.5} dim={0.9} quality={p.quality} live={live} light />
    </group>
  )
}

// -----------------------------------------------------------------------------
//  Scene
// -----------------------------------------------------------------------------
interface Scenep extends SpecimenProps { tl: MutableRefObject<Timeline>; ph: MutableRefObject<Phase>; g1: boolean; dir: Dir; quality: number }

function Scene(props: SpecimenProps & { quality: number }) {
  const { shape, gravity, flowCmS, direction, lit, regime, timeline, tag } = props
  const ph = useRef<Phase>(phaseAt(0, regime.ending))
  const g1 = gravity === '1g'
  // Advance the shared clock; derive this frame's phase from it.
  useFrame((_, delta) => {
    const tl = timeline.current
    tl.duration = durationFor(regime.ending)
    // Unlit: hold at the start. ("playing" is left alone: the Ignite button
    // sets it in the same instant the lit prop arrives.)
    if (!lit) tl.t = 0
    else if (tl.playing) { tl.t = Math.min(tl.duration, tl.t + Math.min(delta, 0.1)); if (tl.t >= tl.duration) tl.playing = false }
    ph.current = lit ? phaseAt(tl.t, regime.ending) : { p: 0, alive: 0, igniter: 0, ended: false, endU: 0, travel: 0 }
    const f = ph.current
    tl.phase = !lit ? 'Ready' : tl.t < IGN ? 'Igniting at the top' : !f.ended ? (regime.behaviour === 'fingering' && f.p > 0.12 ? 'Flamelets spreading' : 'Spreading')
      : f.endU < 1 ? (regime.quench ? 'Quenching' : regime.holeBlowoff ? 'Blowing off' : regime.ending === 'full' ? 'Burning out' : 'Going out') : 'Ended'
  })
  const solid = !['droplet', 'burner'].includes(shape)
  const sp: Scenep = { ...props, tl: timeline, ph, g1, dir: direction }
  return (
    <>
      <Enclosure label={solid ? 'Flow duct (schematic)' : 'Combustion chamber (schematic)'} w={2.2} h={2.4} d={1.4} />
      {solid && flowCmS != null && flowCmS > 0 && <Airflow flowCmS={flowCmS} direction={direction} height={2.0} />}
      {(g1 || tag) && (
        <Html position={[0.95, 1.05, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#e2e8f0', fontSize: 13, fontFamily: 'IBM Plex Sans, sans-serif', whiteSpace: 'nowrap' }}>{tag ?? (g1 ? '1 g' : '')}{g1 ? ' · gravity ↓' : ''}</div>
        </Html>
      )}
      {(shape === 'fabric' || shape === 'sheet' || shape === 'film' || shape === 'slab' || shape === 'composite sheet') && <SheetSample p={sp} />}
      {shape === 'rod' && <RodSample p={sp} />}
      {(shape === 'sphere' || shape === 'spherical section') && <SphereSample p={sp} half={shape === 'spherical section'} />}
      {shape === 'candle' && <CandleSample p={sp} />}
      {shape === 'droplet' && <DropletSample p={sp} />}
      {shape === 'burner' && <BurnerSample p={sp} />}
    </>
  )
}

export default function Specimen(props: SpecimenProps) {
  const [quality, setQuality] = useState(startQuality)
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  return (
    <div ref={wrap} className="h-full" role="img"
         aria-label={`3D view: ${props.shape} sample, ${props.gravity === '1g' ? 'normal gravity' : 'microgravity'}, ${props.regime.label}. Illustration; the text below lists the NASA evidence.`}>
      {/* Off-screen or hidden tab: stop rendering entirely (saves phones). */}
      <Canvas frameloop={inView ? 'always' : 'never'} camera={{ position: [2.4, 0.9, 3.6], fov: 40 }}
              dpr={lowPower ? 0.75 : quality < 1 ? 1 : [1, 1.5]}
              gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}>
        <PerformanceMonitor onDecline={() => setQuality((q) => (q > 0.5 ? 0.5 : 0.3))} onIncline={() => setQuality((q) => (lowPower ? Math.min(0.5, q + 0.2) : 1))} />
        <color attach="background" args={['#0B0F17']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={0.8} />
        {!lowPower && <directionalLight position={[-3, 1, -3]} intensity={0.25} color="#9fb8ff" />}
        <Scene key={props.runKey} {...props} quality={quality} />
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={8} target={[0, 0, 0]} makeDefault />
      </Canvas>
    </div>
  )
}
