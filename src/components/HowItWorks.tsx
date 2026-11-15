// =============================================================================
//  HOW IT WORKS (one-glance flowchart, Pipeline page)
// =============================================================================
//  The whole site in four steps: NASA data -> AI extraction -> clean & check
//  -> the website. Numbers are read from the live data, so they never drift.
//  Left to right on wide screens, stacked on phones.
// =============================================================================

import type { Dataset } from '../data'

const STEP: Record<'nasa' | 'ai' | 'check', string> = {
  nasa: 'border-[#1f7a4d] bg-[#1f7a4d]/5 [&_.tag]:text-[#1f7a4d]',
  ai: 'border-accent bg-accent/5 [&_.tag]:text-accent',
  check: 'border-[#2a78d6] bg-[#2a78d6]/5 [&_.tag]:text-[#2a78d6]',
}

function Box({ kind, tag, big, title, text }: { kind: keyof typeof STEP; tag: string; big: string; title: string; text: string }) {
  return (
    <div className={`rounded-md border-2 p-4 grid gap-1.5 content-start h-full min-w-0 ${STEP[kind]}`}>
      <span className="tag num text-[11.5px] uppercase tracking-wider">{tag}</span>
      <span className="font-serif font-semibold text-[28px] leading-none num">{big}</span>
      <h3 className="h3 !text-[16px]">{title}</h3>
      <p className="small text-ink2">{text}</p>
    </div>
  )
}

/** An arrow between steps: sideways on wide screens, downwards when stacked. */
function Arrow() {
  return (
    <div aria-hidden className="flex items-center justify-center py-1 lg:py-0 lg:px-1">
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-mute rotate-90 lg:rotate-0" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 12h16M13 6l6 6-6 6" />
      </svg>
    </div>
  )
}

export default function HowItWorks({ data }: { data: Dataset }) {
  const bc = data.findings.bass2_counts
  const outs: [string, string, string][] = [
    ['#/lab', '3D Experiment Lab', 'flame drawn from one real NASA test'],
    ['#/habitat', 'Lunar habitat', 'what was tested vs what a Moon base needs'],
    ['#/search', 'AI search', 'ask in plain words; answers link to NASA'],
    ['#/findings', 'Findings & data', `${data.findings.research_questions.length} open questions, every record`],
  ]
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.3fr)] items-stretch"
           role="img" aria-label="Flowchart: NASA data, then AI extraction, then cleaning and checks, then the website and its four main features">
        <Box kind="nasa" tag="1 · NASA data" big={data.tests.length.toLocaleString()} title="records from 14 NASA experiments"
             text="Plus NASA's 144-page BASS-II report. Files kept exactly as NASA published them." />
        <Arrow />
        <Box kind="ai" tag="2 · AI extraction" big={`${bc.endings_report}`} title="test endings read from the report"
             text="AI turned the report's notes into data, word for word, each with its page." />
        <Arrow />
        <Box kind="check" tag="3 · Clean & check" big="18" title="automatic checks before every update"
             text="Errors flagged, never deleted. Missing data stays missing. Every value keeps its NASA source and DOI." />
        <Arrow />
        <div className="rounded-md border-2 border-ink2/60 bg-card p-4 grid gap-2.5 content-start h-full min-w-0">
          <span className="num text-[11.5px] uppercase tracking-wider text-mute">4 · The website, in your browser</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
            {outs.map(([href, t, d]) => (
              <a key={t} href={href} className="block rounded border border-rule bg-wash/50 px-3 py-1.5 no-underline hover:no-underline hover:border-accent group">
                <b className="block text-[14px] text-ink group-hover:text-accent">{t}</b>
                <span className="caption">{d}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="flex flex-wrap gap-x-6 gap-y-1 small text-ink2 border-t border-rule pt-3">
        <span><b className="text-ink">$0</b> to run: no server, no API keys</span>
        <span><b className="text-ink">Offline</b> after the first visit</span>
        <span><b className="text-ink">Nothing invented:</b> every number links back to NASA</span>
      </p>
    </div>
  )
}
