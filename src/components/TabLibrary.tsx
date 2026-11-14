// =============================================================================
//  TAB 3 — DATA LIBRARY
// =============================================================================
//  Three ways into the same 1,450 rows:
//    Records         every row, searchable and filterable
//    Investigations  one profile per investigation, with a side-by-side compare
//    Materials       one card per material or fuel that was actually tested
// =============================================================================

import { useState } from 'react'
import type { Dataset } from '../data'
import Investigations from './library/Investigations'
import Materials from './library/Materials'
import Records from './library/Records'

type View = 'records' | 'investigations' | 'materials'

export default function TabLibrary({ data, presetMaterial, presetQuery, onPresetConsumed }: {
  data: Dataset; presetMaterial: string | null; presetQuery?: string | null; onPresetConsumed: () => void
}) {
  const [view, setView] = useState<View>('records')
  const [preset, setPreset] = useState<string | null>(null)
  const [presetInv, setPresetInv] = useState<string | null>(null)

  // Hand-offs from other views land in Records with a filter already applied.
  const showMaterial = (m: string) => { setPreset(m); setView('records') }
  const showInvestigation = (psi: string) => { setPresetInv(psi); setView('records') }
  const effectivePreset = presetMaterial ?? preset

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="border-b border-edge px-4 flex items-center gap-1 overflow-x-auto">
        {([['records', `Records · ${data.tests.length.toLocaleString()}`], ['investigations', `Investigations · ${data.investigations.length}`],
           ['materials', `Materials · ${data.materials.length}`]] as [View, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
                  className={`relative px-3 py-2.5 text-xs whitespace-nowrap transition-colors ${view === k ? 'text-white' : 'text-mute hover:text-slate-200'}`}>
            {l}
            {view === k && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-cryo anim-fade-in" />}
          </button>
        ))}
      </div>
      <div key={view} className="flex-1 min-h-0 flex flex-col anim-fade-in">
        {view === 'records' && (
          <Records data={data} preset={effectivePreset} presetInvestigation={presetInv} presetQuery={presetQuery}
                   onPresetConsumed={() => { onPresetConsumed(); setPreset(null); setPresetInv(null) }} />
        )}
        {view === 'investigations' && <Investigations data={data} onShowRows={showInvestigation} />}
        {view === 'materials' && <Materials data={data} onShowRows={showMaterial} />}
      </div>
    </div>
  )
}
