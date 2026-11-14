// =============================================================================
//  MATCH SCENE  (home page)
// =============================================================================
//  A match lit at the head. The flame then works its way down the stick,
//  charring it, until it burns out. Gravity on: buoyant hot gas stretches the
//  flame into a rising teardrop. Gravity off: nothing rises, oxygen arrives
//  only by diffusion, and the flame becomes a smaller, dimmer, rounder flame
//  wrapped around the burning zone.
// =============================================================================

import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import FlameMesh from './FlameMesh'

const HEAD_Y = 0.75          // match head centre
const STICK_TOP = 0.66
const BURN_LENGTH = 1.25     // how far down the stick the flame travels
const BURN_S = 20            // seconds to travel it

function Match({ lit, gravityOn }: { lit: boolean; gravityOn: boolean }) {
  const start = useRef<number | null>(null)
  const front = useRef<THREE.Group>(null)
  const head = useRef<THREE.MeshStandardMaterial>(null)
  const alive = useRef(1)
  const planes = useMemo(() => ({ below: new THREE.Plane(new THREE.Vector3(0, -1, 0), STICK_TOP),
                                  above: new THREE.Plane(new THREE.Vector3(0, 1, 0), -STICK_TOP) }), [])
  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    if (!lit) { start.current = null; alive.current = 0 } else if (start.current == null) start.current = now
    const t = start.current == null ? 0 : now - start.current
    // Without gravity the flame creeps more slowly: oxygen only diffuses in.
    const p = Math.min(1, t / (gravityOn ? BURN_S : BURN_S * 1.6))
    const y = STICK_TOP - p * BURN_LENGTH
    planes.below.constant = y
    planes.above.constant = -y
    alive.current = lit ? (p < 1 ? Math.min(1, t * 2) : Math.max(0, 1 - (t - (gravityOn ? BURN_S : BURN_S * 1.6)) * 0.8)) : 0
    if (front.current) front.current.position.y = t < 1.2 ? HEAD_Y : y + 0.05
    if (head.current) {
      const target = lit ? new THREE.Color('#2A1410') : new THREE.Color('#9E2B2B')
      head.current.color.lerp(target, Math.min(1, delta * 2.5))
    }
  })
  return (
    <group>
      {/* stick: unburned wood below the front, char above it */}
      <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.055, 0.062, 2.2, 20]} />
        <meshStandardMaterial color="#D8B98A" roughness={0.85} clippingPlanes={[planes.below]} /></mesh>
      <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.05, 0.057, 2.2, 20]} />
        <meshStandardMaterial color="#1d1712" roughness={0.95} clippingPlanes={[planes.above]} /></mesh>
      <mesh position={[0, HEAD_Y, 0]}><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial ref={head} roughness={0.6} /></mesh>
      <group ref={front}>
        <FlameMesh lit={lit} aliveRef={alive} shape={gravityOn ? 0 : 0.85} stretch={gravityOn ? 1 : 0.3}
                   width={gravityOn ? 0.95 : 0.9} flicker={gravityOn ? 1 : 0.06} sooty={gravityOn ? 1 : 0.12}
                   dim={gravityOn ? 1 : 0.62} intensity={0.75} scale={gravityOn ? 1.35 : 1.05} castLight />
      </group>
    </group>
  )
}

export default function MatchScene({ lit, gravityOn }: { lit: boolean; gravityOn: boolean }) {
  return (
    <Canvas camera={{ position: [0, 0.4, 4.6], fov: 40 }} dpr={[1, 1.5]}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}>
      <color attach="background" args={['#0B0F17']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
      <Match lit={lit} gravityOn={gravityOn} />
      <OrbitControls enablePan={false} minDistance={2.6} maxDistance={8} target={[0, 0.1, 0]} autoRotate={!lit} autoRotateSpeed={0.5} />
    </Canvas>
  )
}
