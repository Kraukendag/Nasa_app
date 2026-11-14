// =============================================================================
//  INSIGHTS · ASK THE DATA
// =============================================================================
//  Type a question; get the passages of this dataset that match it, each with
//  its citation. This is keyword retrieval (TF-IDF) running in your browser --
//  not a chatbot, and it never writes an answer of its own. When nothing
//  matches, it says so instead of guessing.
//
//  No server and no API key are involved, so it works offline.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'
import { invLabel } from '../../data'

const STOP = new Set('the a an of in on at to for and or is are was were be what which who how does did do with by from that this these those it its as can will would there their than then when where why about into over under not no any all most more much many'.split(' '))
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9%.₂ ]+/g, ' ').split(/\s+/)
  .map((w) => w.replace(/\.$/, '')).filter((w) => w.length > 1 && !STOP.has(w))

const SUGGESTED = ['Which materials failed to ignite?', 'Moon base oxygen', 'cool flames butane', 'silicone microgravity',
  'PMMA blowoff', 'smoke detector dust', 'sensor failure']

export default function Ask({ data, onSearchRows }: { data: Dataset; onSearchRows: (q: string) => void }) {
  const [q, setQ] = useState('')
  const index = useMemo(() => {
    const docs = data.knowledge.map((d) => ({ d, terms: tokens(`${d.title} ${d.title} ${d.text}`) }))
    const df = new Map<string, number>()
    docs.forEach(({ terms }) => new Set(terms).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)))
    return { docs, df, n: docs.length }
  }, [data.knowledge])

  const answer = useMemo(() => {
    const qt = tokens(q)
    if (!qt.length) return null
    const scored = index.docs.map(({ d, terms }) => {
      let s = 0
      for (const t of qt) {
        // Prefix match lets "ignite" find "ignited" and "ignition".
        const tf = terms.filter((x) => x === t || (t.length > 3 && x.startsWith(t.slice(0, Math.max(4, t.length - 2))))).length
        if (tf) s += (1 + Math.log(tf)) * Math.log(1 + index.n / (index.df.get(t) ?? 1))
      }
      return { d, s: s / Math.sqrt(qt.length) }
    }).filter((x) => x.s > 1.2).sort((a, b) => b.s - a.s).slice(0, 6)
    const rowWords = qt.filter((t) => t.length > 2)
    const rows = rowWords.length ? data.tests.filter((t) => rowWords.every((w) => t.search_text.includes(w))).length : 0
    return { scored, rows, rowQuery: rowWords.join(' '), qt }
  }, [q, index, data.tests])

  const mark = (text: string, qt: string[]) => {
    const parts = text.split(new RegExp(`(${qt.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig'))
    return parts.map((p, i) => (qt.some((t) => p.toLowerCase() === t) ? <mark key={i} className="bg-star/25 text-white rounded px-0.5">{p}</mark> : p))
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
               placeholder="Ask about the data, e.g. which materials failed to ignite?"
               className="w-full bg-navy/50 border border-edge rounded-md px-4 py-3 text-sm placeholder:text-mute/60 focus:outline-none focus:border-cryo/60" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTED.map((s) => <button key={s} onClick={() => setQ(s)} className="text-[10.5px] px-2 py-1 rounded border border-edge text-mute hover:text-slate-200 hover:border-mute/50">{s}</button>)}
        </div>
        <p className="text-[10px] text-mute mt-2">Keyword retrieval over this dataset's investigations, findings and material cards. It returns matching passages with citations; it does not write answers.</p>
      </div>

      {answer && (
        <div className="space-y-2 anim-fade-in">
          {answer.scored.length === 0 && answer.rows === 0 && (
            <div className="panel p-4"><span className="badge badge-dead">No data</span>
              <p className="text-[12px] text-slate-300 mt-2">Nothing in this dataset matches that question. The 14 tables may simply not cover it.</p></div>
          )}
          {answer.scored.map(({ d }) => (
            <article key={d.id} className="panel-flat p-3">
              <div className="flex items-center gap-2">
                <span className="badge badge-dead">{d.kind}</span>
                <span className="text-[12px] text-slate-100">{mark(d.title, answer.qt)}</span>
              </div>
              <p className="text-[11.5px] text-slate-300 mt-1.5 leading-relaxed">{mark(d.text.slice(0, 420), answer.qt)}{d.text.length > 420 ? '…' : ''}</p>
              <div className="flex gap-3 mt-1.5 text-[10px] text-mute">
                {d.psi_id && <span className="font-mono text-cryo">{invLabel(data, d.psi_id)}</span>}
                {d.doi && <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noreferrer" className="hover:text-cryo">DOI {d.doi} ↗</a>}
              </div>
            </article>
          ))}
          {answer.rows > 0 && (
            <button onClick={() => onSearchRows(answer.rowQuery)} className="btn text-xs">
              {answer.rows} test rows contain “{answer.rowQuery}” — open them in the Data Library →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
