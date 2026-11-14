// =============================================================================
//  TAB 4 — ABOUT
// =============================================================================
//  Who built this, what it is made of, and an honest list of what it cannot
//  tell you. The limitations section is deliberately as prominent as the
//  features: knowing where the data stops is the point of the project.
// =============================================================================

import type { Dataset } from '../data'

const TEAM = [
  { name: 'Shonazarov Abdurahmon', role: 'Developer',    blurb: 'Builds the application' },
  { name: 'Qosimov Muhammadali',   role: 'Developer',    blurb: 'Builds the application' },
  { name: 'Azizov Ozodbek',        role: 'Pitch',        blurb: 'Presents the project' },
  { name: 'Nozimov Daler',         role: 'Design',       blurb: 'Visual identity and interface' },
  { name: 'Shokirov Azizbek',      role: 'Connections',  blurb: 'Outreach and coordination' },
  { name: 'Saydullayev Shohjahon', role: 'Theory',       blurb: 'Combustion science and research' },
]

export default function TabAbout({ data }: { data: Dataset }) {
  const totalAnomalies = Object.values(data.findings.anomaly_summary).reduce((a, b) => a + b, 0)

  return (
    <div className="overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 space-y-12">

        {/* ---------- Intro ---------- */}
        <header className="anim-fade-up">
          <img
            src={`${import.meta.env.BASE_URL}brand/microflamma-logo.png`}
            alt="Micro Flamma"
            className="h-24 object-contain mb-6 rounded-lg bg-white/95 p-3"
          />
          <p className="mt-4 max-w-2xl text-slate-300 leading-relaxed">
            An interactive explorer for NASA's microgravity combustion research, built for the
            NASA Space Apps Challenge. Every number on this site comes from a NASA Physical
            Sciences Informatics experimental table. Nothing is estimated, interpolated or
            filled in from memory.
          </p>
        </header>

        {/* ---------- Numbers ---------- */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
          <Metric value={data.tests.length.toLocaleString()} label="Records" />
          <Metric value={String(data.investigations.length)} label="Investigations" />
          <Metric value={String(data.materials.length)} label="Materials & fuels" />
          <Metric value={String(totalAnomalies)} label="Flags surfaced" />
        </section>

        {/* ---------- Team ---------- */}
        <section>
          <h2 className="text-xl font-semibold mb-1">The team</h2>
          <p className="text-sm text-mute mb-5">Six people, one weekend.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="panel p-4 hover:border-cryo/40 transition-all duration-300
                           hover:-translate-y-0.5"
              >
                {/* Initials stand in for a photo — no real faces on the site. */}
                <div className="w-10 h-10 rounded-full grid place-items-center mb-3
                                bg-gradient-to-br from-cryo/25 to-flame/25 border border-edge
                                font-mono text-xs text-slate-200">
                  {person.name.split(' ').map((w) => w[0]).join('')}
                </div>
                <div className="font-medium text-sm text-slate-100">{person.name}</div>
                <div className="text-[11px] text-cryo mt-1 uppercase tracking-wider">
                  {person.role}
                </div>
                <div className="text-[11px] text-mute mt-1.5">{person.blurb}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- What it cannot tell you ---------- */}
        <section>
          <h2 className="text-xl font-semibold mb-1">What this cannot tell you</h2>
          <p className="text-sm text-mute mb-5">
            The gaps matter as much as the data. These are real limits of what has been measured.
          </p>
          <div className="space-y-2 stagger">
            {data.findings.gaps.map((gap, i) => (
              <div key={i} className="panel-flat p-3 flex gap-3">
                <span className="text-star text-xs mt-0.5 shrink-0">✕</span>
                <span className="text-sm text-slate-300">{gap}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Surprises ---------- */}
        <section>
          <h2 className="text-xl font-semibold mb-5">Three things that surprised everyone</h2>
          <div className="grid md:grid-cols-3 gap-3 stagger">
            {data.findings.surprises.map((item) => (
              <div key={item.id} className="panel p-4">
                <h3 className="font-medium text-sm text-cryo mb-2">{item.title}</h3>
                <p className="text-[12px] text-slate-300 leading-relaxed">{item.text}</p>
                {typeof item.evidence.doi === 'string' && (
                  <a
                    href={`https://doi.org/${item.evidence.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-3 text-[10px] text-mute hover:text-cryo transition-colors"
                  >
                    DOI {item.evidence.doi} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Sources ---------- */}
        <section>
          <h2 className="text-xl font-semibold mb-5">Sources</h2>
          <div className="panel divide-y divide-edge/50">
            {data.investigations.map((investigation) => (
              <div key={investigation.psi_id} className="p-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-cryo w-20 shrink-0">
                  {investigation.psi_id}
                </span>
                <span className="text-sm text-slate-200">{investigation.title}</span>
                <span className="text-[11px] text-mute">{investigation.acronym}</span>
                <span className="tabular text-[11px] text-mute ml-auto">
                  {investigation.row_count} rows
                </span>
                {investigation.doi ? (
                  <a
                    href={investigation.doi_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-mute hover:text-cryo transition-colors w-44 text-right"
                  >
                    {investigation.doi} ↗
                  </a>
                ) : (
                  <span className="text-[10px] text-star/70 w-44 text-right">DOI not yet recorded</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-mute leading-relaxed max-w-3xl">
            Data from the NASA Physical Sciences Informatics repository. Fan-speed conversion for
            BASS-II uses NASA's own published calibration. This project is not affiliated with or
            endorsed by NASA, and does not use NASA branding. It is a research summary, not a
            material certification or a safety approval.
          </p>
        </section>
      </div>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel p-4">
      <div className="text-2xl font-bold tabular text-slate-100">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  )
}
