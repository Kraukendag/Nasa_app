// =============================================================================
//  VOLUME FLAME  (React wrapper for src/three/volumeFlame.ts)
// =============================================================================
//  Draws one volumetric flame made of up to 16 sources. The scene that owns
//  the flame keeps the source list in a ref and changes it every frame (where
//  the flame front is, how bright it is), so animation never re-renders React.
//
//  The invisible box the rays march through FOLLOWS the flame: it is centred
//  on the active sources, shifted downstream, so a small box is enough and the
//  shader stays cheap.
// =============================================================================

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { FlameSource } from '../three/volumeFlame'
import { MAX_SOURCES, volumeFragmentShader, volumeVertexShader } from '../three/volumeFlame'

export interface VolumeFlameProps {
  sources: MutableRefObject<FlameSource[]>
  /** Size of the marching box (world units). */
  box: [number, number, number]
  /** Fixed box centre; omitted = follow the active sources. */
  center?: [number, number, number]
  /** Shift of the box from the sources' centre, e.g. upward for a buoyant flame. */
  offset?: [number, number, number]
  flicker?: number
  sooty?: number
  dim?: number
  /** 1 = full steps, 0.5 = half (slow computers). */
  quality?: number
  /** Cast a flickering point light from the flame. */
  light?: boolean
}

export default function VolumeFlame({ sources, box, center, offset = [0, 0, 0], flicker = 1, sooty = 1, dim = 1, quality = 1, light = false }: VolumeFlameProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const ease = useRef({ flicker, sooty, dim })
  const uniforms = useMemo(() => ({
    uCam: { value: new THREE.Vector3() },
    uHalf: { value: new THREE.Vector3(box[0] / 2, box[1] / 2, box[2] / 2) },
    uCount: { value: 0 },
    uPos: { value: Array.from({ length: MAX_SOURCES }, () => new THREE.Vector3()) },
    uP: { value: Array.from({ length: MAX_SOURCES }, () => new THREE.Vector4()) },
    uQ: { value: Array.from({ length: MAX_SOURCES }, () => new THREE.Vector4(0, 1, 0, 0)) },
    uTime: { value: 0 }, uFlicker: { value: flicker }, uSooty: { value: sooty }, uDim: { value: dim },
    uSteps: { value: 48 },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const m = mesh.current
    if (!m) return
    const list = sources.current.slice(0, MAX_SOURCES)
    const u = uniforms
    const k = Math.min(1, delta * 2.5)
    const e = ease.current
    e.flicker += (flicker - e.flicker) * k
    e.sooty += (sooty - e.sooty) * k
    e.dim += (dim - e.dim) * k

    // Box centre: fixed, or the power-weighted centre of the sources.
    // The centre is shifted downstream by how far each flame is drawn out, so
    // a tall buoyant plume stays inside the box as it morphs (no snapping).
    let cx = 0, cy = 0, cz = 0, wsum = 0, best = 0, bestI = 0
    list.forEach((s, i) => {
      const w = Math.max(0, s.power)
      const a = s.axis ?? [0, 1, 0]
      const shift = s.radius * s.stretch * 0.9
      cx += (s.pos[0] + a[0] * shift) * w; cy += (s.pos[1] + a[1] * shift) * w; cz += (s.pos[2] + a[2] * shift) * w
      wsum += w; if (w > best) { best = w; bestI = i }
    })
    const c = center ?? (wsum > 0 ? [cx / wsum + offset[0], cy / wsum + offset[1], cz / wsum + offset[2]] : [offset[0], offset[1], offset[2]])
    m.position.set(c[0], c[1], c[2])
    m.updateMatrixWorld()
    m.visible = wsum > 0.002

    u.uCount.value = list.length
    list.forEach((s, i) => {
      u.uPos.value[i].set(s.pos[0] - c[0], s.pos[1] - c[1], s.pos[2] - c[2])
      u.uP.value[i].set(s.radius, s.stretch, s.shell, s.power)
      const a = s.axis ?? [0, 1, 0]
      u.uQ.value[i].set(a[0], a[1], a[2], s.segment ?? 0)
    })
    u.uCam.value.copy(m.worldToLocal(tmp.copy(state.camera.position)))
    u.uTime.value = state.clock.elapsedTime
    u.uFlicker.value = e.flicker
    u.uSooty.value = e.sooty
    u.uDim.value = e.dim
    u.uSteps.value = quality < 1 ? 26 : 48

    if (lamp.current && list[bestI]) {
      const s = list[bestI]
      const t = state.clock.elapsedTime
      lamp.current.position.set(s.pos[0], s.pos[1] + s.radius, s.pos[2])
      const fl = 1 + (Math.sin(t * 12.3) * 0.09 + Math.sin(t * 27.1) * 0.05) * e.flicker
      lamp.current.intensity = 5 * Math.min(1.5, wsum) * fl * e.dim
      lamp.current.color.setRGB(0.45 + 0.55 * e.sooty, 0.7 - 0.15 * e.sooty, 1.0 - 0.75 * e.sooty)
    }
  })

  return (
    <>
      {light && <pointLight ref={lamp} distance={6} decay={2} intensity={0} />}
      {/* Back faces: works whether the camera is outside the box or inside it. */}
      <mesh ref={mesh} frustumCulled={false} renderOrder={10}>
        <boxGeometry args={box} />
        <shaderMaterial vertexShader={volumeVertexShader} fragmentShader={volumeFragmentShader} uniforms={uniforms}
                        transparent depthWrite={false} depthTest={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  )
}
