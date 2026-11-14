// =============================================================================
//  SHARED LAYOUT PIECES
// =============================================================================
//  Small building blocks every page uses, so the whole site keeps one rhythm:
//  a page header, sections with headings, numbered figures with captions and
//  sources, and plain source lines.
// =============================================================================

import type { ReactNode } from 'react'
import type { Dataset } from './data'

/** A page: title, one-paragraph introduction, then sections. */
export function Page({ title, intro, children, wide }: { title: string; intro?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-5 sm:px-8 py-10 sm:py-14 ${wide ? 'max-w-[1400px]' : 'max-w-5xl'} enter`}>
      <header className="mb-10 max-w-3xl">
        <h1 className="h1">{title}</h1>
        {intro && <div className="lede mt-4">{intro}</div>}
      </header>
      <div className="space-y-14">{children}</div>
    </div>
  )
}

export function Section({ title, intro, children, id }: { title: string; intro?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="h2">{title}</h2>
      {intro && <p className="text-ink2 mt-2 max-w-3xl">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** A numbered figure. Captions follow the journal convention:
 *  "Fig. 2 — what it shows. Source: where it comes from." */
export function Fig({ n, caption, source, children, className = '' }: {
  n: number | string; caption: ReactNode; source?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <figure className={`figure ${className}`}>
      <div>{children}</div>
      <figcaption className="figcap">
        <b>Fig. {n}.</b> {caption}{source && <> <span className="text-mute">Source: {source}</span></>}
      </figcaption>
    </figure>
  )
}

/** The citation for an investigation: "PSI-25 BASS-II · DOI ...". */
export function PsiCite({ data, psi }: { data: Dataset; psi: string | null }) {
  if (!psi) return null
  const inv = data.investigations.find((i) => i.psi_id === psi)
  return (
    <span className="caption">
      {psi} {inv?.acronym}
      {inv?.doi_url ? <> · <a href={inv.doi_url} target="_blank" rel="noreferrer">DOI {inv.doi}</a></> : ' · DOI not yet recorded'}
    </span>
  )
}

/** The citation for a literature source (outside PSI). */
export function LitCite({ data, keyName }: { data: Dataset; keyName: string }) {
  const s = data.literature.sources[keyName]
  if (!s) return null
  return <span className="caption">{s.authors}, <i>{s.title}</i>, {s.venue} · <a href={s.url} target="_blank" rel="noreferrer">NTRS {s.ntrs}</a></span>
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div>
      <div className="num text-2xl text-ink">{value}</div>
      <div className="caption mt-0.5">{label}</div>
    </div>
  )
}
