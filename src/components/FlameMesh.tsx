// =============================================================================
//  FLAME
// =============================================================================
//  One procedural flame (see src/three/flameShader.ts) on a quad that turns to
//  face the camera around its vertical axis only. Scenes place one or many of
//  these: a single plume on a match, a row of them along the flame front of a
//  burning sheet, a ring around a sphere, a shell around a droplet.
//
//  Every parameter eases toward its target each frame, so a change of gravity,
//  airflow or ignition state reads as a transition rather than a jump.
// =============================================================================

import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flameFragmentShader, flameVertexShader, makeFlameUniforms } from '../three/flameShader'

export interface FlameProps {
  lit: boolean
  /** 0 = plume (teardrop), 1 = shell around the fuel. Values between blend. */
  shape?: number
  /** Plume length. ~0.2 compact, 1 = buoyant flame, 1.4 = long jet. */
  stretch?: number
  width?: number
  /** 0 = steady microgravity flame, 1 = buoyant flicker. */
  flicker?: number
  /** 0 = clean blue, 1 = sooty yellow. */
  sooty?: number
  intensity?: number
  /** Overall brightness; microgravity flames are dimmer. */
  dim?: number
  /** Lean along the WORLD x-axis, -1..1. */
  lean?: number
  /** Point the plume downward instead of up (e.g. a flame pushed ahead of the
   *  front by downward airflow). */
  flip?: boolean
  scale?: number
  position?: [number, number, number]
  castLight?: boolean
  /** Optional per-frame multiplier (0..1) set by an animating parent, e.g. the
   *  spread clock fading a flame out at extinction without re-rendering. */
  aliveRef?: { current: number }
}

export default function FlameMesh({
  lit, shape = 0, stretch = 1, width = 1, flicker = 1, sooty = 1, intensity = 0.6, dim = 1,
  lean = 0, flip = false, scale = 1, position = [0, 0, 0], castLight = false, aliveRef,
}: FlameProps) {
  const uniforms = useMemo(makeFlameUniforms, [])
  const light = useRef<THREE.PointLight>(null)
  const e = useRef({ alive: 0, shape, stretch, width, flicker, sooty, intensity, dim, lean })

  useFrame((state, delta) => {
    const k = (speed: number) => Math.min(1, delta * speed)
    const c = e.current
    const target = (lit ? 1 : 0) * (aliveRef ? aliveRef.current : 1)
    c.alive += (target - c.alive) * k(target > c.alive ? 4 : 6)
    c.shape += (shape - c.shape) * k(2.5)
    c.stretch += (stretch - c.stretch) * k(2.5)
    c.width += (width - c.width) * k(2.5)
    c.flicker += (flicker - c.flicker) * k(2.5)
    c.sooty += (sooty - c.sooty) * k(2.5)
    c.intensity += (intensity - c.intensity) * k(3)
    c.dim += (dim - c.dim) * k(3)
    c.lean += (lean - c.lean) * k(3)

    // Project the world-x lean onto the quad's sideways axis (the camera's
    // horizontal right vector), so the lean stays fixed in the world as the
    // camera orbits. A flipped plume leans the other way on screen.
    const m = state.camera.matrixWorld.elements
    const len = Math.hypot(m[0], m[2]) || 1
    const u = uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uAlive.value = c.alive
    u.uShape.value = c.shape
    u.uStretch.value = c.stretch
    u.uWidth.value = c.width
    u.uFlicker.value = c.flicker
    u.uSooty.value = c.sooty
    u.uIntensity.value = c.intensity
    u.uDim.value = c.dim
    u.uLean.value = c.lean * (m[0] / len) * (flip ? -1 : 1)

    if (light.current) {
      const t = state.clock.elapsedTime
      const fl = 1 + (Math.sin(t * 12.3) * 0.09 + Math.sin(t * 27.1) * 0.05) * c.flicker
      light.current.intensity = 6 * c.alive * fl * c.dim * scale
      light.current.color.setRGB(0.45 + 0.55 * c.sooty, 0.72 - 0.17 * c.sooty, 1.0 - 0.75 * c.sooty)
    }
  })

  return (
    <group position={position}>
      {castLight && <pointLight ref={light} position={[0, (flip ? -1 : 1) * scale * 0.3, 0]} distance={scale * 10} decay={2} />}
      {/* lockX + lockZ: turns to face you around its vertical axis only. */}
      <Billboard lockX lockZ>
        <group scale={scale} rotation={[0, 0, flip ? Math.PI : 0]}>
          {/* The quad's pivot is the flame BASE (0.22 up the quad, matching
              BASE in the shader), so it grows out of the fuel. */}
          <mesh position={[0, 0.5 - 0.22, 0]}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial vertexShader={flameVertexShader} fragmentShader={flameFragmentShader}
                            uniforms={uniforms} transparent depthWrite={false}
                            blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Billboard>
    </group>
  )
}
