// =============================================================================
//  MATCH SCENE  (home page)
// =============================================================================
//  A match lit at the head. The flame then works its way down the stick,
//  charring it, until it burns out. Gravity on: buoyant hot gas stretches the
//  flame into a rising teardrop. Gravity off: nothing rises, oxygen arrives
//  only by diffusion, and the flame becomes a smaller, dimmer, rounder flame
//  wrapped around the burning zone.
//
//  HOW THE BURN IS TIMED (this is what fixed the old glitch)
//  ---------------------------------------------------------
//  The match moves through stages: unlit -> strike -> burning -> burnt out.
//  Burn progress is ADDED UP a little every frame at the current speed, so
//  switching gravity only changes how fast the front moves from where it is.
//  It never jumps, and a burnt-out match stays burnt until it is reset.
//  (Before, progress was "time since lighting / duration", and the duration
//  changed with gravity, so a switch teleported the flame or un-burned the
//  stick.)
// =============================================================================

import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import VolumeFlame from './VolumeFlame'
import type { FlameSource } from '../three/volumeFlame'

const HEAD_Y = 0.75          // match head centre
const STICK_TOP = 0.66
const BURN_LENGTH = 1.25     // how far down the stick the flame travels
const BURN_S = 20            // seconds to travel it with gravity on
const SLOWER_IN_0G = 1.6     // without buoyancy the flame creeps more slowly
const STRIKE_S = 0.45        // the bright flare when the head ignites

type Stage = 'unlit' | 'strike' | 'burning' | 'out'
const HEAD_COLOUR = new THREE.Color('#9E2B2B')
const SPENT_COLOUR = new THREE.Color('#2A1410')

function Match({ lit, gravityOn, quality }: { lit: boolean; gravityOn: boolean; quality: number }) {
  const s = useRef({ stage: 'unlit' as Stage, t: 0, p: 0, alive: 0, flare: 0, g: gravityOn ? 1 : 0 })
  const head = useRef<THREE.MeshStandardMaterial>(null)
  const ember = useRef<THREE.MeshBasicMaterial>(null)
  const emberMesh = useRef<THREE.Mesh>(null)
  const flame = useRef<FlameSource[]>([{ pos: [0, HEAD_Y, 0], radius: 0.12, stretch: 1, shell: 0, power: 0 }])
  const planes = useMemo(() => ({ below: new THREE.Plane(new THREE.Vector3(0, -1, 0), STICK_TOP),
                                  above: new THREE.Plane(new THREE.Vector3(0, 1, 0), -STICK_TOP) }), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)        // a background tab must not skip the whole burn
    const m = s.current
    // Ease the gravity blend so the flame shape morphs instead of snapping.
    m.g += ((gravityOn ? 1 : 0) - m.g) * Math.min(1, delta * 2.5)

    if (!lit) { m.stage = 'unlit'; m.t = 0; m.p = 0 }
    else if (m.stage === 'unlit') { m.stage = 'strike'; m.t = 0 }
    if (m.stage === 'strike') { m.t += delta; if (m.t > STRIKE_S) { m.stage = 'burning'; m.t = 0 } }
    if (m.stage === 'burning') {
      m.t += delta
      // Progress grows at the CURRENT rate; switching gravity changes speed only.
      const rate = 1 / (BURN_S * (gravityOn ? 1 : SLOWER_IN_0G))
      if (m.t > 1.2) m.p = Math.min(1, m.p + delta * rate)   // the head burns first
      if (m.p >= 1) { m.stage = 'out'; m.t = 0 }
    }
    if (m.stage === 'out') m.t += delta

    // Brightness: flare on strike, steady while burning, dying after burn-out.
    const target = m.stage === 'unlit' ? 0 : m.stage === 'out' ? Math.max(0, 1 - m.t * 0.8) : 1
    m.alive += (target - m.alive) * Math.min(1, delta * (target > m.alive ? 6 : 3))
    m.flare = m.stage === 'strike' ? Math.sin((m.t / STRIKE_S) * Math.PI) : Math.max(0, m.flare - delta * 3)

    const y = STICK_TOP - m.p * BURN_LENGTH
    planes.below.constant = y
    planes.above.constant = -y
    const onHead = m.stage === 'strike' || (m.stage === 'burning' && m.t < 1.2)
    const fy = onHead ? HEAD_Y : y + 0.05

    // The flame as a volumetric source: buoyant teardrop (1 g) or round shell (0 g).
    const f = flame.current[0]
    f.pos = [0, fy, 0]
    f.radius = THREE.MathUtils.lerp(0.19, 0.22, m.g) * (1 + m.flare * 0.6)
    f.stretch = THREE.MathUtils.lerp(0.12, 2.6, m.g)
    f.shell = THREE.MathUtils.lerp(0.75, 0.1, m.g)
    f.power = m.alive * (1 + m.flare * 1.5)

    if (head.current) head.current.color.lerp(lit ? SPENT_COLOUR : HEAD_COLOUR, Math.min(1, delta * 2.5))
    if (ember.current && emberMesh.current) {
      emberMesh.current.position.y = y
      ember.current.opacity = m.stage === 'burning' && !onHead ? 0.9 : Math.max(0, ember.current.opacity - delta)
    }
  })

  const gNow = gravityOn ? 1 : 0
  return (
    <group>
      {/* stick: unburned wood below the front, char above it */}
      <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.055, 0.062, 2.2, 20]} />
        <meshStandardMaterial color="#D8B98A" roughness={0.85} clippingPlanes={[planes.below]} /></mesh>
      <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.046, 0.05, 2.2, 20]} />
        <meshStandardMaterial color="#1d1712" roughness={0.95} clippingPlanes={[planes.above]} /></mesh>
      {/* the glowing ring where wood is turning to char */}
      <mesh ref={emberMesh}><cylinderGeometry args={[0.058, 0.058, 0.02, 20]} />
        <meshBasicMaterial ref={ember} color="#ff6a1a" transparent opacity={0} /></mesh>
      <mesh position={[0, HEAD_Y, 0]}><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial ref={head} color="#9E2B2B" roughness={0.6} /></mesh>
      {/* The marching box follows the flame (and its rising plume). */}
      <VolumeFlame sources={flame} box={[1.1, 2.1, 1.1]}
                   flicker={gNow ? 1 : 0.06} sooty={gNow ? 0.95 : 0.15} dim={gNow ? 1 : 0.9}
                   quality={quality} light />
    </group>
  )
}

export default function MatchScene({ lit, gravityOn }: { lit: boolean; gravityOn: boolean }) {
  const [quality, setQuality] = useState(1)
  return (
    <Canvas camera={{ position: [0, 0.4, 4.6], fov: 40 }} dpr={[1, quality < 1 ? 1 : 1.5]}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}>
      {/* Drops the flame's ray-march steps on slower computers. */}
      <PerformanceMonitor onDecline={() => setQuality(0.5)} onIncline={() => setQuality(1)} />
      <color attach="background" args={['#0B0F17']} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
      <Match lit={lit} gravityOn={gravityOn} quality={quality} />
      <OrbitControls enablePan={false} minDistance={2.6} maxDistance={8} target={[0, 0.1, 0]} autoRotate={!lit} autoRotateSpeed={0.5} />
    </Canvas>
  )
}
