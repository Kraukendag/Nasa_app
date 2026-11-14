// =============================================================================
//  INSIGHTS · NEGATIVE KNOWLEDGE
// =============================================================================
//  What did NOT work, broke, surprised, or was never measured. Generated from
//  the data, every entry linked to its tests and investigation.
// =============================================================================

import type { Dataset } from '../../data'
import { invLabel } from '../../data'

const GROUPS: [string, string, string][] = [
  ['failed_ignition', 'Tests that never ignited', 'Attempts recorded as no ignition or no sustained flame.'],
  ['unexpected_result', 'Results against expectations', 'Outcomes a ground test would not have predicted.'],
  ['instrument_or_record', 'Instrument and record problems', 'Readings and records that cannot be taken at face value.'],
]

export default function Negative({ data }: { data: Dataset }) {
  const entries = data.findings.negative_knowledge
  return (
    <div className="space-y-6">
      {GROUPS.map(([key, title, sub]) => {
        const list = entries.filter((e) => e.category === key)
        if (!list.length) return null
        return (
          <section key={key}>
            <div className="label">{title} · {list.length}</div>
            <p className="text-[11px] text-mute mb-2">{sub}</p>
            <div className="grid md:grid-cols-2 gap-2">
              {list.map((e) => (
                <div key={e.title} className="panel-flat p-3">
                  <div className="text-[12px] text-slate-100">{e.title}</div>
                  <p className="text-[11px] text-slate-300 mt-1">{e.detail}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {e.tests.filter(Boolean).slice(0, 14).map((t) => <span key={String(t)} className="text-[9.5px] font-mono px-1.5 py-0.5 rounded border border-edge text-mute">{t}</span>)}
                    {e.tests.length > 14 && <span className="text-[9.5px] text-mute">+{e.tests.length - 14}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-2 text-[10px] text-mute">
                    <span className="font-mono text-cryo">{invLabel(data, e.psi_id)}</span>
                    {e.doi ? <a href={`https://doi.org/${e.doi}`} target="_blank" rel="noreferrer" className="hover:text-cryo">DOI {e.doi} ↗</a> : <span>DOI not yet recorded</span>}
                    {e.source && <span>{e.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <section>
        <div className="label">What these tests did not answer · {data.findings.gaps.length}</div>
        <div className="space-y-1.5 mt-2">
          {data.findings.gaps.map((g) => (
            <div key={g} className="panel-flat p-3 flex gap-2.5"><span className="text-star text-xs mt-0.5">✕</span><span className="text-[11.5px] text-slate-300">{g}</span></div>
          ))}
        </div>
      </section>
    </div>
  )
}
