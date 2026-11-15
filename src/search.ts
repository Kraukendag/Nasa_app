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

/** Where an item comes from: a PSI table (with DOI), a NASA report outside PSI (NTRS), or both. */
export interface DocSource { kind: 'psi' | 'ntrs' | 'mixed'; psi?: string | null; doi?: string | null; ntrs?: string | string[] | null; title?: string; appendix?: boolean }
export interface SearchDoc {
  type: string; id: string; title: string; text: string; link: string; src: DocSource
  /** Kept in strict PSI mode. */
  strict: boolean
  /** The same item with Appendix A (NTRS) fields removed, for strict mode. */
  text_strict?: string
}
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
  indexP ??= fetch(`${import.meta.env.BASE_URL}data/search_index.json?v=${__BUILD_ID__}`)
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

export async function search(query: string, k = 20, keep: (d: SearchDoc) => boolean = () => true): Promise<Hit[]> {
  const [ix, embed] = await Promise.all([loadIndex(), loadModel()])
  const out = await embed(query, { pooling: 'mean', normalize: true })
  const q = out.data as Float32Array
  const { docs, vecs, dim } = ix
  const hits: Hit[] = []
  for (let i = 0; i < docs.length; i++) {
    if (!keep(docs[i])) continue
    let s = 0
    const o = i * dim
    for (let j = 0; j < dim; j++) s += q[j] * vecs[o + j]
    hits.push({ doc: docs[i], score: s / 127 })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k)
}

// ---- Keyword fallback -------------------------------------------------------
// When the model cannot load (blocked download, old browser, slow phone) the
// page still answers, by matching WORDS instead of meaning. Each query word
// counts more when it is rare across the index (inverse document frequency).
const STOP = new Set('the a an and or of in on at to for with by from is are was were be that this which what how did do does it its as into than then'.split(' '))
const words = (x: string) => x.toLowerCase().normalize('NFKD').replace(/[^a-z0-9.%-]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w))
let idf: Map<string, number> | null = null

export async function lexicalSearch(query: string, k = 20, keep: (d: SearchDoc) => boolean = () => true): Promise<Hit[]> {
  const { docs } = await loadIndex()
  if (!idf) {
    const df = new Map<string, number>()
    for (const d of docs) new Set(words(`${d.title} ${d.text}`)).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1))
    idf = new Map([...df].map(([w, n]) => [w, Math.log(1 + docs.length / n)]))
  }
  const q = [...new Set(words(query))]
  if (!q.length) return []
  const max = q.reduce((a, w) => a + (idf!.get(w) ?? 0), 0) || 1
  const hits: Hit[] = []
  for (const d of docs) {
    if (!keep(d)) continue
    const have = new Set(words(`${d.title} ${d.text}`))
    // A query word also matches a longer form ("burn" finds "burned").
    const s = q.reduce((a, w) => a + (have.has(w) || [...have].some((h) => h.startsWith(w) && w.length > 3) ? idf!.get(w) ?? 0 : 0), 0)
    if (s > 0) hits.push({ doc: d, score: s / max })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k)
}

/** AI search, or keyword search when the model fails or takes longer than
 *  `waitMs` to become ready (the download keeps going in the background, so
 *  a later search can use the model). */
export async function searchWithFallback(query: string, k: number, keep: (d: SearchDoc) => boolean, waitMs = 8000):
  Promise<{ hits: Hit[]; mode: 'semantic' | 'lexical'; reason?: string }> {
  const ready = loadModel().then(() => 'ready' as const, (e: Error) => e)
  const timer = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), waitMs))
  const first = await Promise.race([ready, timer])
  if (first === 'ready') {
    try { return { hits: await search(query, k, keep), mode: 'semantic' } } catch (e) { return { hits: await lexicalSearch(query, k, keep), mode: 'lexical', reason: (e as Error).message } }
  }
  if (first instanceof Error) embedP = null           // allow a retry next time
  return { hits: await lexicalSearch(query, k, keep), mode: 'lexical',
    reason: first === 'timeout' ? `the AI model was not ready after ${waitMs / 1000} s` : first.message }
}
