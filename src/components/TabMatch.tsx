// =============================================================================
//  TAB 1 — 3D MATCH  (the landing page)
// =============================================================================
//  A single match in a dark chamber. You can spin it, light it, and switch
//  gravity on and off. The point is to show one idea in three seconds:
//
//      Gravity ON  (1 g)  ->  hot gas rises, so the flame is a tall teardrop
//      Gravity OFF (0 g)  ->  nothing rises, so the flame is a small blue ball
//
//  This is a deliberately simple illustration, not a simulation. The real
//  numbers live in the Experiment Lab. There is no slider between 0 g and 1 g
//  because NASA has never measured anything in between.
// =============================================================================

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useState } from 'react'
import * as THREE from 'three'

interface FlameProps { lit: boolean; gravityOn: boolean }

/** The flame itself: three nested translucent shells plus a bright core.
 *
 *  Shape is driven by one number, `stretch`, which the frame loop eases
 *  towards its target. In 1 g the flame is stretched upward and offset so it
 *  sits above the match head, the way buoyancy carries hot gas. In 0 g it is
 *  pulled back into a sphere centred on the head, because there is no "up".
 */
function Flame({ lit, gravityOn }: FlameProps) {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)

  // Current (animated) values. We ease towards the targets every frame so
  // switching gravity is a morph, not a jump cut.
  const current = useRef({ stretch: 0, lift: 0, size: 0, warmth: 0 })

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const c = current.current

    // Where we want to be, given the two switches.
    const targetStretch = gravityOn ? 1 : 0           // 1 = tall, 0 = round
    const targetLift    = gravityOn ? 0.30 : 0.045    // how far above the head
    const targetSize    = lit ? 1 : 0                 // 0 collapses the flame away
    const targetWarmth  = gravityOn ? 1 : 0           // 1 = orange, 0 = blue

    // Ease: move a fraction of the remaining distance each frame. Framerate
    // independent because the fraction scales with delta.
    const ease = (from: number, to: number, speed: number) =>
      from + (to - from) * Math.min(1, delta * speed)

    c.stretch = ease(c.stretch, targetStretch, 3.5)
    c.lift    = ease(c.lift,    targetLift,    3.5)
    c.size    = ease(c.size,    targetSize,    lit ? 7 : 11)
    c.warmth  = ease(c.warmth,  targetWarmth,  3.5)

    if (!group.current) return

    // Flicker only under gravity. A microgravity diffusion flame is famously
    // steady, so the 0 g flame holds almost perfectly still.
    const flicker = gravityOn
      ? 1 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.025
      : 1 + Math.sin(t * 2.2) * 0.008

    const height = (0.42 + c.stretch * 0.95) * c.size * flicker
    const width  = (0.30 - c.stretch * 0.10) * c.size

    group.current.scale.set(width, height, width)
    group.current.position.y = 0.52 + c.lift * c.size
    // Under gravity the plume leans with a slow convection drift.
    group.current.rotation.z = gravityOn ? Math.sin(t * 1.6) * 0.045 : 0

    // Colour: blue at 0 g (a clean, soot-free diffusion flame) warming to
    // orange at 1 g (buoyancy drags in air, soot forms, it glows yellow).
    const cold = new THREE.Color('#2F7FE8')
    const hot  = new THREE.Color('#FFB23D')
    if (core.current) {
      const material = core.current.material as THREE.MeshBasicMaterial
      material.color.copy(cold).lerp(hot, c.warmth)
      material.opacity = 0.95 * c.size
    }
    if (light.current) {
      light.current.color.copy(cold).lerp(hot, c.warmth)
      light.current.intensity = (gravityOn ? 7 : 3.6) * c.size * flicker
      light.current.position.y = group.current.position.y
    }
  })

  // Each shell is a sphere; the group's non-uniform scale turns them into the
  // teardrop. Additive blending makes overlapping shells glow where they meet.
  const shells = [
    { radius: 1.00, colour: '#1E63C8', opacity: 0.20 },
    { radius: 0.72, colour: '#3C96E8', opacity: 0.30 },
    { radius: 0.45, colour: '#9FD4F5', opacity: 0.45 },
  ]

  return (
    <>
      <pointLight ref={light} position={[0, 0.8, 0]} distance={9} decay={2} />
      <group ref={group}>
        {shells.map((shell, i) => (
          <mesh key={i} position={[0, 0.12, 0]}>
            <sphereGeometry args={[shell.radius, 28, 28]} />
            <meshBasicMaterial
              color={shell.colour}
              transparent
              opacity={shell.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
        {/* The bright centre, which carries the blue-to-orange colour shift. */}
        <mesh ref={core} position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.30, 24, 24]} />
          <meshBasicMaterial
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  )
}

/** Sparks that rise off the flame. They only exist under gravity, because in
 *  microgravity there is no buoyant current to carry anything upward. */
function Sparks({ lit, gravityOn }: FlameProps) {
  const points = useRef<THREE.Points>(null)
  const COUNT = 36

  // Give each spark a random lane and speed once, then recycle it forever.
  const seeds = useRef(
    Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.3,
      speed: 0.5 + Math.random() * 0.9,
      offset: Math.random(),
    })),
  )

  useFrame((state) => {
    if (!points.current) return
    const visible = lit && gravityOn
    points.current.visible = visible
    if (!visible) return

    const t = state.clock.elapsedTime
    const positions = points.current.geometry.attributes.position as THREE.BufferAttribute
    seeds.current.forEach((seed, i) => {
      // `progress` runs 0 -> 1 then wraps, carrying the spark up and out.
      const progress = ((t * seed.speed + seed.offset) % 1)
      positions.setXYZ(
        i,
        seed.x * (1 + progress * 2.4) + Math.sin(t * 3 + i) * 0.03,
        0.75 + progress * 1.9,
        seed.z * (1 + progress * 2.4),
      )
    })
    positions.needsUpdate = true
    ;(points.current.material as THREE.PointsMaterial).opacity = 0.55
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(COUNT * 3), 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#FFC66B"
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/** The matchstick: a wooden shaft with a dark head that chars once lit. */
function Matchstick({ lit }: { lit: boolean }) {
  const head = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!head.current) return
    // The head darkens as it burns, easing rather than snapping.
    const material = head.current.material as THREE.MeshStandardMaterial
    const target = lit ? new THREE.Color('#2A1410') : new THREE.Color('#9E2B2B')
    material.color.lerp(target, Math.min(1, delta * 2.5))
  })

  return (
    <group position={[0, -0.9, 0]}>
      {/* Shaft */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.062, 2.2, 20]} />
        <meshStandardMaterial color="#D8B98A" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Head */}
      <mesh ref={head} position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.115, 24, 20]} />
        <meshStandardMaterial roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  )
}

