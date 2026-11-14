// =============================================================================
//  TAB 4 — INSIGHTS
// =============================================================================
//  The challenge asks for a dashboard that summarises, RANKS and INTERPRETS
//  the investigations. This tab is that part:
//    Key findings      the headline results, each with its source
//    Mission ranking   which investigations matter most for a scenario
//    Negative knowledge what failed, broke, surprised, or was never asked
//    Open questions    generated from the empty cells of the coverage grid
//    Ask the data      keyword retrieval with citations
// =============================================================================

import { useState } from 'react'
import type { Dataset } from '../data'
import { invLabel } from '../data'
import Ask from './insights/Ask'
import Negative from './insights/Negative'
import Questions from './insights/Questions'
import Ranking from './insights/Ranking'

type View = 'findings' | 'ranking' | 'negative' | 'questions' | 'ask'
const VIEWS: [View, string][] = [['findings', 'Key findings'], ['ranking', 'Mission ranking'], ['negative', 'Negative knowledge'],
  ['questions', 'Open questions'], ['ask', 'Ask the data']]

export default function TabInsights({ data, onSearchRows }: { data: Dataset; onSearchRows: (q: string) => void }) {
  const [view, setView] = useState<View>('findings')
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="border-b border-edge px-4 flex items-center gap-1 overflow-x-auto">
        {VIEWS.map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`relative px-3 py-2.5 text-xs whitespace-nowrap ${view === k ? 'text-white' : 'text-mute hover:text-slate-200'}`}>
            {l}{view === k && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-cryo anim-fade-in" />}
          </button>
        ))}
      </div>
      <div key={view} className="flex-1 overflow-y-auto anim-fade-in">
        <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
          {view === 'findings' && <Findings data={data} />}
          {view === 'ranking' && <Ranking data={data} />}
          {view === 'negative' && <Negative data={data} />}
          {view === 'questions' && <Questions data={data} />}
          {view === 'ask' && <Ask data={data} onSearchRows={onSearchRows} />}
        </div>
      </div>
    </div>
  )
}

function Findings({ data }: { data: Dataset }) {
  const f = data.findings
  return (
    <div className="space-y-6">
      <section className="grid md:grid-cols-3 gap-3 stagger">
        {f.key_insights.map((k) => (
          <article key={k.id} className="panel p-4">
            <h3 className="text-[13px] font-semibold text-slate-100 leading-snug">{k.headline}</h3>
            <p className="text-[11.5px] text-slate-300 mt-2 leading-relaxed">{k.detail}</p>
            <div className="mt-3 text-[10px] text-mute space-y-0.5">
              <div className="font-mono text-cryo">{invLabel(data, k.psi_id)}</div>
              <div>{k.source}</div>
              {k.doi && <a href={`https://doi.org/${k.doi}`} target="_blank" rel="noreferrer" className="hover:text-cryo">DOI {k.doi} ↗</a>}
            </div>
          </article>
        ))}
      </section>
      <section>
        <div className="label mb-2">Surprises</div>
        <div className="grid md:grid-cols-2 gap-2">
          {f.surprises.map((s) => (
            <article key={s.id} className="panel-flat p-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-100">{s.title}</span>
                <span className={`badge ${s.evidence_class === 'E1' ? 'badge-ok' : 'badge-warn'}`}>{s.evidence_class === 'E1' ? 'in the PSI tables' : 'published finding, outside the table'}</span>
              </div>
              <p className="text-[11.5px] text-slate-300 mt-1.5 leading-relaxed">{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel p-4">
        <div className="label mb-1.5">About the BASS-II outcomes</div>
        <p className="text-[11px] text-slate-300 leading-relaxed">{f.transcription_note}</p>
      </section>
      <section className="panel p-4">
        <div className="label mb-1.5">Gravity</div>
        <p className="text-[11px] text-slate-300 leading-relaxed">{f.gravity.note}</p>
      </section>
    </div>
  )
}
