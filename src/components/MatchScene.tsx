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
//
//  TURN THE MATCH (drag it)
//  ------------------------
//  The match body sits in a group you can rotate; the flame does NOT turn with
//  it. With gravity, hot gas always rises, so the flame points straight up
//  whichever way the match is held, and the burn speed depends on the tilt:
//  head up, the flame rises AWAY from the wood and creeps down slowly; held
//  sideways it spreads about twice as fast; head down it climbs onto fresh
//  wood, about four times as fast (upward flame spread is faster than
//  downward spread). In microgravity there is no "up": the flame stays a
//  round shell and the tilt changes nothing. Speeds are illustrative.
// =============================================================================

import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { lowPower, reducedMotion, startQuality, useInView } from '../three/perf'
import * as THREE from 'three'
import VolumeFlame from './VolumeFlame'
import type { FlameSource } from '../three/volumeFlame'

const HEAD_Y = 0.75          // match head centre
const STICK_TOP = 0.66
const BURN_LENGTH = 1.85     // how far down the stick the flame travels (nearly all of it)
const BURN_S = 30            // seconds to travel it with gravity on
const SLOWER_IN_0G = 1.6     // without buoyancy the flame creeps more slowly
const STRIKE_S = 0.45        // the bright flare when the head ignites

type Stage = 'unlit' | 'strike' | 'burning' | 'out'
/** How the match is held, judged by which way the flame front moves along it. */
export type Tilt = 'upright' | 'sideways' | 'down'
const PIVOT_Y = -0.3                    // the match turns around its middle
/** With gravity: how much faster the front moves, from 1x (head up, front moving
 *  down) through 2x (sideways) to 4x (head down, front climbing up). */
const tiltSpeed = (up: number) => Math.pow(4, (up + 1) / 2)

/** Where a point of the stick (x, y, z in world units, y up) ends up once the
 *  flame front at height `front` has passed it. Below the front: unchanged.
 *  Above it, the further past the front the more it has burned:
 *   - thinner (char shrinks to about half the wood's width),
 *   - wrinkled (small ripples around and along it),
 *   - a little shorter, and
 *   - curled sideways along direction `phi`, more and more toward the tip. */
function crumple(x: number, y: number, z: number, front: number, phi: number): [number, number, number] {
  const d = y - front
  if (d <= 0) return [x, y, z]
  const u = THREE.MathUtils.smoothstep(d, 0, 0.35)
  const ang = Math.atan2(z, x)
  const wrinkle = 1 + 0.09 * u * Math.sin(y * 85 + ang * 3 + phi) * Math.sin(y * 23 + phi * 2)
  const shrink = (1 - 0.36 * u) * wrinkle
  const dd = d * (1 - 0.1 * u)                        // shortens a little as it chars
  const bend = Math.min(0.28, 0.2 * dd * dd)          // a gentle curl, stronger toward the tip
  const lift = dd - 0.3 * bend
  return [x * shrink + Math.cos(phi) * bend, front + lift, z * shrink + Math.sin(phi) * bend]
}
const HEAD_COLOUR = new THREE.Color('#9E2B2B')
const SPENT_COLOUR = new THREE.Color('#2A1410')

