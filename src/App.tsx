// =============================================================================
//  APP SHELL
// =============================================================================
//  The top bar, the current page and the footer. Pages are addressed by the
//  URL hash (#/lab, #/data ...) so the browser's back button and shared links
//  work, without any server.
//
//  The home page is the 3D match; it is reached through the logo rather than
//  a tab. On small screens the page list folds into a menu button.
// =============================================================================

import { useEffect, useState } from 'react'
import type { Dataset } from './data'
import { loadDataset } from './data'
import type { PageId } from './types'
import { DataModePill, DataModeProvider, useView } from './context/DataModeContext'
import Home from './pages/Home'
import Lab from './pages/Lab'
import Habitat from './pages/Habitat'
import Search from './pages/Search'
import Data from './pages/Data'
import Findings from './pages/Findings'
import Ranking from './pages/Ranking'
import Questions from './pages/Questions'
import Pipeline from './pages/Pipeline'
import About from './pages/About'

const NAV: { id: PageId; label: string }[] = [
  { id: 'habitat', label: 'Lunar habitat' },
  { id: 'lab', label: 'Experiment Lab' },
  { id: 'data', label: 'Data' },
  { id: 'findings', label: 'Findings' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'questions', label: 'Research questions' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'search', label: 'AI search' },
  { id: 'about', label: 'About' },
]
const PAGES = new Set<string>(['home', ...NAV.map((n) => n.id)])

/** Other names people use for pages (from project descriptions). */
const ALIASES: Record<string, PageId> = {
  'lunar-habitat': 'habitat', simulator: 'lab', '3d-simulator': 'lab', database: 'data', 'future-research': 'questions',
}

function readHash(): { page: PageId; arg: string | null } {
  const [, raw, ...rest] = window.location.hash.split('/')
  // An alias rewrites the address to the real page (no extra history entry).
  if (raw && ALIASES[raw]) {
    window.history.replaceState(null, '', `#/${ALIASES[raw]}${rest.length ? '/' + rest.join('/') : ''}`)
  }
  const page = ALIASES[raw] ?? raw
  const arg = rest[0]
  return { page: (PAGES.has(page) ? page : 'home') as PageId, arg: arg ? decodeURIComponent(arg) : null }
}

/** Navigate to a page, optionally with an argument (e.g. a material). */
export function go(page: PageId, arg?: string) {
  window.location.hash = arg ? `#/${page}/${encodeURIComponent(arg)}` : `#/${page}`
}

export default function App() {
  return <DataModeProvider><Shell /></DataModeProvider>
}

/** Pages get the dataset as the current Data Mode shows it; the Lunar habitat
 *  page always gets the full set (it needs NASA work beyond PSI). */
function Pages({ data, page, arg }: { data: Dataset; page: PageId; arg: string | null }) {
  const view = useView(data)
  return (
    <div key={page} className={page === 'lab' ? 'h-full' : ''}>
      {page === 'home' && <Home data={view} full={data} />}
      {page === 'habitat' && <Habitat data={data} />}
      {page === 'search' && <Search data={view} />}
      {page === 'lab' && <Lab data={view} arg={arg} />}
      {page === 'data' && <Data data={view} arg={arg} />}
      {page === 'findings' && <Findings data={view} />}
      {page === 'ranking' && <Ranking data={view} />}
      {page === 'questions' && <Questions data={view} />}
      {page === 'pipeline' && <Pipeline data={view} />}
      {page === 'about' && <About data={view} />}
    </div>
  )
}

function Shell() {
  const [route, setRoute] = useState(readHash)
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  useEffect(() => { loadDataset().then(setData).catch((e: Error) => setError(e.message)) }, [])
  useEffect(() => {
    const on = () => { setRoute(readHash()); setMenu(false); document.getElementById('main')?.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const { page, arg } = route
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="shrink-0 bg-card rule-b z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-4">
          <a href="#/home" className="flex items-center gap-2.5 no-underline hover:no-underline shrink-0" aria-label="Micro Flamma home">
            <img src={`${import.meta.env.BASE_URL}brand/microflamma-mark-light.png`} alt="" className="h-10 w-10 object-contain" />
            <span className="font-serif font-semibold text-lg text-ink tracking-tight">Micro Flamma</span>
          </a>
          <span className="hidden xl:inline-flex ml-4"><DataModePill /></span>
          <nav className="hidden xl:flex items-center gap-0.5 ml-auto" aria-label="Pages">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} aria-current={page === n.id ? 'page' : undefined}
                 className={`px-2.5 py-2 rounded no-underline hover:no-underline text-[14px] transition-colors
                   ${page === n.id ? 'text-ink font-medium bg-wash' : 'text-ink2 hover:text-ink'}`}>
                {n.label}
              </a>
            ))}
          </nav>
          <span className="hidden sm:inline-flex xl:hidden ml-auto"><DataModePill /></span>
          <button className="btn xl:hidden ml-auto sm:ml-0" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="Menu">
            {menu ? 'Close' : 'Menu'}
          </button>
        </div>
        {menu && (
          <nav className="xl:hidden border-t border-rule bg-card enter" aria-label="Pages">
            <div className="px-5 py-3 border-b border-rule/70 sm:hidden"><DataModePill /></div>
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={`block px-5 py-3 no-underline border-b border-rule/70 ${page === n.id ? 'text-ink font-medium bg-wash' : 'text-ink2'}`}>
                {n.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="main" className="flex-1 min-h-0 overflow-y-auto">
        {error && <div className="max-w-3xl mx-auto p-8"><p className="h3">The data failed to load.</p><p className="text-ink2 mt-2">{error}. Run <code>python3 scripts/build_data.py</code> and reload.</p></div>}
        {!data && !error && <div className="h-full grid place-items-center caption">Loading NASA PSI records…</div>}
        {data && (
          <Pages data={data} page={page} arg={arg} />
        )}
      </main>

      <footer className="shrink-0 border-t border-rule bg-card px-4 sm:px-8 py-2">
        <div className="max-w-[1400px] mx-auto flex flex-wrap gap-x-5 gap-y-0.5 caption">
          <span>Research data summary, not a material certification or safety approval.</span>
          <span className="hidden md:inline">Data: NASA Physical Sciences Informatics, BASS-II Summary Report, and cited NTRS documents.</span>
          {data && <span className="ml-auto num">{data.tests.length.toLocaleString()} records</span>}
        </div>
      </footer>
    </div>
  )
}
