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
import FlameMesh from './FlameMesh'
import type { Dataset } from '../data'

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

export default function TabMatch({ data, onOpenLab, onOpenInsights }: {
  data: Dataset; onOpenLab: () => void; onOpenInsights: () => void
}) {
  const [lit, setLit] = useState(false)
  const [gravityOn, setGravityOn] = useState(true)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* ---------- 3D viewport ---------- */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0.9, 6.2], fov: 40 }} dpr={[1, 1.5]}>
          <color attach="background" args={['#070B12']} />
          <fog attach="fog" args={['#070B12', 7, 15]} />
          <ambientLight intensity={0.12} />
          <directionalLight position={[4, 6, 4]} intensity={0.35} />
          <Matchstick lit={lit} />
          {/* The flame sits on the match head at y = 0.75 (the stick group is
              offset to -0.9 and the head is 1.65 above its base). */}
          <FlameMesh
            lit={lit}
            gravityOn={gravityOn}
            intensity={0.72}
            soot={1}
            scale={1.4}
            position={[0, 0.75, 0]}
          />
          <Floor gravityOn={gravityOn} />
          <OrbitControls
            enablePan={false}
            target={[0, 0.35, 0]}
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

      {/* ---------- Three key insights: the takeaway in ten seconds ----------
          Each headline is computed by the data pipeline from the PSI rows and
          cites its source; none is written by hand on this page. */}
      <aside className="relative z-10 px-6 sm:px-10 lg:px-0 lg:absolute lg:top-8 lg:right-8 lg:w-[360px] space-y-2 stagger">
        <div className="label">What NASA's data shows</div>
        {data.findings.key_insights.map((k, n) => (
          <div key={k.id} className="panel p-3 backdrop-blur-md">
            <div className="flex gap-2.5">
              <span className="tabular text-[11px] text-cryo mt-0.5">{n + 1}</span>
              <div>
                <div className="text-[12.5px] text-slate-100 leading-snug font-medium">{k.headline}</div>
                <div className="text-[9.5px] text-mute mt-1 font-mono">
                  {k.psi_id}{k.doi ? ` · DOI ${k.doi}` : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
        <button onClick={onOpenInsights} className="text-[11px] text-cryo hover:underline">All insights, rankings and open questions →</button>
      </aside>

      {/* ---------- Control dock, bottom ---------- */}
      <div className="relative z-10 mt-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-4">
          {/* Sub-gravity transparency note */}
          <div className="panel px-4 py-2 flex items-center gap-2.5 text-[11px] text-mute
                          anim-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-star shrink-0" />
            <span>
              No slider between these settings: NASA's PSI repository holds no partial-gravity
              combustion data. (Partial-gravity flame tests exist from parabolic flights, but not
              in PSI.) So we do not draw Moon or Mars gravity.
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
