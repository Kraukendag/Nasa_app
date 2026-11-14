// =============================================================================
//  PIPELINE
// =============================================================================
//  How the data on this site was built, step by step, and exactly where AI
//  did the work. The centrepiece is the BASS-II extraction: the PSI table for
//  BASS-II records the conditions of 129 tests but not how they ended. The
//  endings exist only as free-text notes in the test matrices of a 144-page
//  NASA report. AI-assisted transcription turned those pages into a table;
//  every row cites its page and was checked.
//
//  The examples below are read live from tests.json, so they always show
//  what the site actually uses.
// =============================================================================

import type { Dataset } from '../data'
import { OUTCOME_MEANINGS } from '../outcomes'
import { Fig, Page, Section, Stat } from '../ui'

const EXAMPLES = ['B1', 'O4', 'P19']

export default function Pipeline({ data }: { data: Dataset }) {
  const f = data.findings
  const m = data.flexModel.metrics
  const bass2 = data.tests.filter((t) => t.psi_id === 'PSI-25' && !t.is_note)
  const extracted = bass2.filter((t) => t.normalized.outcome_text)
  const pages = [...new Set(extracted.map((t) => (t.normalized.outcome_source ?? '').match(/p\. (\d+)/)?.[1]).filter(Boolean))].sort()
  const examples = EXAMPLES.map((id) => bass2.find((t) => t.test_number === id)).filter(Boolean) as typeof bass2
  const classes = new Map<string, { label: string; n: number }>()
  extracted.forEach((t) => {
    const c = t.normalized.outcome_class
    if (c) classes.set(c, { label: t.normalized.outcome ?? c, n: (classes.get(c)?.n ?? 0) + 1 })
  })
  const flags = Object.values(f.anomaly_summary).reduce((a, b) => a + b, 0)
  const withOutcome = data.tests.filter((t) => t.normalized.outcome_class).length

  const steps: [string, string, string][] = [
    ['Collect', 'NASA PSI tables and reports', `14 CSV tables (${data.tests.length.toLocaleString()} rows) downloaded from NASA Physical Sciences Informatics, the BASS-II Summary Report (NASA/TM-20210011385), the BASS-II fan calibration, and six NASA Technical Reports Server documents.`],
    ['Read and clean', 'scripts/loaders.py', `One loader per table. Units are converted (mmHg, atm and psi to kPa; mole fractions to %), names are unified ("100% C2H4" and "Ethylene" are one substance), and ${flags} problems are flagged across ${Object.keys(f.anomaly_summary).length} types. No row is deleted and no value is changed.`],
    ['Extract with AI', 'data_raw/BASS-II_AppendixA_transcribed.csv', `The test matrices on report pages ${pages[0]}–${pages[pages.length - 1]} were transcribed with AI assistance into a table: test number, flow direction and the observation, word for word, with its page. ${extracted.length} BASS-II tests gained an ending this way.`],
    ['Check', 'cross-check and spot-check', 'Machine cross-check against the PSI table, then a manual spot-check of ten rows against the report pages (details below).'],
    ['Classify', 'rules in scripts/loaders.py', 'Each observation is sorted into an ending category by written rules (keywords such as "blowoff", "turned flow off", "extinguished at pot"). NASA\'s own words are always shown next to the category.'],
    ['Derive', 'scripts/derive.py, build_data.py', `Material cards, findings, negative knowledge, coverage, ${f.research_questions.length} research questions and the FLEX model, all computed from the rows.`],
    ['Publish', 'public/data/*.json', 'Six JSON files read by a static website. No server, no account, no AI at run time: everything works offline.'],
  ]

  return (
    <Page title="Data pipeline" intro={<>
      How 1,450 rows of NASA records became this site, and the one place AI did essential work: reading the endings of
      {' '}{extracted.length} experiments out of a 144-page NASA report, where no table had them.
    </>}>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 card p-6">
        <Stat value={data.tests.length.toLocaleString()} label="rows from 14 PSI tables" />
        <Stat value={extracted.length} label="endings extracted from the report" />
        <Stat value={withOutcome} label="tests with a recorded ending" />
        <Stat value={flags} label="data-quality flags, nothing deleted" />
      </div>

      <Section title="Seven steps">
        <ol className="relative border-l-2 border-rule ml-3 space-y-7">
          {steps.map(([name, where, what], i) => (
            <li key={name} className="pl-7 relative">
              <span className={`absolute -left-[13px] top-0.5 w-6 h-6 rounded-full grid place-items-center text-[12px] num ${name === 'Extract with AI' ? 'bg-accent text-white' : 'bg-card border-2 border-rule text-ink2'}`}>{i + 1}</span>
              <h3 className="h3">{name} <span className="caption num font-normal ml-2">{where}</span></h3>
              <p className="text-ink2 mt-1 max-w-3xl">{what}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Why extraction was needed" intro={<>
        The PSI table for BASS-II (PSI-25) records the conditions of every test: oxygen, fan settings, sample, carbon
        monoxide. It does not say whether the sample burned. Without the endings, the largest solid-fuel experiment in the
        dataset could not answer the question that matters: <i>did it burn?</i>
      </>}>
        <div className="space-y-6">
          {examples.map((t, i) => {
            const n = t.normalized
            const raw = t.raw
            return (
              <Fig key={t.id} n={i + 1} caption={<>Test {t.test_number}: what the PSI table holds (left), what the report says
                (middle), and the row the pipeline produced (right).</>} source={n.outcome_source ?? undefined}>
                <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-rule">
                  <div className="p-4">
                    <h4 className="caption font-medium text-ink2 mb-2">PSI-25 table row (excerpt)</h4>
                    <dl className="small num space-y-0.5">
                      {['Test #', 'Fuel Sample Material', 'Fan display', 'Air display', 'Calibrated  initial O2 % by vol'].map((k) => (
                        <div key={k} className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-mute truncate" title={k}>{k.replace(/\s+/g, ' ')}</dt><dd>{raw[k] ?? 'empty'}</dd></div>
                      ))}
                      <div className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-mute">Outcome</dt><dd className="text-accent">not in the table</dd></div>
                    </dl>
                  </div>
                  <div className="p-4 bg-wash/50">
                    <h4 className="caption font-medium text-ink2 mb-2">Report test matrix, transcribed</h4>
                    <p className="small"><span className="text-mute">Flow direction:</span> {n.flow_direction}</p>
                    <blockquote className="small mt-2 border-l-2 border-accent pl-3">“{n.outcome_text}”</blockquote>
                  </div>
                  <div className="p-4">
                    <h4 className="caption font-medium text-ink2 mb-2">Row on this site</h4>
                    <dl className="small space-y-1">
                      <div><dt className="caption inline">flow_direction </dt><dd className="inline num">{n.flow_direction}</dd></div>
                      <div><dt className="caption inline">flow sequence </dt><dd className="inline num">{n.flow_sequence_cm_s.join(' → ')} cm/s</dd></div>
                      <div><dt className="caption inline">outcome_class </dt><dd className="inline num">{n.outcome_class}</dd></div>
                      <div><dt className="caption inline">outcome </dt><dd className="inline">{n.outcome}</dd></div>
                    </dl>
                    {n.outcome_class && OUTCOME_MEANINGS[n.outcome_class] && <p className="caption mt-2">{OUTCOME_MEANINGS[n.outcome_class]}</p>}
                  </div>
                </div>
              </Fig>
            )
          })}
        </div>
      </Section>

      <Section title="How the extraction was checked">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="num text-3xl">{f.cross_check.agree} of {f.cross_check.checked}</p>
            <h3 className="h3 mt-1">Machine cross-check</h3>
            <p className="small text-ink2 mt-2">Some rows of the PSI table write how the run ended in their own airflow cell
              (“5 down to ext”, “10 blowoff”). Those cells were typed independently of the report, so they can test the
              categories taken from it. They agree on {f.cross_check.agree} of {f.cross_check.checked}.</p>
            {f.cross_check.disagree.map((d) => (
              <p key={d.test} className="caption mt-2">
                <b className="text-ink2">{d.test}:</b> the cell reads “{d.cell}”; the report says “{d.report}”, so the
                category is “{data.findings.outcome_labels[d.category] ?? d.category}”. Both say the flame went out; the
                report adds that it never established. Kept as the report states it.
              </p>
            ))}
          </div>
          <div className="card p-5">
            <p className="num text-3xl">{f.spot_check.checked.length} of {f.spot_check.checked.length}</p>
            <h3 className="h3 mt-1">Manual spot-check against the PDF</h3>
            <p className="small text-ink2 mt-2">Tests {f.spot_check.checked.join(', ')} were compared word by word with report pages{' '}
              {f.spot_check.pages.join(', ')}. {f.spot_check.result}</p>
          </div>
        </div>
        <p className="small text-ink2 mt-4 max-w-3xl">{f.transcription_note}</p>
      </Section>

      <Section title="From NASA's words to a category" intro="The rules that sort each observation, and how many BASS-II tests landed in each category.">
        <div className="card overflow-x-auto">
          <table className="tbl min-w-[620px]">
            <thead><tr><th>Category on this site</th><th>Meaning</th><th className="text-right">BASS-II tests</th></tr></thead>
            <tbody>
              {[...classes.entries()].sort((a, b) => b[1].n - a[1].n).map(([c, v]) => (
                <tr key={c}><td>{v.label}</td><td className="text-ink2">{OUTCOME_MEANINGS[c] ?? ''}</td><td className="text-right num">{v.n}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="The one model, and how honest it is" intro={<>
        FLEX (PSI-69) records how {data.flexModel.n_training_rows} droplet tests ended, so a model can be fitted there and
        nowhere else. It is a logistic regression written in plain Python, not a neural network, and it is shown only
        where its inputs lie near real FLEX tests.
      </>}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 card p-6">
          <Stat value={`${(m.accuracy * 100).toFixed(1)}%`} label="accuracy" />
          <Stat value={`${(m.baseline_accuracy * 100).toFixed(1)}%`} label="always guess “extinction”" />
          <Stat value={`${(m.balanced_accuracy * 100).toFixed(1)}%`} label="balanced accuracy" />
          <Stat value={m.auc.toFixed(2)} label="AUC" />
        </div>
        <p className="small text-ink2 mt-4 max-w-3xl">
          Validated by {m.validation}, across {data.flexModel.n_condition_groups} distinct conditions. Fold accuracies:{' '}
          <span className="num">{m.fold_accuracy.map((a) => `${(a * 100).toFixed(0)}%`).join(', ')}</span>. {data.flexModel.disclaimer}
        </p>
      </Section>

      <Section title="Where AI was used, and where it was not">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="h3">Used</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 small text-ink2">
              <li>Transcribing the BASS-II test matrices from the PDF, each row tied to its page.</li>
              <li>Reading NASA reports to find and verify the literature values (LUCI, Saffire IV–VI, KC-135), with document and page.</li>
              <li>Helping write and review the code, which is open and commented.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="h3">Not used</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 small text-ink2">
              <li>No value on this site was generated by AI; every number comes from a NASA table or document.</li>
              <li>No AI runs in the website. It answers nothing and predicts nothing at run time.</li>
              <li>No missing measurement is filled in. Missing stays missing, and is shown as such.</li>
            </ul>
          </div>
        </div>
        <p className="caption mt-4">To rebuild everything from the raw files: <code className="num">python3 scripts/build_data.py</code>. It prints every count shown on this page.</p>
      </Section>
    </Page>
  )
}
