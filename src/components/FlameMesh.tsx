// =============================================================================
//  FLAME MESH
// =============================================================================
//  Wraps the procedural flame shader in something the rest of the app can drop
//  into a 3D scene. Used by both the 3D Match page and the Experiment Lab, so
//  the fire looks the same everywhere.
//
//  The flame is a flat quad that always turns to face the camera. That sounds
//  like a shortcut, but fire is close to radially symmetric, so a camera-facing
//  sheet reads as a volume from every angle — and it costs a tiny fraction of
//  what a particle cloud or a volume raymarch would.
// =============================================================================

import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { flameFragmentShader, flameVertexShader, makeFlameUniforms } from '../three/flameShader'

export interface FlameMeshProps {
  /** Is it burning? Animates in and out rather than popping. */
  lit: boolean
  /** true = Earth (1 g), false = microgravity (0 g). */
  gravityOn: boolean
  /** 0-1, how vigorous the flame is. The Lab drives this from oxygen. */
  intensity?: number
  /** Airflow along the WORLD x-axis, -1 to 1. Positive pushes the flame
   *  toward +x. It stays tied to the world as you orbit the camera. */
  flow?: number
  /** 0 = clean blue burn, 1 = sooty yellow tip. */
  soot?: number
  /** World size of the flame quad. */
  scale?: number
  position?: [number, number, number]
  /** Adds the flickering light the flame casts on its surroundings. */
  castLight?: boolean
}

export default function FlameMesh({
  lit,
  gravityOn,
  intensity = 0.5,
  flow = 0,
  soot = 1,
  scale = 1,
  position = [0, 0, 0],
  castLight = true,
}: FlameMeshProps) {
  const uniforms = useMemo(makeFlameUniforms, [])
  const light = useRef<THREE.PointLight>(null)
  const group = useRef<THREE.Group>(null)

  // Values we ease towards rather than snapping to, so every change reads as
  // a transition. Kept in a ref because they change every frame and must not
  // trigger React re-renders.
  const eased = useRef({ alive: 0, gravity: 1, intensity: 0.5, flow: 0 })

  useFrame((state, delta) => {
    const step = (from: number, to: number, speed: number) =>
      from + (to - from) * Math.min(1, delta * speed)

    const e = eased.current
    e.alive     = step(e.alive,     lit ? 1 : 0,       lit ? 4.5 : 7)
    e.gravity   = step(e.gravity,   gravityOn ? 1 : 0, 2.6)
    e.intensity = step(e.intensity, intensity,         3.5)
    e.flow      = step(e.flow,      flow,              3.0)

    uniforms.uTime.value      = state.clock.elapsedTime
    uniforms.uAlive.value     = e.alive
    uniforms.uGravity.value   = e.gravity
    uniforms.uIntensity.value = e.intensity
    // The flame quad only turns around its vertical axis, so its sideways
    // direction is the camera's horizontal right vector. Projecting the world
    // flow onto that vector keeps the lean pointing the same way in the WORLD
    // as you orbit; seen end-on (flow toward the camera) it shrinks to zero,
    // exactly as a real bent flame would look. An earlier version leaned in
    // screen space, so the "airflow" swung round with the camera.
    const m = state.camera.matrixWorld.elements
    const rx = m[0], rz = m[2]
    const len = Math.hypot(rx, rz) || 1
    uniforms.uFlow.value      = e.flow * (rx / len)
    uniforms.uSoot.value      = soot

    // Scale UNIFORMLY. Squashing the quad vertically under 0 g used to turn
    // the round microgravity flame into an oval. The shader now handles the
    // height change itself, so the quad never needs distorting.
    if (group.current) group.current.scale.setScalar(scale)

    // Light the surroundings. Flicker under gravity; hold almost steady
    // without it, because a microgravity diffusion flame barely moves.
    if (light.current) {
      const t = state.clock.elapsedTime
      const flicker = e.gravity > 0.5
        ? 1 + Math.sin(t * 12.3) * 0.09 + Math.sin(t * 27.1) * 0.05
        : 1 + Math.sin(t * 2.1) * 0.012
      light.current.intensity = (gravityOn ? 9 : 4.5) * e.alive * flicker * scale
      light.current.color.setRGB(
        THREE.MathUtils.lerp(0.45, 1.0, e.gravity),
        THREE.MathUtils.lerp(0.72, 0.55, e.gravity),
        THREE.MathUtils.lerp(1.0, 0.25, e.gravity),
      )
    }
  })

  return (
    <group position={position}>
      {castLight && (
        <pointLight
          ref={light}
          position={[0, scale * 0.3, 0]}
          distance={scale * 11}
          decay={2}
        />
      )}
      {/* lockX + lockZ: the quad turns to face you only around its vertical
          axis, so "up" stays up and the lean stays in world space. */}
      <Billboard lockX lockZ>
        {/* A plane is centred on its own origin, which would bury half the
            flame in the fuel. So we scale this group and offset the quad
            upward by half its height inside it — that puts the pivot at the
            BASE of the flame, so it grows upward from the wick. */}
        <group ref={group}>
          {/* 0.5 lifts the quad so its bottom edge sits at the origin; the
              extra -0.22 matches BASE in the shader, so the origin of this
              component is exactly where the fuel is. */}
          <mesh position={[0, 0.5 - 0.22, 0]}>
            <planeGeometry args={[1, 1, 1, 1]} />
            <shaderMaterial
              vertexShader={flameVertexShader}
              fragmentShader={flameFragmentShader}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  )
}
