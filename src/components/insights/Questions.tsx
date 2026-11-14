// =============================================================================
//  INSIGHTS · OPEN QUESTIONS
// =============================================================================
//  Questions for future researchers, generated from the EMPTY cells of the
//  coverage grid -- not written by hand. Each carries the evidence that the
//  cell is empty, a Moon-base relevance score with its formula shown, what
//  could measure it, and which upcoming experiment could answer it.
// =============================================================================

import { useMemo, useState } from 'react'
import type { Dataset } from '../../data'

const BLUE = ['#0B1120', '#104281', '#184f95', '#256abf', '#2a78d6', '#3987e5', '#6da7ec']
const shade = (n: number, max: number) => (n === 0 ? null : BLUE[Math.min(BLUE.length - 1, 1 + Math.floor((Math.log(n + 1) / Math.log(max + 1)) * (BLUE.length - 2)))])

export default function Questions({ data }: { data: Dataset }) {
  const cov = data.findings.coverage
  const [grav, setGrav] = useState('all')
  const materials = Object.keys(cov.grid)
  const max = Math.max(1, ...materials.flatMap((m) => cov.o2_bins.map((b) => cov.grid[m].cells[b]['0 g'])))
  const qs = useMemo(() => cov.questions.filter((q) => grav === 'all' || q.gravity === grav), [cov.questions, grav])

  const download = (kind: 'json' | 'csv') => {
    const body = kind === 'json' ? JSON.stringify(qs, null, 2)
      : ['question,material,o2_bin,gravity,score,facilities,hypothesis',
         ...qs.map((q) => [q.question, q.material, q.o2_bin, q.gravity, q.score, q.facilities.join(' | '), q.hypothesis]
           .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `microflamma-open-questions.${kind}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="label mb-1">Coverage of solid-fuel tests: material × oxygen × gravity</div>
        <p className="text-[11px] text-mute mb-3">Numbers are test counts. Empty cells are where no test exists. {cov.pressure_note}</p>
        <div className="overflow-x-auto">
          <table className="text-[11px] tabular border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr className="text-mute">
                <th className="text-left font-normal pr-3">Material</th>
                {cov.o2_bins.map((b) => <th key={b} className="font-normal px-1 whitespace-nowrap">0 g · {b}</th>)}
                <th className="font-normal px-1 whitespace-nowrap">0 g · O₂ not recorded</th>
                <th className="font-normal px-1 whitespace-nowrap text-star">0.16 g Moon</th>
                <th className="font-normal px-1 whitespace-nowrap text-star">0.38 g Mars</th>
                <th className="font-normal px-1 whitespace-nowrap">1 g reference</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const g = cov.grid[m]
                return (
                  <tr key={m}>
                    <td className="pr-3 text-slate-200 whitespace-nowrap">{m}</td>
                    {cov.o2_bins.map((b) => {
                      const n = g.cells[b]['0 g']
                      const bg = shade(n, max)
                      return (
                        <td key={b} title={`${m}, ${b} O₂, 0 g: ${n} tests`}
                            className={`w-16 h-8 text-center rounded ${bg ? '' : 'hatched'}`} style={bg ? { background: bg } : undefined}>
                          <span className={n ? 'text-white' : 'text-mute/50'}>{n || '·'}</span>
                        </td>
                      )
                    })}
                    <td className="text-center text-mute">{g.o2_not_recorded_0g || '·'}</td>
                    <td className="text-center rounded hatched text-mute/50">·</td>
                    <td className="text-center rounded hatched text-mute/50">·</td>
                    <td className="text-center text-mute">{g.one_g_references || '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="label mr-2">{qs.length} questions from empty cells</div>
          {['all', ...cov.gravity.filter((g) => g !== '1 g')].map((g) => (
            <button key={g} onClick={() => setGrav(g)} className={`btn !py-1 text-[10px] ${grav === g ? 'btn-active' : ''}`}>{g === 'all' ? 'All gravities' : g}</button>
          ))}
          <span className="ml-auto flex gap-1">
            <button onClick={() => download('json')} className="btn !py-1 text-[10px]">Export JSON</button>
            <button onClick={() => download('csv')} className="btn !py-1 text-[10px]">Export CSV</button>
          </span>
        </div>
        <p className="text-[10px] text-mute mb-3">
          Moon-base relevance = 3·[bin holds 30% O₂] + 2·[bin above the tested maximum] + 3·[lunar gravity] + 1·[Mars gravity] + 1·[material has 10+ tests].
        </p>
        <div className="grid md:grid-cols-2 gap-2">
          {qs.slice(0, 30).map((q) => (
            <div key={q.question} className="panel-flat p-3">
              <div className="flex items-start gap-2">
                <span className="tabular text-sm text-cryo w-6 shrink-0">{q.score}</span>
                <div className="flex-1">
                  <div className="text-[12px] text-slate-100">{q.question}</div>
                  <div className="text-[10px] text-mute mt-1">{q.evidence}</div>
                  <div className="text-[10px] text-mute">Measure with: {q.measure_with}</div>
                  <div className="text-[10px] text-slate-300 mt-1">Could be answered by: {q.facilities.join('; ')}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {q.hypothesis && <span className="badge badge-warn">hypothesis zone</span>}
                    {Object.entries(q.score_parts).filter(([, v]) => v).map(([k, v]) => (
                      <span key={k} className="badge badge-dead normal-case tracking-normal">+{v} {k.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {qs.length > 30 && <p className="text-[10px] text-mute mt-2">Showing the top 30 of {qs.length}. The export contains all of them.</p>}
      </section>

      <section className="panel p-4">
        <div className="label mb-2">What PSI would need to add to close these gaps</div>
        <ul className="text-[11px] text-slate-300 space-y-1 list-disc pl-4">
          <li>Solid-fuel tests at about 30% oxygen and about 70 kPa, the planned lunar habitat atmosphere.</li>
          <li>A chamber-pressure column in the BASS and BASS-II tables.</li>
          <li>Outcome columns for BASS (PSI-26) and SAFFIRE-III (PSI-100).</li>
          <li>The FLEX-2 per-test table (only an 8-row range summary is included here).</li>
          <li>Smoke measurements from genuine flaming fires (SAME-R used heated, non-flaming samples).</li>
          <li>Partial-gravity results, such as FM2 and LUCI, once available.</li>
          <li>DOIs for PSI-22, PSI-39, PSI-47, PSI-107 and PSI-159.</li>
        </ul>
      </section>
    </div>
  )
}
