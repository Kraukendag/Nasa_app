// =============================================================================
//  AI SEARCH (in the browser, offline, retrieval only)
// =============================================================================
//  1. Load the prebuilt index (public/data/search_index.json): one meaning
//     vector per record, finding, question, material, recommendation and
//     glossary term, made at build time by scripts/build_search_index.mjs.
//  2. Load the same small open model (all-MiniLM-L6-v2) FROM THIS SITE
//     (public/models) and its runtime (public/ort). No request leaves the site;
//     there is no API and no key.
//  3. Turn the question into a vector and return the closest items by cosine
//     similarity. Nothing is generated: every result is existing text with a
//     link to where it lives on the site.
// =============================================================================

export interface SearchDoc { type: string; id: string; title: string; text: string; link: string }
interface Index { model: string; dim: number; count: number; docs: SearchDoc[]; vectors_int8_base64: string }
export interface Hit { doc: SearchDoc; score: number }

/** Download progress of the model files (0-1), for the page's progress bar. */
type ProgressFn = (fraction: number) => void
let progressFn: ProgressFn | null = null
export function onModelProgress(fn: ProgressFn | null) { progressFn = fn }
const files = new Map<string, { loaded: number; total: number }>()

let indexP: Promise<{ docs: SearchDoc[]; vecs: Int8Array; dim: number }> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedP: Promise<any> | null = null

function loadIndex() {
  indexP ??= fetch(`${import.meta.env.BASE_URL}data/search_index.json`)
    .then((r) => { if (!r.ok) throw new Error('search index missing'); return r.json() as Promise<Index> })
    .then((ix) => {
      const bin = atob(ix.vectors_int8_base64)
      const vecs = new Int8Array(bin.length)
      for (let i = 0; i < bin.length; i++) vecs[i] = (bin.charCodeAt(i) << 24) >> 24
      return { docs: ix.docs, vecs, dim: ix.dim }
    })
  return indexP
}

function loadModel() {
  embedP ??= (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    const base = new URL(import.meta.env.BASE_URL, window.location.href).href
    env.allowRemoteModels = false                 // never fetch from the internet
    env.allowLocalModels = true
    // A RELATIVE path on purpose: transformers.js only checks local files for
    // non-URL paths, and with remote downloads off a full URL would make it
    // skip the tokenizer.
    env.localModelPath = `${import.meta.env.BASE_URL}models/`
    const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number } }
    if (onnx.wasm) {
      onnx.wasm.wasmPaths = { mjs: `${base}ort/ort-wasm-simd-threaded.asyncify.mjs`, wasm: `${base}ort/ort-wasm-simd-threaded.asyncify.wasm` }
      onnx.wasm.numThreads = 1                     // GitHub Pages is not cross-origin isolated
    }
    return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8', device: 'wasm',
      // Sum the progress of every file the model needs.
      progress_callback: (x: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (x.file && typeof x.loaded === 'number' && typeof x.total === 'number' && x.total > 0) {
          files.set(x.file, { loaded: x.loaded, total: x.total })
          let l = 0, t = 0
          files.forEach((f) => { l += f.loaded; t += f.total })
          progressFn?.(t ? l / t : 0)
        }
        if (x.status === 'ready') progressFn?.(1)
      },
    })
  })()
  return embedP
}

/** Start downloading the index and model early (e.g. when the box is focused). */
export function warmUp() { void loadIndex(); void loadModel() }

export async function search(query: string, k = 20, types?: Set<string>): Promise<Hit[]> {
  const [ix, embed] = await Promise.all([loadIndex(), loadModel()])
  const out = await embed(query, { pooling: 'mean', normalize: true })
  const q = out.data as Float32Array
  const { docs, vecs, dim } = ix
  const hits: Hit[] = []
  for (let i = 0; i < docs.length; i++) {
    if (types && types.size && !types.has(docs[i].type)) continue
    let s = 0
    const o = i * dim
    for (let j = 0; j < dim; j++) s += q[j] * vecs[o + j]
    hits.push({ doc: docs[i], score: s / 127 })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k)
}
