// =============================================================================
//  3D WORKSPACE  (the middle of the Experiment Lab)
// =============================================================================
//  A CAD-style stage: grid floor, soft lighting, the sample in the middle.
//
//  WHAT IS DATA AND WHAT IS ILLUSTRATION
//  -------------------------------------
//  Data:  the sample's SHAPE and its recorded size (rod diameter, film
//         thickness, sphere diameter, droplet diameter); the airflow SPEED and
//         DIRECTION (white particles); whether a droplet sat on a fibre; the
//         droplet shrinking from its recorded initial diameter to its recorded
//         extinction diameter over the recorded burn time.
//  Illustration: the flame itself (colour, flicker, standoff distance). It is
//         labelled "illustrative" on screen.
//
//  Sizes are drawn so each sample is visible, not to one common scale -- a
//  0.1 mm film and a 94 cm fabric sheet cannot share a screen. The recorded
//  size is printed beside the model.
// =============================================================================

import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import FlameMesh from './FlameMesh'

export type SampleShape =
  | 'rod' | 'sphere' | 'slab' | 'film' | 'fabric' | 'sheet' | 'composite sheet'
  | 'candle' | 'spherical section' | 'droplet' | 'burner'

export type GravityMode = '0g' | '1g' | 'none'

export interface DropletAnimation {
  d0: number             // recorded initial diameter, mm
  dExt: number | null    // recorded visible-extinction diameter, mm
  burnTime: number | null
}

export interface WorkspaceProps {
  shape: SampleShape
  dims: { diameter_mm?: number | null; thickness_mm?: number | null; width_mm?: number | null }
  lit: boolean
  gravity: GravityMode
  intensity: number
  soot: number
  /** Recorded airflow in cm/s (0 or null = none recorded). */
  flowCmS: number | null
  direction: 'concurrent' | 'opposed' | 'stagnation' | null
  droplet?: DropletAnimation | null
  fiber?: boolean
}

const SURFACE = { color: '#C9D2E0', roughness: 0.55, metalness: 0.05 }

/** The sample, sized from its recorded dimensions. */
function Sample({ shape, dims }: { shape: SampleShape; dims: WorkspaceProps['dims'] }) {
  const d = dims.diameter_mm ?? null
  const th = dims.thickness_mm ?? null
  const w = dims.width_mm ?? null

  switch (shape) {
    case 'rod': {
      // Rods were 6.35, 9.525 and 12.7 mm; radius scales in proportion.
      const r = THREE.MathUtils.clamp(((d ?? 9.5) / 12.7) * 0.24, 0.09, 0.3)
      return (
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[r, r, 1.1, 32]} />
          <meshStandardMaterial {...SURFACE} />
        </mesh>
      )
    }
    case 'sphere': {
      const r = THREE.MathUtils.clamp(((d ?? 20) / 20) * 0.38, 0.15, 0.6)
      return (
        <mesh position={[0, -r * 0.2, 0]}>
          <sphereGeometry args={[r, 40, 28]} />
          <meshStandardMaterial {...SURFACE} />
        </mesh>
      )
    }
    case 'spherical section': {
      const r = THREE.MathUtils.clamp(((d ?? 40) / 40) * 0.55, 0.2, 0.6)
      return (
        <mesh position={[0, -0.35, 0]}>
          <sphereGeometry args={[r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial {...SURFACE} side={THREE.DoubleSide} />
        </mesh>
      )
    }
    case 'film':
    case 'slab': {
      const width = THREE.MathUtils.clamp(((w ?? 20) / 20) * 0.9, 0.35, 1.2)
      // Films are 0.1-0.4 mm: drawn thicker than scale so they are visible.
      const thick = shape === 'film' ? 0.025 : THREE.MathUtils.clamp(((th ?? 3) / 20) * 0.9, 0.04, 0.3)
      return (
        <mesh position={[0, -0.55, 0]}>
          <boxGeometry args={[width, 1.1, thick]} />
          <meshStandardMaterial {...SURFACE} />
        </mesh>
      )
    }
    case 'fabric':
    case 'sheet':
    case 'composite sheet': {
      const colour = shape === 'fabric' ? '#D9CBA8' : shape === 'sheet' ? '#B9C3D3' : '#C9B79A'
      return (
        <mesh position={[0, -0.6, 0]}>
          <boxGeometry args={[0.7, 1.2, 0.02]} />
          <meshStandardMaterial color={colour} roughness={0.9} />
        </mesh>
      )
    }
    case 'candle':
      return (
        <group position={[0, -0.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.16, 1.0, 32]} />
            <meshStandardMaterial color="#EDE6D3" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
            <meshStandardMaterial color="#2A2420" />
          </mesh>
        </group>
      )
    case 'burner':
      return (
        <group position={[0, -0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.12, 0.16, 1.0, 32]} />
            <meshStandardMaterial color="#B4BDCB" roughness={0.4} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.018, 8, 32]} />
            <meshStandardMaterial color="#C9D2E0" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

/** Airflow as white dots streaming through the chamber. Speed follows the
 *  recorded cm/s; direction follows the recorded flow direction. Concurrent
 *  flow travels the way the flame spreads (+x), opposed flow against it (-x),
 *  stagnation flow straight down onto the end of the sample. */
function FlowParticles({ flowCmS, direction }: { flowCmS: number; direction: WorkspaceProps['direction'] }) {
  const COUNT = 260
  const ref = useRef<THREE.Points>(null)
  // Points render as squares unless given a round texture: a small soft disc.
  const dot = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.9)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(c)
  }, [])
  const seeds = useMemo(() => Array.from({ length: COUNT }, () => ({
    a: Math.random(), y: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 2.2,
    jitter: 0.6 + Math.random() * 0.8,
  })), [])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    // 1 cm/s maps to 0.06 scene units per second, capped so 50 cm/s stays readable.
    const speed = Math.min(2.2, 0.08 + flowCmS * 0.06)
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute
    seeds.forEach((s, i) => {
      const travel = ((s.a + t * speed * s.jitter * 0.18) % 1) * 5 - 2.5
      if (direction === 'stagnation') pos.setXYZ(i, s.z * 0.9, 2.2 - (travel + 2.5) * 0.7, s.y * 0.4)
      else pos.setXYZ(i, direction === 'opposed' ? -travel : travel, s.y * 0.75, s.z)
    })
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(COUNT * 3), 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} map={dot} color="#FFFFFF" transparent opacity={0.85} alphaTest={0.05} depthWrite={false} sizeAttenuation />
    </points>
  )
}

