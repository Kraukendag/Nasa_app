// =============================================================================
//  WEBGL SAFETY NET
// =============================================================================
//  Some computers, headless browsers and judging environments have no WebGL
//  (no 3D graphics). Without this, a 3D scene that fails to start would take
//  the whole page down. Two layers:
//   1. isWebGLAvailable(): probe for WebGL before mounting a 3D scene.
//   2. <WebGLErrorBoundary>: if a 3D scene still throws (shader error, lost
//      context), show the 2D fallback instead of a blank page.
// =============================================================================

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export interface WebGLSupport { webgl1: boolean; webgl2: boolean; maxTextureSize: number }

let cached: WebGLSupport | null = null
export function isWebGLAvailable(): WebGLSupport {
  if (cached) return cached
  const out: WebGLSupport = { webgl1: false, webgl2: false, maxTextureSize: 0 }
  try {
    const c = document.createElement('canvas')
    const gl2 = c.getContext('webgl2') as WebGL2RenderingContext | null
    const gl = gl2 ?? (c.getContext('webgl') as WebGLRenderingContext | null) ?? (c.getContext('experimental-webgl') as WebGLRenderingContext | null)
    out.webgl2 = !!gl2
    out.webgl1 = !!gl
    if (gl) out.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    gl?.getExtension('WEBGL_lose_context')?.loseContext()      // free the probe context
  } catch {
    // any error = treat as no WebGL
  }
  cached = out
  return out
}

interface Props { fallback: ReactNode; children: ReactNode; onError?: () => void }
interface State { failed: boolean }

export default class WebGLErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D view failed; showing the 2D schematic instead.', error.message, info.componentStack?.slice(0, 200))
    this.props.onError?.()
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
