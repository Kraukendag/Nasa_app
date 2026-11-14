// =============================================================================
//  TAB 5 — ABOUT
// =============================================================================
//  Who built this, how AI was used, what it is made of, why it matters on
//  Earth too, and -- given as much space as the features -- what it cannot
//  tell you.
// =============================================================================

import type { Dataset } from '../data'

const TEAM = [
  { name: 'Shonazarov Abdurahmon', role: 'Developer' },
  { name: 'Qosimov Muhammadali', role: 'Developer' },
  { name: 'Azizov Ozodbek', role: 'Pitch' },
  { name: 'Nozimov Daler', role: 'Design' },
  { name: 'Shokirov Azizbek', role: 'Connections' },
  { name: 'Saydullayev Shohjahon', role: 'Theory' },
]

export default function TabAbout({ data }: { data: Dataset }) {
  const flags = Object.values(data.findings.anomaly_summary).reduce((a, b) => a + b, 0)
  const withOutcome = data.tests.filter((t) => t.normalized.outcome_class).length
  const m = data.flexModel.metrics

  return (
    <div className="overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 space-y-12">
        <header className="anim-fade-up">
          <img src={`${import.meta.env.BASE_URL}brand/microflamma-logo.png`} alt="Micro Flamma" className="h-24 object-contain mb-6 rounded-lg bg-white/95 p-3" />
          <p className="max-w-2xl text-slate-300 leading-relaxed">
            An interactive explorer for NASA's microgravity combustion research, built for the NASA Space Apps Challenge 2026
            ("Flame in Freefall"). The numbers come from 14 NASA Physical Sciences Informatics (PSI) experimental tables. The
            BASS-II outcomes come from NASA's BASS-II Summary Report. Nothing is estimated, interpolated or filled in from memory.
          </p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          <Metric v={data.tests.length.toLocaleString()} l="Records" />
          <Metric v={`${withOutcome}`} l="With a recorded outcome" />
          <Metric v={`${data.materials.length}`} l="Material and fuel cards" />
          <Metric v={`${flags}`} l="Data-quality flags shown" />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-5">The team</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            {TEAM.map((p) => (
              <div key={p.name} className="panel p-4 hover:border-cryo/40 transition-all duration-300 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-full grid place-items-center mb-3 bg-gradient-to-br from-cryo/25 to-flame/25 border border-edge font-mono text-xs">
                  {p.name.split(' ').map((w) => w[0]).join('')}
                </div>
                <div className="font-medium text-sm text-slate-100">{p.name}</div>
                <div className="text-[11px] text-cryo mt-1 uppercase tracking-wider">{p.role}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">How AI was used</h2>
          <div className="panel p-5 space-y-2.5 text-[12.5px] text-slate-300 leading-relaxed">
            <p><span className="text-slate-100">Building it.</span> The team used Claude Code (Anthropic), an AI coding assistant, to write
              the data pipeline and the interface code, and to draft on-screen text. People reviewed the results.</p>
            <p><span className="text-slate-100">Transcribing outcomes.</span> BASS-II's experimental table does not say how each test ended,
              so the observations and flow directions for 126 tests were transcribed from the report's test matrices with AI assistance.
              Every one cites its page so it can be checked against the original.</p>
            <p><span className="text-slate-100">In the website itself, no AI runs.</span> There is no chatbot and no API key. "Ask the data" is
              keyword retrieval that returns matching passages with citations. The droplet outcome model is a classical logistic
              regression fitted to {data.flexModel.n_training_rows} FLEX tests: {Math.round(m.accuracy * 100)}% accuracy against a{' '}
              {Math.round(m.baseline_accuracy * 100)}% always-extinction baseline, AUC {m.auc.toFixed(2)}, validated on held-out conditions.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Why it matters on Earth too</h2>
          <p className="text-[11px] text-mute mb-4">BASS-II's own objectives say it feeds "the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth" (PSI-25 record). The links below are context, not results in these tables.</p>
          <div className="grid md:grid-cols-3 gap-3">
            <Benefit title="Smoke detectors that tell smoke from dust" body="SAME-R measures how smoke particles grow as they age, and DAFT measures dust aerosols that can trigger false alarms. Both are the same problem a building's smoke detector faces." tag="PSI-101 · PSI-47" />
            <Benefit title="Soot and cleaner flames" body="SPICE locates the smoke point, the fuel flow at which a flame starts releasing soot. That property also matters for burners and engines on Earth." tag="PSI-107" />
            <Benefit title="Low-temperature combustion" body="CFI and CFI-G study cool flames, the low-temperature chemistry that precedes ignition. Microgravity strips away buoyancy so it can be studied cleanly." tag="PSI-39 · PSI-159" />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">What this cannot tell you</h2>
          <div className="space-y-2 stagger">
            {data.findings.gaps.map((g) => (
              <div key={g} className="panel-flat p-3 flex gap-3"><span className="text-star text-xs mt-0.5">✕</span><span className="text-sm text-slate-300">{g}</span></div>
            ))}
            <div className="panel-flat p-3 flex gap-3"><span className="text-star text-xs mt-0.5">✕</span>
              <span className="text-sm text-slate-300">The 3D flame is an illustration. Its shape follows the published difference between buoyant and microgravity
                flames, and the sample's size and airflow come from the records. Colour, flicker and flame standoff are not measured values.</span></div>
            <div className="panel-flat p-3 flex gap-3"><span className="text-star text-xs mt-0.5">✕</span>
              <span className="text-sm text-slate-300">Outcome categories such as "extinguished as airflow was reduced" are this project's reading of NASA's notes.
                NASA's own words are always shown next to them.</span></div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-5">Sources</h2>
          <div className="panel divide-y divide-edge/50">
            {data.investigations.map((i) => (
              <div key={i.psi_id} className="p-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-cryo w-20 shrink-0">{i.psi_id}</span>
                <span className="text-sm text-slate-200">{i.title}</span>
                <span className="text-[11px] text-mute">{i.acronym}</span>
                <span className="tabular text-[11px] text-mute ml-auto">{i.row_count} rows</span>
                {i.doi ? <a href={i.doi_url!} target="_blank" rel="noreferrer" className="text-[10px] text-mute hover:text-cryo w-44 text-right">{i.doi} ↗</a>
                  : <span className="text-[10px] text-star/70 w-44 text-right">DOI not yet recorded</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-[11px] text-slate-300">
            <div className="panel-flat p-3 space-y-1">
              <div className="label mb-1">NASA reports and files</div>
              <div>Olson, Ferkul, Bhattacharjee, Miller, Fernandez-Pello, Link, T'ien, Wichman. <i>Burning and Suppression of Solids-II (BASS-II) Summary Report.</i> NASA/TM-20210011385, Oct 2021 (Appendix A test matrices, pp. 103-113).</div>
              <div>BASS-II "Fan calibration data.xlsx", PSI-25 resources (velocity = Air display × 1.0066).</div>
            </div>
            <div className="panel-flat p-3 space-y-1">
              <div className="label mb-1">Outside context (framing only, not data)</div>
              <div>NASA Space Apps 2026 challenge "Flame in Freefall": habitat and suit atmospheres.</div>
              <div><a className="hover:text-cryo" href="https://www.nasa.gov/flammability-of-materials-on-the-moon-fm2/" target="_blank" rel="noreferrer">NASA FM2, Flammability of Materials on the Moon ↗</a></div>
              <div><a className="hover:text-cryo" href="https://ntrs.nasa.gov/api/citations/20250010653/downloads/ASGSR%202025-LUCI-Ferkul-Presentation-v2-20250010653.pdf" target="_blank" rel="noreferrer">LUCI simulated-lunar-gravity flight, NTRS 20250010653 ↗</a></div>
              <div><a className="hover:text-cryo" href="https://ntrs.nasa.gov/api/citations/20260000646/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conference%202026.pdf" target="_blank" rel="noreferrer">Ferkul et al., LPSC 2026: lunar-gravity flame spread hypothesis ↗</a></div>
              <div>Later Saffire flights (IV-VI) studied other atmospheres; their tables are not in this dataset.</div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-mute leading-relaxed">
            Built with React, Three.js, React Three Fiber, drei, Tailwind CSS and Vite; data pipeline in Python. Not affiliated with or
            endorsed by NASA; no NASA branding is used. A research summary, not a material certification or a safety approval.
          </p>
        </section>
      </div>
    </div>
  )
}

function Metric({ v, l }: { v: string; l: string }) {
  return <div className="panel p-4"><div className="text-2xl font-bold tabular text-slate-100">{v}</div><div className="label mt-1">{l}</div></div>
}

function Benefit({ title, body, tag }: { title: string; body: string; tag: string }) {
  return (
    <div className="panel p-4">
      <h3 className="text-[13px] font-semibold text-slate-100">{title}</h3>
      <p className="text-[11.5px] text-slate-300 mt-2 leading-relaxed">{body}</p>
      <div className="text-[10px] font-mono text-cryo mt-3">{tag}</div>
    </div>
  )
}