function Match({ lit, gravityOn, quality, turn, onTilt }: {
  lit: boolean; gravityOn: boolean; quality: number
  turn: MutableRefObject<THREE.Quaternion>; onTilt?: (t: Tilt) => void
}) {
  const outer = useRef<THREE.Group>(null)          // rotates (around the pivot)
  const body = useRef<THREE.Group>(null)           // the match itself, in its own coordinates
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), d: new THREE.Vector3(), tilt: 'upright' as Tilt }), [])
  const s = useRef({ stage: 'unlit' as Stage, t: 0, p: 0, alive: 0, flare: 0, g: gravityOn ? 1 : 0, phi: 0.6, lastFront: 99, headScale: 1 })
  const head = useRef<THREE.MeshStandardMaterial>(null)
  const headMesh = useRef<THREE.Mesh>(null)
  // The charred part of the stick is a finely divided tube whose vertices are
  // moved every time the burn advances: it thins, wrinkles, shortens a little
  // and curls to one side, the way burnt match wood crumples.
  const charGeo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.054, 2.2, 16, 140), [])
  const charBase = useMemo(() => Float32Array.from(charGeo.attributes.position.array as Float32Array), [charGeo])
  useEffect(() => () => charGeo.dispose(), [charGeo])      // free GPU memory on unmount
  const ember = useRef<THREE.MeshBasicMaterial>(null)
  const emberMesh = useRef<THREE.Mesh>(null)
  const flame = useRef<FlameSource[]>([{ pos: [0, HEAD_Y, 0], radius: 0.12, stretch: 1, shell: 0, power: 0 }])
  // The cut between wood and char. three.js clips in SCENE coordinates, so the
  // planes are worked out along the match and then turned with it every frame.
  const planes = useMemo(() => ({ below: new THREE.Plane(new THREE.Vector3(0, -1, 0), STICK_TOP),
                                  above: new THREE.Plane(new THREE.Vector3(0, 1, 0), -STICK_TOP),
                                  localBelow: new THREE.Plane(new THREE.Vector3(0, -1, 0), STICK_TOP),
                                  localAbove: new THREE.Plane(new THREE.Vector3(0, 1, 0), -STICK_TOP) }), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1)        // a background tab must not skip the whole burn
    const m = s.current
    // Ease the gravity blend so the flame shape morphs instead of snapping.
    m.g += ((gravityOn ? 1 : 0) - m.g) * Math.min(1, delta * 2.5)

    // Turn the match smoothly toward where it was dragged.
    if (outer.current && body.current) {
      outer.current.quaternion.slerp(turn.current, Math.min(1, delta * 12))
      outer.current.updateMatrixWorld()
    }
    // Which way does the flame front travel? Along the stick, from head to base.
    const up = tmp.d.set(0, -1, 0).applyQuaternion(outer.current?.quaternion ?? new THREE.Quaternion()).y
    const tilt: Tilt = up < -0.5 ? 'upright' : up > 0.5 ? 'down' : 'sideways'
    if (tilt !== tmp.tilt) { tmp.tilt = tilt; onTilt?.(tilt) }

    if (!lit) { m.stage = 'unlit'; m.t = 0; m.p = 0 }
    else if (m.stage === 'unlit') { m.stage = 'strike'; m.t = 0; m.phi = Math.random() * Math.PI * 2 }   // each match curls its own way
    if (m.stage === 'strike') { m.t += delta; if (m.t > STRIKE_S) { m.stage = 'burning'; m.t = 0 } }
    if (m.stage === 'burning') {
      m.t += delta
      // Progress grows at the CURRENT rate; switching gravity changes speed only.
      // With gravity the tilt matters (see the header); in microgravity it doesn't.
      const rate = (gravityOn ? tiltSpeed(up) : 1) / (BURN_S * (gravityOn ? 1 : SLOWER_IN_0G))
      if (m.t > 1.2) m.p = Math.min(1, m.p + delta * rate)   // the head burns first
      if (m.p >= 1) { m.stage = 'out'; m.t = 0 }
    }
    if (m.stage === 'out') m.t += delta

    // Brightness: flare on strike, steady while burning, dying after burn-out.
    const target = m.stage === 'unlit' ? 0 : m.stage === 'out' ? Math.max(0, 1 - m.t * 0.8) : 1
    m.alive += (target - m.alive) * Math.min(1, delta * (target > m.alive ? 6 : 3))
    m.flare = m.stage === 'strike' ? Math.sin((m.t / STRIKE_S) * Math.PI) : Math.max(0, m.flare - delta * 3)

    const y = STICK_TOP - m.p * BURN_LENGTH
    planes.localBelow.constant = y
    planes.localAbove.constant = -y
    if (body.current) {
      planes.below.copy(planes.localBelow).applyMatrix4(body.current.matrixWorld)
      planes.above.copy(planes.localAbove).applyMatrix4(body.current.matrixWorld)
    }
    const onHead = m.stage === 'strike' || (m.stage === 'burning' && m.t < 1.2)
    const fy = onHead ? HEAD_Y : y + 0.05

    // The flame as a volumetric source: buoyant teardrop (1 g) or round shell (0 g).
    // It sits on the burning spot, wherever the turned match puts it, but its
    // axis stays straight up: hot gas rises whichever way the match points.
    const f = flame.current[0]
    const w = body.current ? body.current.localToWorld(tmp.v.set(0, fy, 0)) : tmp.v.set(0, fy, 0)
    f.pos = [w.x, w.y, w.z]
    f.axis = [0, 1, 0]
    f.radius = THREE.MathUtils.lerp(0.19, 0.22, m.g) * (1 + m.flare * 0.6)
    f.stretch = THREE.MathUtils.lerp(0.12, 2.6, m.g)
    f.shell = THREE.MathUtils.lerp(0.75, 0.1, m.g)
    f.power = m.alive * (1 + m.flare * 1.5)

    // ---- Crumple the char (only when the front has moved) ----------------
    const front = m.stage === 'unlit' ? STICK_TOP + 0.1 : y
    const tip = crumple(0, STICK_TOP + 0.04, 0, front, m.phi)
    if (Math.abs(front - m.lastFront) > 0.002) {
      m.lastFront = front
      const pos = charGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const [x, yy, z] = crumple(charBase[i * 3], charBase[i * 3 + 1] - 0.4, charBase[i * 3 + 2], front, m.phi)
        pos.setXYZ(i, x, yy + 0.4, z)
      }
      pos.needsUpdate = true
      charGeo.computeVertexNormals()
    }
    // The head shrinks as it burns. Physics: the head compound is the first
    // fuel consumed (strike + the first ~1.2 s), so most of the loss happens
    // there; afterwards the charred residue keeps losing a little mass while
    // the flame is still close, then stops once the flame has moved far away.
    const headStage = m.stage === 'unlit' ? 0 : m.stage === 'strike' ? 0.4 * (m.t / STRIKE_S) : m.stage === 'burning' && m.t < 1.2 ? 0.4 + 0.6 * (m.t / 1.2) : 1
    const charLoss = THREE.MathUtils.smoothstep(m.p, 0, 0.6)      // slows as the flame moves away
    m.headScale = 1 - 0.24 * headStage - 0.14 * charLoss
    // The spent head rides on the curled tip.
    if (headMesh.current) {
      headMesh.current.position.set(tip[0], tip[1] + (HEAD_Y - STICK_TOP - 0.04), tip[2])
      headMesh.current.scale.setScalar(m.headScale)
    }
    if (head.current) head.current.color.lerp(lit ? SPENT_COLOUR : HEAD_COLOUR, Math.min(1, delta * 2.5))
    if (ember.current && emberMesh.current) {
      emberMesh.current.position.y = y
      ember.current.opacity = m.stage === 'burning' && !onHead ? 0.9 : Math.max(0, ember.current.opacity - delta)
    }
  })

  const gNow = gravityOn ? 1 : 0
  return (
    <group>
      <group ref={outer} position={[0, PIVOT_Y, 0]}>
      <group ref={body} position={[0, -PIVOT_Y, 0]}>
      {/* stick: unburned wood below the front, char above it */}
      <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.055, 0.062, 2.2, 20]} />
        <meshStandardMaterial color="#D8B98A" roughness={0.85} clippingPlanes={[planes.below]} /></mesh>
      <mesh position={[0, -0.4, 0]} geometry={charGeo}>
        <meshStandardMaterial color="#1d1712" roughness={0.95} clippingPlanes={[planes.above]} /></mesh>
      {/* the glowing ring where wood is turning to char */}
      <mesh ref={emberMesh}><cylinderGeometry args={[0.058, 0.058, 0.02, 20]} />
        <meshBasicMaterial ref={ember} color="#ff6a1a" transparent opacity={0} /></mesh>
      <mesh ref={headMesh} position={[0, HEAD_Y, 0]}><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial ref={head} color="#9E2B2B" roughness={0.6} /></mesh>
      </group>
      </group>
      {/* The marching box follows the flame (and its rising plume). */}
      <VolumeFlame sources={flame} box={[1.1, 2.1, 1.1]}
                   flicker={reducedMotion ? 0 : gNow ? 1 : 0.06} sooty={gNow ? 0.95 : 0.15} dim={gNow ? 1 : 0.9}
                   quality={quality} light />
    </group>
  )
}

