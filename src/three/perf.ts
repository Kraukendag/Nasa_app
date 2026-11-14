// =============================================================================
//  PERFORMANCE HELPERS FOR THE 3D SCENES
// =============================================================================
//  Phones were laggy, so every 3D scene uses these:
//   * lowPower: touch screen, small screen or few CPU cores -> start the flames
//     in their cheapest mode (fewer ray-march steps, simpler noise, 1x pixels).
//   * reducedMotion: the visitor asked their system for less motion -> no
//     auto-rotation and no flicker.
//   * useInView: a scene that is scrolled off-screen, or in a hidden tab,
//     stops rendering entirely (React Three Fiber's frameloop = 'never').
// =============================================================================

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia?.(q).matches

export const lowPower: boolean = typeof window !== 'undefined' && (
  !!mq('(pointer: coarse)') || window.innerWidth < 900 || (navigator.hardwareConcurrency ?? 8) <= 4)

export const reducedMotion: boolean = !!mq('(prefers-reduced-motion: reduce)')

/** Starting quality for the volumetric flames: 1 full, 0.5 reduced, 0.3 phone. */
export const startQuality = lowPower ? 0.3 : 1

/** True while the element is on screen and the tab is visible. */
export function useInView(ref: RefObject<Element>): boolean {
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  useEffect(() => {
    const on = () => setTabVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return onScreen && tabVisible
}
