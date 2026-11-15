// =============================================================================
//  AI SEARCH PAGE
// =============================================================================
//  Ask in plain words ("which fabrics went out when the airflow dropped?") and
//  get the closest records, findings, questions and materials, by meaning
//  rather than exact words. Runs entirely in the browser (see src/search.ts).
//  It shows existing text with its source; it never writes an answer.
// =============================================================================

import { useEffect, useState } from 'react'
import type { Dataset } from '../data'
import { onModelProgress, searchWithFallback, warmUp } from '../search'
import type { Hit, SearchDoc } from '../search'
import { useDataMode } from '../context/DataModeContext'
import { Page, Section } from '../ui'

const TYPES: [string, string][] = [
  ['record', 'Test records'], ['finding', 'Findings'], ['negative', 'What failed'], ['question', 'Research questions'],
  ['material', 'Materials'], ['recommendation', 'Habitat recommendations'], ['literature', 'NASA reports'], ['glossary', 'Glossary'],
]
/** Lowest similarity shown (see the measurement note in run()). */
const MIN_SCORE = 0.28

const EXAMPLES = [
  'flames that went out when the airflow was turned down',
  'materials that burn on Earth but not in space',
  'what happens at lunar gravity',
  'smoke detectors and dust',
  'droplets that kept burning after the flame disappeared',
]