/** A droplet that shrinks by the d-squared law between two RECORDED points:
 *  d(t)^2 = d0^2 - K t, with K chosen so d reaches the recorded extinction
 *  diameter at the recorded burn time. The flame shell shrinks with it and
 *  goes out at the extinction diameter, then the cycle repeats. */
function Droplet({ anim, fiber, gravity, intensity, soot, lit }: {
  anim: DropletAnimation; fiber: boolean; gravity: GravityMode; intensity: number; soot: number; lit: boolean
}) {
  const drop = useRef<THREE.Mesh>(null)
  const flame = useRef<THREE.Group>(null)
  const burning = useRef(true)
  const r0 = THREE.MathUtils.clamp(anim.d0 / 10, 0.08, 0.42)   // scene radius at d0

  useFrame((state) => {
    const T = anim.burnTime && anim.burnTime > 0 ? anim.burnTime : 10
    const dEnd = anim.dExt ?? anim.d0 * 0.4
    const K = (anim.d0 ** 2 - dEnd ** 2) / T
    // Play real time faster for long burns so the loop stays watchable.
    const playback = Math.max(1, T / 8)
    const cycle = T + 2                                // 2 s pause after going out
    const t = ((state.clock.elapsedTime * playback) % (cycle * playback)) / playback
    const tt = Math.min(t, T)
    const d = Math.sqrt(Math.max(0, anim.d0 ** 2 - K * tt))
    const s = d / anim.d0
    burning.current = t < T
    if (drop.current) drop.current.scale.setScalar(s)
    if (flame.current) {
      flame.current.scale.setScalar(Math.max(0.0001, s))
      flame.current.visible = burning.current
    }
  })

  return (
    <group position={[0, -0.1, 0]}>
      {fiber && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          {/* Real fibres were tens of micrometres; drawn as a hairline. */}
          <cylinderGeometry args={[0.004, 0.004, 2.4, 6]} />
          <meshStandardMaterial color="#8C9AB0" />
        </mesh>
      )}
      <mesh ref={drop}>
        <sphereGeometry args={[r0, 40, 28]} />
        <meshPhysicalMaterial color="#BFE4FA" roughness={0.06} transmission={0.85} thickness={0.4} ior={1.37} />
      </mesh>
      <group ref={flame}>
        {/* Flame standoff is not in the tables; drawn at about 3.5x the droplet radius. */}
        <FlameMesh lit={lit && gravity !== 'none'} gravityOn={gravity === '1g'} intensity={intensity}
                   soot={soot} scale={(r0 * 3.5) / 0.18} position={[0, -r0 * 0.6, 0]} />
      </group>
    </group>
  )
}

export default function Workspace(props: WorkspaceProps) {
  const { shape, dims, lit, gravity, intensity, soot, flowCmS, direction, droplet, fiber } = props
  const flameBase: [number, number, number] =
    shape === 'rod' || shape === 'film' || shape === 'slab' || shape === 'burner' ? [0, 0, 0]
    : shape === 'sphere' ? [0, -0.1, 0]
    : shape === 'candle' ? [0, -0.02, 0]
    : shape === 'spherical section' ? [0, -0.2, 0]
    : [0, 0, 0]
  const flameScale = shape === 'sphere' || shape === 'spherical section' ? 2.0 : 1.6
  const lean = !flowCmS || direction === 'stagnation' || !direction ? 0
    : (direction === 'opposed' ? -1 : 1) * Math.min(1, flowCmS / 25)

  return (
    <Canvas camera={{ position: [3.4, 1.7, 4.4], fov: 38 }} dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#080C14']} />
      <fog attach="fog" args={['#080C14', 7, 18]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 7, 4]} intensity={0.9} />
      <directionalLight position={[-4, 2, -3]} intensity={0.18} color="#29ABE2" />

      <Suspense fallback={null}>
        {shape === 'droplet' && droplet ? (
          <Droplet anim={droplet} fiber={!!fiber} gravity={gravity} intensity={intensity} soot={soot} lit={lit} />
        ) : (
          <>
            <Sample shape={shape} dims={dims} />
            <FlameMesh lit={lit && gravity !== 'none'} gravityOn={gravity === '1g'} intensity={intensity}
                       flow={lean} soot={soot} scale={flameScale} position={flameBase} />
          </>
        )}
        {!!flowCmS && flowCmS > 0 && <FlowParticles flowCmS={flowCmS} direction={direction} />}
      </Suspense>

      <Grid position={[0, -1.3, 0]} args={[22, 22]} cellSize={0.4} cellThickness={0.6}
            cellColor="#1E2D44" sectionSize={2} sectionThickness={1.1} sectionColor="#29ABE2"
            fadeDistance={22} fadeStrength={1.2} infiniteGrid />

      <OrbitControls enablePan={false} minDistance={2.2} maxDistance={9} minPolarAngle={0.2}
                     maxPolarAngle={Math.PI / 1.9} target={[0, -0.35, 0]} makeDefault />
    </Canvas>
  )
}
