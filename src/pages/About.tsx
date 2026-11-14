// =============================================================================
//  ABOUT
// =============================================================================
//  Who built this, how AI was used, why the work matters on Earth too, what it
//  cannot tell you (given as much space as the features), and every source.
// =============================================================================

import type { Dataset } from '../data'
import { Page, Section, Stat } from '../ui'

const TEAM = [
  { name: 'Shonazarov Abdurahmon', role: 'Developer' },
  { name: 'Qosimov Muhammadali', role: 'Developer' },
  { name: 'Azizov Ozodbek', role: 'Pitch' },
  { name: 'Nozimov Daler', role: 'Design' },
  { name: 'Shokirov Azizbek', role: 'Connections' },
  { name: 'Saydullayev Shohjahon', role: 'Theory' },
]

export default function About({ data }: { data: Dataset }) {
  const flags = Object.values(data.findings.anomaly_summary).reduce((a, b) => a + b, 0)
  const withOutcome = data.tests.filter((t) => t.normalized.outcome_class).length
  const m = data.flexModel.metrics
  const bc = data.findings.bass2_counts

  return (
    <Page title="About Micro Flamma" intro={<>
      An explorer for NASA's microgravity combustion research, built for the NASA Space Apps Challenge 2026 (“Flame in
      Freefall”). The numbers come from 14 NASA Physical Sciences Informatics tables and NASA reports, each cited.
      Nothing is estimated, interpolated or filled in.
    </>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 card p-6">
        <Stat value={data.tests.length.toLocaleString()} label="records" />
        <Stat value={withOutcome} label="with a recorded ending" />
        <Stat value={data.materials.length} label="material and fuel cards" />
        <Stat value={flags} label="data-quality flags shown" />
      </div>

      <Section title="The team">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEAM.map((p) => (
            <li key={p.name} className="card p-5 flex items-center gap-4">
              <span className="w-11 h-11 rounded-full grid place-items-center bg-wash border border-rule num text-[13px] text-ink2 shrink-0">
                {p.name.split(' ').map((w) => w[0]).join('')}
              </span>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="caption">{p.role}</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How AI was used">
        <div className="space-y-4 text-ink2 max-w-3xl">
          <p><b className="text-ink">To extract, not to answer.</b> BASS-II's table does not say how its tests ended. AI-assisted
            transcription read the test matrices of NASA's 144-page summary report and turned {bc.observations} free-text observations
            into a table, each tied to its page and checked against the PSI table and the PDF.{' '}
            <a href="#/pipeline">See the pipeline →</a></p>
          <p><b className="text-ink">To find and verify sources.</b> NASA technical reports were searched and read to confirm the
            values used on the Findings page (LUCI, Saffire IV–VI, KC-135), each with document number and page.</p>
          <p><b className="text-ink">To build.</b> The team used Claude Code (Anthropic) to write the pipeline and interface code,
            which is commented in plain English; people reviewed the results.</p>
          <p><b className="text-ink">Not in the website.</b> No AI runs on this site: no chatbot, no API key, nothing generated at
            run time. The only model is a classical logistic regression fitted to {data.flexModel.n_training_rows} FLEX tests
            ({(m.accuracy * 100).toFixed(0)}% accuracy against a {(m.baseline_accuracy * 100).toFixed(0)}% always-“extinction”
            baseline, AUC {m.auc.toFixed(2)}, validated on held-out conditions).</p>
        </div>
      </Section>

      <Section title="Why it matters on Earth too" intro={<>
        BASS-II's objectives say it feeds “the combustion computational models used in the design of fire detection and
        suppression systems in microgravity and on Earth” (PSI-25 record). The links below are context, not results in these tables.
      </>}>
        <div className="grid md:grid-cols-3 gap-4">
          <Benefit title="Smoke detectors that tell smoke from dust" tag="PSI-101 SAME-R · PSI-47 DAFT"
                   body="SAME-R measures how smoke particles grow as they age; DAFT tested hand-held instruments for measuring dust aerosols aboard the ISS. Telling smoke from dust is the same problem a building's smoke detector faces." />
          <Benefit title="Soot and cleaner flames" tag="PSI-107 SPICE"
                   body="SPICE locates the smoke point, the fuel flow at which a flame starts releasing soot, which also matters for burners and engines." />
          <Benefit title="Low-temperature combustion" tag="PSI-39 CFI · PSI-159 CFI-G"
                   body="Cool flames are the low-temperature chemistry that precedes ignition in engines. Without buoyancy they can be studied cleanly." />
        </div>
      </Section>

      <Section title="What this cannot tell you">
        <ul className="divide-y divide-rule border-y border-rule">
          {[...data.findings.gaps,
            'The 3D flames are illustrations. Their shape and orientation follow published descriptions of buoyant and microgravity flames, and the sample size, airflow and ending come from the records. Colour, flicker, flame size and spread pace are not measured values.',
            'Ending categories such as “extinguished as airflow was reduced” are this project\'s reading of NASA\'s notes. NASA\'s own words are always shown next to them.',
            'This is a research summary, not a material certification or a safety approval.',
          ].map((g) => <li key={g} className="py-3 flex gap-3 text-ink2"><span className="text-accent" aria-hidden>✕</span><span>{g}</span></li>)}
        </ul>
      </Section>

      <Section title="Glossary" id="glossary" intro="Terms used on this site, each with NASA's own wording and where it comes from.">
        <dl className="divide-y divide-rule border-y border-rule">
          {data.literature.glossary.map((g) => (
            <div key={g.term} className="py-3 grid md:grid-cols-[180px_1fr] gap-x-6 gap-y-1">
              <dt className="font-medium">{g.term}</dt>
              <dd>
                <p className="text-ink2">{g.plain}</p>
                <p className="caption mt-1">NASA: “{g.quote}” · {data.literature.sources[g.source]?.title ?? g.source}, {g.where}</p>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Sources">
        <h3 className="h3">NASA Physical Sciences Informatics tables</h3>
        <div className="card mt-3 overflow-x-auto">
          <table className="tbl min-w-[640px]">
            <thead><tr><th>PSI</th><th>Investigation</th><th className="text-right">Rows</th><th>DOI</th></tr></thead>
            <tbody>
              {data.investigations.map((i) => (
                <tr key={i.psi_id}>
                  <td className="num">{i.psi_id}</td><td>{i.title} <span className="caption">({i.acronym})</span></td>
                  <td className="text-right num">{i.row_count}</td>
                  <td>{i.doi ? <a href={i.doi_url!} target="_blank" rel="noreferrer" className="num">{i.doi}</a> : <span className="caption">not yet recorded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="h3 mt-8">Documents on the NASA Technical Reports Server</h3>
        <p className="small text-ink2 mt-1">{Object.values(data.literature.sources).filter((x) => x.tier === 'nasa_report').length} are NASA's own reports. The others are work by NASA researchers or NASA programmes that a
          society or conference published; each says so, and why it is still reliable.</p>
        <ul className="mt-3 space-y-2 small">
          {Object.entries(data.literature.sources).map(([k, s]) => (
            <li key={k}>{s.authors}. <i>{s.title}</i>. {s.venue}. <a href={s.url} target="_blank" rel="noreferrer">NTRS {s.ntrs}</a>
              <span className="caption block">{s.tier === 'nasa_report' ? 'Published by NASA.' : `Not published by NASA (${s.publisher}). Why it is still used: ${s.reliability}`}</span></li>
          ))}
          <li>BASS-II “Fan calibration data.xlsx”, PSI-25 resources (velocity = Air display × 1.0066).</li>
          <li>NASA Space Apps Challenge 2026, “Flame in Freefall”: habitat and suit atmospheres (framing only).</li>
        </ul>
        <p className="caption mt-6">
          Built with React, Three.js, React Three Fiber, drei, Tailwind CSS and Vite; data pipeline in Python. Not affiliated
          with or endorsed by NASA; no NASA branding is used.
        </p>
      </Section>
    </Page>
  )
}

function Benefit({ title, body, tag }: { title: string; body: string; tag: string }) {
  return (
    <div className="card p-5">
      <h3 className="h3">{title}</h3>
      <p className="small text-ink2 mt-2">{body}</p>
      <p className="caption num mt-3">{tag}</p>
    </div>
  )
}