const AX = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1) }
const HINT: Record<Tilt, string> = {
  upright: 'Head up: the flame rises away from the wood, so it creeps down slowly.',
  sideways: 'Sideways: the rising flame licks the wood beside it, about 2× faster.',
  down: 'Head down: the flame climbs onto fresh wood, about 4× faster.',
}

export default function MatchScene({ lit, gravityOn, onContextLost }: { lit: boolean; gravityOn: boolean; onContextLost?: () => void }) {
  const [quality, setQuality] = useState(startQuality)
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  // Where the match should point; dragging changes it, the scene eases toward it.
  const turn = useRef(new THREE.Quaternion())
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [tilt, setTilt] = useState<Tilt>('upright')
  const [turned, setTurned] = useState(false)
  const q = useMemo(() => new THREE.Quaternion(), [])
  // Drag sideways: tip the match left/right; drag up/down: tip it toward/away from you.
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    d.x = e.clientX; d.y = e.clientY
    turn.current.premultiply(q.setFromAxisAngle(AX.z, -dx * 0.012)).premultiply(q.setFromAxisAngle(AX.x, dy * 0.012)).normalize()
    if (!turned) setTurned(true)
  }
  const upright = () => { turn.current.identity(); setTurned(false) }
  return (
    <div ref={wrap} className="h-full cursor-grab active:cursor-grabbing touch-none" role="img"
         aria-label={`3D match, ${lit ? 'burning' : 'unlit'}, held ${tilt === 'upright' ? 'head up' : tilt === 'down' ? 'head down' : 'sideways'}, gravity ${gravityOn ? 'on: the flame rises straight up' : 'off: a small, round, blue flame'}. Drag to turn it. Illustration.`}
         onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }}
         onPointerMove={onMove}
         onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
         onDoubleClick={upright}>
      {/* What turning the match does, in one line. */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-start gap-2 pointer-events-none">
        <p className="rounded bg-black/55 px-2.5 py-1.5 text-[12.5px] text-slate-100 max-w-md">
          {!turned ? 'Drag to turn the match.' : gravityOn ? HINT[tilt] : 'No "up" in orbit: the flame stays round whichever way the match points.'}
        </p>
        {turned && (
          <button onClick={upright} onPointerDown={(e) => e.stopPropagation()}
                  className="pointer-events-auto rounded bg-black/55 px-2.5 py-1.5 text-[12.5px] text-slate-100 hover:bg-black/70">
            Stand it upright
          </button>
        )}
      </div>
      {/* Off-screen or hidden tab: stop rendering entirely (saves phones). */}
      <Canvas frameloop={inView ? 'always' : 'never'} camera={{ position: [0, 0.4, 4.6], fov: 40 }}
              dpr={lowPower ? 0.75 : quality < 1 ? 1 : [1, 1.5]} gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                gl.localClippingEnabled = true
                // A lost GPU context (driver reset, too many tabs): switch to 2D.
                gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost?.() }, { once: true })
              }}>
        {/* Drops the flame's ray-march steps when the frame rate falls. */}
        <PerformanceMonitor onDecline={() => setQuality((q) => (q > 0.5 ? 0.5 : 0.3))} onIncline={() => setQuality((q) => (lowPower ? Math.min(0.5, q + 0.2) : 1))} />
        <color attach="background" args={['#0B0F17']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <Match lit={lit} gravityOn={gravityOn} quality={quality} turn={turn} onTilt={setTilt} />
        {/* Dragging turns the match itself, so the camera only zooms. */}
        <OrbitControls enablePan={false} enableRotate={false} minDistance={2.6} maxDistance={8} target={[0, 0.1, 0]} />
      </Canvas>
    </div>
  )
}
