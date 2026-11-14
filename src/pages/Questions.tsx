// =============================================================================
//  RESEARCH QUESTIONS
// =============================================================================
//  Open questions where knowledge about fire in space is missing. Each one is
//  written from a specific gap in the data (scripts/research_questions.py) and
//  says: why it matters, what is already known, exactly what is missing, what
//  experiment could answer it, and what it should measure.
//
//  Filter by theme or priority, search, and download the list as CSV so a
//  team can take it into a proposal.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../data'
import type { ResearchQuestion } from '../types'
import { Page } from '../ui'

export default function Questions({ data }: { data: Dataset }) {
  const all = data.findings.research_questions
  const picks = data.findings.team_picks.map((id) => all.find((x) => x.id === id)).filter((x): x is ResearchQuestion => !!x)
  const [theme, setTheme] = useState<string>('all')
  const [high, setHigh] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const themes = useMemo(() => {
    const c = new Map<string, number>()
    all.forEach((x) => c.set(x.theme, (c.get(x.theme) ?? 0) + 1))
    return [...c.entries()]
  }, [all])

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return all.filter((x) => (theme === 'all' || x.theme === theme) && (!high || x.priority === 'high')
      && words.every((w) => `${x.question} ${x.why} ${x.known} ${x.gap} ${x.answer_by} ${x.measure}`.toLowerCase().includes(w)))
  }, [all, theme, high, q])

  const grouped = useMemo(() => {
    const g = new Map<string, ResearchQuestion[]>()
    shown.forEach((x) => g.set(x.theme, [...(g.get(x.theme) ?? []), x]))
    return [...g.entries()]
  }, [shown])

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const highCount = all.filter((x) => x.priority === 'high').length

  return (
    <Page title="Research questions" intro={<>
      {all.length} open questions about fire in space that the existing data cannot answer. Each comes from a specific hole
      in the records: an oxygen level never tested, a gravity never reached, a material never burned, a measurement never
      taken. Together they are a map of what is still to be discovered.
    </>}>
      <div className="space-y-8">
        <section className="card p-6">
          <h2 className="h2">Team picks: the ten that matter most</h2>
          <p className="small text-ink2 mt-2 max-w-3xl">The questions this team would fund first for a lunar habitat. The full list of {all.length} follows.</p>
          <ol className="mt-4 space-y-2.5">
            {picks.map((x, i) => (
              <li key={x.id} className="grid grid-cols-[28px_1fr] gap-2">
                <span className="num text-accent">{i + 1}</span>
                <button onClick={() => { setTheme('all'); setHigh(false); setQ(''); setOpen(new Set([x.id]));
                                         setTimeout(() => document.getElementById(`q-${x.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
                        className="text-left hover:text-accent">
                  <span className="font-medium">{x.question}</span> <span className="caption num">{x.id} · {x.theme}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTheme('all')} className={`chip ${theme === 'all' ? 'chip-on' : ''}`}>All themes <span className="num text-[12px] text-mute">{all.length}</span></button>
            {themes.map(([t, n]) => (
              <button key={t} onClick={() => setTheme(t)} className={`chip ${theme === t ? 'chip-on' : ''}`}>{t} <span className="num text-[12px] text-mute">{n}</span></button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the questions, e.g. oxygen · smoke · Mars"
                   className="field flex-1 min-w-[220px]" aria-label="Search questions" />
            <label className="flex items-center gap-2 small text-ink2 cursor-pointer">
              <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} className="accent-accent" />
              High priority only ({highCount})
            </label>
            <button className="btn" onClick={() => setOpen(open.size ? new Set() : new Set(shown.map((x) => x.id)))}>{open.size ? 'Collapse all' : 'Expand all'}</button>
            <button className="btn" onClick={() => downloadCsv(shown)}>Download CSV</button>
          </div>
          <p className="caption">
            Priority “high” marks questions that bear directly on crew safety for the next missions (lunar habitat
            atmosphere, partial gravity, detection). Showing {shown.length} of {all.length}.
          </p>
        </div>

        {grouped.map(([t, list]) => (
          <section key={t}>
            <h2 className="h2">{t}</h2>
            <ol className="mt-4 divide-y divide-rule border-y border-rule">
              {list.map((x) => {
                const isOpen = open.has(x.id)
                return (
                  <li key={x.id} id={`q-${x.id}`} className="scroll-mt-24">
                    <button onClick={() => toggle(x.id)} aria-expanded={isOpen}
                            className="w-full text-left py-4 grid grid-cols-[48px_1fr_auto] gap-3 items-baseline hover:bg-wash/60 px-1">
                      <span className="num caption">{x.id}</span>
                      <span className="font-medium text-ink">{x.question}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        {x.priority === 'high' && <span className="flag flag-warn">high</span>}
                        <span className="text-mute" aria-hidden>{isOpen ? '−' : '+'}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <dl className="pl-[60px] pr-2 pb-5 grid md:grid-cols-2 gap-x-8 gap-y-3 small enter">
                        <Item k="Why it matters" v={x.why} />
                        <Item k="What is known" v={x.known} />
                        <Item k="What is missing" v={x.gap} strong />
                        <Item k="How it could be answered" v={x.answer_by} />
                        <Item k="What to measure" v={x.measure} />
                        {x.refs.length > 0 && (
                          <div><dt className="caption font-medium text-ink2">Sources</dt>
                            <dd className="text-ink2">{x.refs.map((r) => {
                              const s = data.literature.sources[r]
                              const inv = data.investigations.find((i) => i.psi_id === r)
                              return s ? <a key={r} href={s.url} target="_blank" rel="noreferrer" className="mr-3">{s.authors.split(',')[0]} (NTRS {s.ntrs})</a>
                                : <span key={r} className="mr-3 num">{inv ? `${r} ${inv.acronym}` : r}</span>
                            })}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
        {!shown.length && <p className="caption">No question matches. Try fewer words or another theme.</p>}
      </div>
    </Page>
  )
}

function Item({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div><dt className="caption font-medium text-ink2">{k}</dt><dd className={strong ? 'text-ink' : 'text-ink2'}>{v}</dd></div>
}

/** Save the shown questions as a CSV file, generated in the browser. */
function downloadCsv(list: ResearchQuestion[]) {
  const cols: (keyof ResearchQuestion)[] = ['id', 'theme', 'priority', 'question', 'why', 'known', 'gap', 'answer_by', 'measure', 'refs']
  const esc = (v: unknown) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...list.map((x) => cols.map((c) => esc(x[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'microflamma-research-questions.csv'
  a.click()
  URL.revokeObjectURL(url)
}
