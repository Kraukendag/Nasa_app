// =============================================================================
//  APP SHELL
// =============================================================================
//  Holds the four sections together: the top navigation bar, the section that
//  is currently showing, and the disclaimer footer. It also loads the data
//  once at start-up and hands it down to whichever section needs it.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import type { Dataset } from './data'
import { loadDataset } from './data'
import type { TabId } from './types'
import TabMatch from './components/TabMatch'
import TabLab from './components/TabLab'
import TabLibrary from './components/TabLibrary'
import TabAbout from './components/TabAbout'

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'match',   label: '3D Match',       hint: 'Light a match with gravity on or off' },
  { id: 'lab',     label: 'Experiment Lab', hint: 'Explore real test conditions' },
  { id: 'library', label: 'Data Library',   hint: 'All 1,450 records' },
  { id: 'about',   label: 'About',          hint: 'The team behind Micro Flamma' },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('match')
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load the JSON once when the site opens. Nothing is fetched after this.
  useEffect(() => {
    loadDataset().then(setData).catch((e: Error) => setError(e.message))
  }, [])

  /** Tab 2 can send the user to Tab 3 with a material already filtered.
   *  This holds the hand-off value until the Library picks it up. */
  const [libraryPreset, setLibraryPreset] = useState<string | null>(null)
  const jumpToLibrary = useCallback((material: string) => {
    setLibraryPreset(material)
    setTab('library')
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------- TOP BAR ---------- */}
      <header className="sticky top-0 z-40 border-b border-edge bg-void/85 backdrop-blur-md">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <button
            onClick={() => setTab('match')}
            className="flex items-center gap-3 group shrink-0"
            aria-label="Micro Flamma home"
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/microflamma-mark.png`}
              alt=""
              className="h-10 w-10 object-contain transition-transform duration-500
                         group-hover:rotate-[14deg]"
            />
            <div className="hidden sm:block leading-none text-left">
              <div className="font-bold tracking-[0.16em] text-sm">
                <span className="text-flame">MICRO</span>{' '}
                <span className="text-slate-100">FLAMMA</span>
              </div>
              <div className="text-[9px] tracking-[0.22em] text-mute mt-1">FIRE IN FREEFALL</div>
            </div>
          </button>

          <nav className="flex items-center gap-1 ml-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                title={t.hint}
                onClick={() => setTab(t.id)}
                className={`relative px-2.5 sm:px-4 py-2 text-xs sm:text-sm rounded-md
                            transition-all duration-200
                            ${tab === t.id
                              ? 'text-white'
                              : 'text-mute hover:text-slate-200 hover:bg-navy/40'}`}
              >
                {t.label}
                {/* The underline slides between tabs rather than blinking. */}
                {tab === t.id && (
                  <span className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full
                                   bg-gradient-to-r from-cryo via-star to-flame anim-fade-in" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ---------- SECTION BODY ---------- */}
      <main className="flex-1 flex flex-col min-h-0">
        {error && (
          <div className="m-6 panel p-5 border-flame/40">
            <div className="badge badge-alert mb-2">Data failed to load</div>
            <p className="text-sm text-slate-300">{error}</p>
            <p className="text-xs text-mute mt-2">
              Run <code className="text-star">python3 scripts/build_data.py</code> to rebuild the
              JSON files, then reload.
            </p>
          </div>
        )}

        {!data && !error && <LoadingPanel />}

        {data && (
          // `key` forces React to rebuild on tab change, which restarts the
          // entrance animation so each section arrives rather than appears.
          <div key={tab} className="flex-1 min-h-0 flex flex-col anim-fade-in">
            {tab === 'match'   && <TabMatch onOpenLab={() => setTab('lab')} />}
            {tab === 'lab'     && <TabLab data={data} onInspect={jumpToLibrary} />}
            {tab === 'library' && (
              <TabLibrary
                data={data}
                presetMaterial={libraryPreset}
                onPresetConsumed={() => setLibraryPreset(null)}
              />
            )}
            {tab === 'about'   && <TabAbout data={data} />}
          </div>
        )}
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-edge bg-void/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-1
                        text-[10px] text-mute">
          <span className="text-star">
            Research data summary — not a material certification or safety approval.
          </span>
          <span className="hidden sm:inline">·</span>
          <span>
            All values from NASA Physical Sciences Informatics experimental tables.
          </span>
          <span className="ml-auto tabular">
            {data ? `${data.tests.length.toLocaleString()} records` : '—'}
          </span>
        </div>
      </footer>
    </div>
  )
}

/** Shown for the moment it takes to read the JSON files. */
function LoadingPanel() {
  return (
    <div className="flex-1 grid place-items-center">
      <div className="text-center anim-fade-up">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-edge" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent
                          border-t-cryo border-r-star animate-spin" />
        </div>
        <div className="label">Loading NASA PSI records</div>
      </div>
    </div>
  )
}