export default function Search({ data }: { data: Dataset }) {
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<Set<string>>(new Set())
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [tooShort, setTooShort] = useState(false)
  const [mode, setMode] = useState<{ mode: 'semantic' | 'lexical'; reason?: string } | null>(null)
  const { strictPsiOnly } = useDataMode()
  useEffect(() => { onModelProgress((f) => setProgress(f)); return () => onModelProgress(null) }, [])

  const run = async (text: string) => {
    if (!text.trim()) return
    setQ(text)
    // A single letter has no meaning to compare; ask for a real word or question.
    if (!/[a-z0-9]{3,}/i.test(text)) { setHits([]); setMode(null); setTooShort(true); return }
    setTooShort(false); setState('loading')
    // Strict PSI mode leaves out items that come only from NASA reports outside PSI.
    const keep = (d: SearchDoc) => (!types.size || types.has(d.type)) && (!strictPsiOnly || d.strict)
    try {
      const r = await searchWithFallback(text, 25, keep)
      // Similarity below MIN_SCORE is noise: measured, nonsense queries ("hello", "pizza recipe": 0.25-0.26;
      // real questions score 0.45-0.72 at the top).
      setHits(r.mode === 'semantic' ? r.hits.filter((h) => h.score >= MIN_SCORE) : r.hits)
      setMode({ mode: r.mode, reason: r.reason }); setState('idle')
    }
    catch (e) { setErr((e as Error).message); setState('error') }
  }
  const toggle = (t: string) => setTypes((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })
  const label = Object.fromEntries(TYPES)

  return (
    <Page title="AI search" intro={<>
      Ask in your own words. A small AI language model running in your browser finds the {data.tests.length.toLocaleString()} records,
      findings, research questions and materials closest in meaning to your question, even when they use different words.
    </>}>
      <div className="space-y-8">
        <form className="card p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); void run(q) }}>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={warmUp} aria-label="Search question"
                   placeholder="e.g. which fabrics went out when the airflow dropped?" className="field flex-1 min-w-[220px] !py-2.5" />
            <button className="btn btn-primary" disabled={state === 'loading'}>{state === 'loading' ? 'Searching…' : 'Search'}</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.filter(([t]) => !strictPsiOnly || !['literature', 'glossary'].includes(t)).map(([t, l]) => <button type="button" key={t} onClick={() => toggle(t)} className={`chip ${types.has(t) ? 'chip-on' : ''}`}>{l}</button>)}
          </div>
          <p className="caption">Try: {EXAMPLES.map((x, i) => (
            <span key={x}>{i > 0 && ' · '}<button type="button" className="text-accent hover:underline" onClick={() => void run(x)}>{x}</button></span>
          ))}</p>
          {progress != null && progress < 1 ? (
            <div aria-live="polite">
              <div className="h-1.5 rounded-full bg-wash overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <p className="caption mt-1">Downloading the AI model from this site: {Math.round(progress * 100)}% (one time only; about 50 MB)</p>
            </div>
          ) : (
            <p className="caption">The first search downloads the model once (about 50 MB, from this site); after that it runs offline.</p>
          )}
        </form>

        {state === 'error' && <p className="wash p-4 small">The search could not start: {err}. The keyword search on the <a href="#/data">Data</a> page still works.</p>}

        {hits && (
          <Section title={`Closest matches for “${q}”`}>
            {mode?.mode === 'lexical' && (
              <p className="wash p-3 small text-ink2 mb-3" aria-live="polite"><b className="text-ink">Keyword fallback:</b> {mode.reason}, so these
                results match your words, not their meaning. Search again once the model has loaded for AI results.</p>
            )}
            {hits.length === 0 && (
              <p className="wash p-4 small text-ink2">
                {tooShort ? 'Type at least one word (three letters or more), or a question in plain words.'
                  : <>Nothing in the data is close in meaning to this. Try a full question, for example “materials that burn on Earth but not in space”{types.size ? ', or turn off the type filters' : ''}.</>}
              </p>
            )}
            {strictPsiOnly && <p className="caption mb-3">Strict PSI mode: items that come only from NASA reports outside PSI are left out, and BASS-II rows are shown without their Appendix A notes.</p>}
            <ol className="divide-y divide-rule border-y border-rule">
              {hits.map((h) => (
                <li key={`${h.doc.type}-${h.doc.id}`} className="py-3 grid sm:grid-cols-[140px_1fr_70px] gap-x-4 gap-y-1">
                  <span className="caption">{label[h.doc.type] ?? h.doc.type}</span>
                  <div>
                    <a href={h.doc.link} className="font-medium">{h.doc.title}</a>
                    <p className="small text-ink2">{strictPsiOnly && h.doc.text_strict != null ? h.doc.text_strict : h.doc.text}</p>
                    <SourceBadge doc={h.doc} strict={strictPsiOnly} />
                  </div>
                  <span className="caption num sm:text-right" title={mode?.mode === 'lexical' ? 'Share of your (weighted) words this item contains' : 'Cosine similarity between your question and this item (1 = same meaning)'}>{h.score.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <Section title="How it works">
          <ol className="list-decimal pl-5 space-y-2 text-ink2 max-w-3xl">
            <li>When the site was built, a small open AI model (all-MiniLM-L6-v2, Apache-2.0) turned every record, finding, question,
              material, recommendation and glossary term into a list of 384 numbers that captures its meaning.</li>
            <li>Your question is turned into the same kind of list by the same model, running in your browser from files on this site.
              Nothing is sent anywhere: there is no server, no API and no key.</li>
            <li>The page lists the items whose meaning is closest (cosine similarity). Every result is existing text from NASA's tables
              or NASA documents, with a link to where it lives.</li>
            <li><b className="text-ink">It never writes an answer.</b> It cannot invent a number, because it only retrieves.</li>
          </ol>
        </Section>
      </div>
    </Page>
  )
}

/** Where a result comes from: a PSI table with its DOI, or a NASA report outside PSI. */
function SourceBadge({ doc, strict }: { doc: SearchDoc; strict: boolean }) {
  const s = doc.src
  const ntrs = Array.isArray(s.ntrs) ? s.ntrs : s.ntrs ? [s.ntrs] : []
  const psi = s.psi ? <>NASA PSI · {s.psi}{s.doi ? <> · DOI {s.doi}</> : null}</> : <>NASA PSI tables</>
  return (
    <p className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
      {s.kind !== 'ntrs' && <span className="inline-flex items-center gap-1 rounded border border-[#1f7a4d]/40 px-1.5 py-0.5 text-[#1f7a4d]">{psi}</span>}
      {(s.kind !== 'psi' || (s.appendix && !strict)) && (
        <span className="inline-flex items-center gap-1 rounded border border-accent/40 px-1.5 py-0.5 text-accent">
          External NTRS{s.appendix && s.kind === 'psi' ? ' · BASS-II report App. A (ending notes)' : ntrs.length ? ` · ${ntrs.join(', ')}` : ''}
        </span>
      )}
    </p>
  )
}