/** The chamber floor — a faint grid that gives the scene a sense of place.
 *  It fades out under zero gravity, because "down" stops meaning anything. */
function Floor({ gravityOn }: { gravityOn: boolean }) {
  const grid = useRef<THREE.GridHelper>(null)
  useFrame((_, delta) => {
    if (!grid.current) return
    const material = grid.current.material as THREE.Material
    const target = gravityOn ? 0.22 : 0.05
    material.opacity += (target - material.opacity) * Math.min(1, delta * 3)
  })
  return (
    <gridHelper
      ref={grid}
      args={[14, 28, '#29ABE2', '#1E2D44']}
      position={[0, -2.4, 0]}
      material-transparent
      material-opacity={0.22}
    />
  )
}

export default function TabMatch({ onOpenLab }: { onOpenLab: () => void }) {
  const [lit, setLit] = useState(false)
  const [gravityOn, setGravityOn] = useState(true)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* ---------- 3D viewport ---------- */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0.6, 5.2], fov: 42 }} dpr={[1, 2]}>
          <color attach="background" args={['#070B12']} />
          <fog attach="fog" args={['#070B12', 7, 15]} />
          <ambientLight intensity={0.12} />
          <directionalLight position={[4, 6, 4]} intensity={0.35} />
          <Matchstick lit={lit} />
          <Flame lit={lit} gravityOn={gravityOn} />
          <Sparks lit={lit} gravityOn={gravityOn} />
          <Floor gravityOn={gravityOn} />
          <OrbitControls
            enablePan={false}
            minDistance={3}
            maxDistance={9}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 1.75}
            autoRotate={!lit}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>

      {/* ---------- Heading, top-left ---------- */}
      <div className="relative z-10 p-6 sm:p-10 pointer-events-none anim-fade-up">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
          Fire behaves differently
          <br />
          <span className="bg-gradient-to-r from-cryo via-star to-flame bg-clip-text text-transparent">
            when nothing falls.
          </span>
        </h1>
        <p className="mt-4 max-w-md text-sm text-mute leading-relaxed">
          On Earth, hot gas rises and drags fresh air in behind it — that is what gives a
          flame its shape. Take gravity away and nothing rises. The flame becomes a small,
          quiet sphere.
        </p>
        <p className="mt-3 text-xs text-mute/70">Drag to rotate · scroll to zoom</p>
      </div>

      {/* ---------- Control dock, bottom ---------- */}
      <div className="relative z-10 mt-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-4">
          {/* Sub-gravity transparency note */}
          <div className="panel px-4 py-2 flex items-center gap-2.5 text-[11px] text-mute
                          anim-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-star shrink-0" />
            <span>
              There is no slider between these two settings. NASA has never measured
              combustion at Moon or Mars gravity — so we do not draw it.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Ignite */}
            <button
              onClick={() => setLit((v) => !v)}
              className={`btn-ignite ${lit ? 'is-lit' : 'anim-pulse'}`}
            >
              {lit ? 'Extinguish' : 'Ignite'}
            </button>

            {/* Gravity toggle — two states only, by design */}
            <div className="panel flex items-stretch overflow-hidden">
              <div className="px-3 flex items-center label border-r border-edge">Gravity</div>
              <button
                onClick={() => setGravityOn(true)}
                className={`px-4 py-2.5 text-sm transition-all duration-200
                            ${gravityOn ? 'bg-ember/15 text-ember' : 'text-mute hover:text-slate-200'}`}
              >
                ON · 1 g
              </button>
              <button
                onClick={() => setGravityOn(false)}
                className={`px-4 py-2.5 text-sm transition-all duration-200 border-l border-edge
                            ${!gravityOn ? 'bg-cryo/15 text-cryo' : 'text-mute hover:text-slate-200'}`}
              >
                OFF · 0 g
              </button>
            </div>

            <button onClick={onOpenLab} className="btn">
              Open Experiment Lab →
            </button>
          </div>

          {/* A one-line read-out of what the current state means. */}
          <div className="text-[11px] text-mute text-center h-4 anim-fade-in" key={`${lit}${gravityOn}`}>
            {!lit
              ? 'Match unlit.'
              : gravityOn
                ? 'Buoyant teardrop — hot gas rises, soot glows yellow at the tip.'
                : 'Spherical diffusion flame — fuel and air meet by diffusion alone, burning blue.'}
          </div>
        </div>
      </div>
    </div>
  )
}
