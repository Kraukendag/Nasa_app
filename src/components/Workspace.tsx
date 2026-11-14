// =============================================================================
//  3D WORKSPACE  (the middle column of the Experiment Lab)
// =============================================================================
//  A CAD-style stage: a grid floor, soft lighting, and the sample sitting in
//  the middle with its flame on it. You orbit around it with the mouse while
//  the panels either side change what it is showing.
//
//  The GEOMETRY is driven by what NASA actually recorded — a rod is drawn at
//  its recorded diameter, a droplet at its recorded millimetres. The FLAME is
//  an illustration, labelled as one on screen.
// =============================================================================

import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import FlameMesh from './FlameMesh'

export type SampleShape = 'slab' | 'rod' | 'sphere' | 'fabric' | 'droplet' | 'burner'

export interface WorkspaceProps {
  shape: SampleShape
  lit: boolean
  gravityOn: boolean
  /** 0-1, from oxygen. Drives how vigorous the flame looks. */
  intensity: number
  /** Sideways airflow. Positive leans the flame one way, negative the other. */
  flow: number
  /** 0 = clean blue, 1 = sooty yellow tip. */
  soot: number
  /** The sample's size in millimetres, where a table recorded one. */
  sizeMm?: number | null
}

/** The thing that is burning. Each shape matches a real sample type from the
 *  PSI tables: PMMA rods and slabs, SIBAL fabric, fuel droplets on a fibre,
 *  and the gas burners used by ACME and CFI-G. */
function Sample({ shape, sizeMm }: { shape: SampleShape; sizeMm?: number | null }) {
  // Convert millimetres to scene units, keeping everything in a sensible
  // on-screen range whatever the recorded size was.
  const size = Math.max(0.25, Math.min(1.6, (sizeMm ?? 10) / 14))

  const solid = { color: '#C9D2E0', roughness: 0.55, metalness: 0.05 }

  switch (shape) {
    case 'rod':
      return (
        <mesh position={[0, -0.55, 0]} castShadow>
          <cylinderGeometry args={[size * 0.22, size * 0.22, 1.1, 24]} />
          <meshStandardMaterial {...solid} />
        </mesh>
      )
    case 'sphere':
      return (
        <mesh position={[0, -0.1, 0]} castShadow>
          <sphereGeometry args={[size * 0.42, 32, 24]} />
          <meshStandardMaterial {...solid} />
        </mesh>
      )
    case 'slab':
      return (
        <mesh position={[0, -0.45, 0]} castShadow>
          <boxGeometry args={[size * 1.3, 0.12, size * 0.8]} />
          <meshStandardMaterial {...solid} />
        </mesh>
      )
    case 'fabric':
      return (
        <mesh position={[0, -0.45, 0]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[size * 1.8, 0.03, size * 1.0]} />
          <meshStandardMaterial color="#D9CBA8" roughness={0.9} />
        </mesh>
      )
    case 'droplet':
      return (
        <group position={[0, -0.12, 0]}>
          {/* The support fibre. FLEX droplets were held on one, and whether a
              fibre was used is recorded in the CFI table. */}
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 2.6, 8]} />
            <meshStandardMaterial color="#5C6B82" roughness={0.4} />
          </mesh>
          <mesh>
            <sphereGeometry args={[size * 0.2, 32, 24]} />
            <meshPhysicalMaterial
              color="#BFE4FA"
              roughness={0.08}
              transmission={0.85}
              thickness={0.5}
              ior={1.37}
            />
          </mesh>
        </group>
      )
    case 'burner':
      return (
        <group position={[0, -0.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[size * 0.18, size * 0.22, 1.0, 24]} />
            <meshStandardMaterial color="#B4BDCB" roughness={0.4} metalness={0.35} />
          </mesh>
          {/* A torus is built standing upright. Rotating it flat makes it a
              rim around the nozzle instead of a handle sticking up. */}
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[size * 0.18, 0.02, 8, 24]} />
            <meshStandardMaterial color="#C9D2E0" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      )
  }
}

export default function Workspace({
  shape, lit, gravityOn, intensity, flow, soot, sizeMm,
}: WorkspaceProps) {
  // Where the flame sits depends on what it is burning.
  const flameBase: [number, number, number] =
    shape === 'rod' ? [0, 0, 0]
    : shape === 'burner' ? [0, 0, 0]
    : shape === 'sphere' ? [0, -0.1, 0]
    : shape === 'droplet' ? [0, -0.12, 0]
    : [0, -0.38, 0]

  const flameScale = shape === 'droplet' ? 1.5 : shape === 'fabric' ? 2.0 : 1.8

  return (
    <Canvas
      camera={{ position: [3.4, 1.7, 4.4], fov: 38 }}
      // Capping the pixel ratio at 1.5 keeps this smooth on laptops with a
      // high-resolution screen but a modest graphics chip.
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#080C14']} />
      <fog attach="fog" args={['#080C14', 7, 18]} />

      {/* Workshop lighting: dim and cool, so the flame provides the warmth. */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 7, 4]} intensity={0.9} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.18} color="#29ABE2" />

      <Suspense fallback={null}>
        <Sample shape={shape} sizeMm={sizeMm} />
        <FlameMesh
          lit={lit}
          gravityOn={gravityOn}
          intensity={intensity}
          flow={flow}
          soot={soot}
          scale={flameScale}
          position={flameBase}
        />
      </Suspense>

      {/* The CAD-style floor grid. It tells you which way is down — which is
          exactly the thing that stops meaning anything at 0 g, so it fades. */}
      <Grid
        position={[0, -1.3, 0]}
        args={[22, 22]}
        cellSize={0.4}
        cellThickness={0.6}
        cellColor="#1E2D44"
        sectionSize={2}
        sectionThickness={1.1}
        sectionColor="#29ABE2"
        fadeDistance={22}
        fadeStrength={1.2}
        infiniteGrid
        // At 0 g there is no "down", so the floor nearly disappears.
        material-opacity={gravityOn ? 0.5 : 0.14}
        material-transparent
      />

      <OrbitControls
        enablePan={false}
        minDistance={2.2}
        maxDistance={9}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, -0.35, 0]}
        makeDefault
      />
    </Canvas>
  )
}
