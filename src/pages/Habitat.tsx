// =============================================================================
//  LUNAR HABITAT
// =============================================================================
//  The challenge's own question, answered in one place: what does the evidence
//  mean for a habitat planned at about 30% oxygen, 10.2 psi and 0.16 g?
//
//  Five recommendations (scripts/recommendations.py). Each shows the evidence
//  behind it with its source, how strong that evidence is, and the open
//  research questions it leaves. Every number is computed from the PSI rows or
//  quoted from a cited NASA report.
// =============================================================================

import type { Dataset } from '../data'
import { Fig, LitCite, Page, PsiCite, Section } from '../ui'
import HabitatEnvelope from '../components/HabitatEnvelope'

export default function Habitat({ data }: { data: Dataset }) {
  const f = data.findings
  const qs = new Map(f.research_questions.map((q) => [q.id, q]))
  const mb = f.moonbase
  return (
    <Page title="What this means for a lunar habitat" intro={<>
      A lunar habitat is planned at about {mb.o2_percent}% oxygen and {mb.pressure_psi} psi ({mb.pressure_kpa} kPa), at
      one-sixth of Earth's gravity: more oxygen than any solid in NASA's PSI tables was burned in, at a gravity PSI never
      tested. These five recommendations follow from the evidence that does exist.
    </>}>
      <div className="wash p-5 small text-ink2 max-w-3xl">
        <b className="text-ink">How to read this page.</b> Each recommendation lists its evidence, with the NASA test or
        document it comes from, and says plainly how strong that evidence is. These are research suggestions drafted
        from the data, not safety requirements or a material certification.
      </div>

      <Section title="At a glance">
        <ol className="space-y-2">
          {f.recommendations.map((r) => (
            <li key={r.id}><a href={`#rec-${r.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`rec-${r.id}`)?.scrollIntoView({ behavior: 'smooth' }) }}
               className="flex gap-3 items-baseline no-underline hover:no-underline group">
              <span className="num caption w-8">{r.id}</span><span className="text-ink group-hover:text-accent font-medium">{r.title}</span>
            </a></li>
          ))}
        </ol>
      </Section>

      <Fig n={1} caption={<>0 g vs. 1 g bounding envelope: every PSI test that records oxygen, placed by oxygen and pressure, against
        the planned habitat. The dashed box is the lowest-to-highest range of the microgravity tests; it is a boundary of what
        was tested, not a fitted flammability limit. “Closest” weighs 1 point of oxygen the same as 10 kPa.</>}
           source="NASA PSI test tables only (14 investigations); habitat target from the challenge statement.">
        <div className="p-3 sm:p-5"><HabitatEnvelope data={data} /></div>
      </Fig>

      {f.recommendations.map((r) => (
        <section key={r.id} id={`rec-${r.id}`} className="scroll-mt-6 card p-6 sm:p-8">
          <p className="num caption">{r.id}</p>
          <h2 className="h2 mt-1">{r.title}</h2>
          <p className="lede mt-3">{r.action}</p>

          {/* Evidence in two groups: the PSI tables, then NASA reports outside PSI. */}
          {([['NASA PSI evidence', r.evidence.filter((e) => !e.lit)], ['Other NASA reports (NTRS)', r.evidence.filter((e) => e.lit)]] as const)
            .filter(([, items]) => items.length > 0).map(([title, items]) => (
            <div key={title}>
              <h3 className="small font-semibold mt-6">{title}</h3>
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {items.map((e, i) => (
                  <li key={i} className="py-3 grid md:grid-cols-[1fr_280px] gap-x-6 gap-y-1">
                    <p className="text-ink2">{e.text}</p>
                    <div className="md:text-right">
                      {e.psi && <PsiCite data={data} psi={e.psi} />}
                      {e.lit && <LitCite data={data} keyName={e.lit} />}
                      {!e.psi && !e.lit && <span className="caption">computed across all PSI tables</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h3 className="small font-semibold mt-6">How strong is this?</h3>
          <p className="small text-ink2 mt-1">{r.strength}</p>

          <h3 className="small font-semibold mt-6">What it leaves open</h3>
          <ul className="mt-1 space-y-1">
            {r.questions.map((id) => qs.get(id) && (
              <li key={id} className="small"><span className="num caption mr-2">{id}</span><a href="#/questions">{qs.get(id)!.question}</a></li>
            ))}
          </ul>
        </section>
      ))}

      <Section title="Try it yourself">
        <p className="text-ink2 max-w-3xl">
          The <a href="#/lab">Experiment Lab</a> has a “Check Moon-base conditions” button that picks the recorded values
          closest to the habitat for any material and shows what is and is not covered. The <a href="#/ranking">Ranking</a>{' '}
          shows which investigations matter most for a lunar habitat, and why.
        </p>
      </Section>
    </Page>
  )
}
