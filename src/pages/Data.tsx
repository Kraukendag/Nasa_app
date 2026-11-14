// =============================================================================
//  DATA
// =============================================================================
//  Three views of the same records:
//    Records         every one of the 1,450 rows, searchable and filterable
//    Investigations  one profile per PSI investigation, with a compare mode
//    Materials       one card per material or fuel that was actually tested
//
//  The URL argument picks the view and a preset:
//    #/data/PMMA            -> Records, filtered to PMMA
//    #/data/inv:PSI-25      -> Records, filtered to one investigation
//    #/data/investigations  -> the Investigations view
//    #/data/materials       -> the Materials view
// =============================================================================

import { useEffect, useState } from 'react'
import { go } from '../App'
import type { Dataset } from '../data'
import Investigations from './data/Investigations'
import Materials from './data/Materials'
import Records from './data/Records'

type View = 'records' | 'investigations' | 'materials'

export default function Data({ data, arg }: { data: Dataset; arg: string | null }) {
  const initial: View = arg === 'investigations' || arg === 'materials' ? arg : 'records'
  const [view, setView] = useState<View>(initial)
  const preset = initial === 'records' && arg ? arg : null
  // The page stays mounted when only the argument changes (e.g. a click on
  // "View rows"), so follow the argument here.
  useEffect(() => { if (arg) setView(initial) }, [arg, initial])

  const tabs: [View, string, string][] = [
    ['records', 'Records', `${data.tests.length.toLocaleString()} rows`],
    ['investigations', 'Investigations', `${data.investigations.length} profiles`],
    ['materials', 'Materials', `${data.materials.length} cards`],
  ]
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10 enter">
      <header className="max-w-3xl">
        <h1 className="h1">Data</h1>
        <p className="lede mt-4">
          Every record from the 14 NASA Physical Sciences Informatics tables, as recorded. Values that look wrong are
          flagged, never changed or removed; open any row to see the original CSV cells and its citation.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-rule" role="tablist">
        {tabs.map(([v, label, count]) => (
          <button key={v} role="tab" aria-selected={view === v}
                  onClick={() => { setView(v); if (arg) go('data') }}
                  className={`px-4 py-2.5 -mb-px border-b-2 transition-colors ${view === v ? 'border-accent text-ink font-medium' : 'border-transparent text-ink2 hover:text-ink'}`}>
            {label} <span className="caption num ml-1">{count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {view === 'records' && <Records data={data} preset={preset} />}
        {view === 'investigations' && <Investigations data={data} onShowRows={(psi) => { setView('records'); go('data', `inv:${psi}`) }} />}
        {view === 'materials' && <Materials data={data} onShowRows={(m) => { setView('records'); go('data', m) }} />}
      </div>
    </div>
  )
}
