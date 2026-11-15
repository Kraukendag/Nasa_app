// =============================================================================
//  HOW IT WORKS (one-glance flowchart, Pipeline page)
// =============================================================================
//  The whole system as a drawn flowchart in three lanes:
//    data from NASA  ->  processing (before the site goes live)  ->  product
//  Each box has a step number, an icon, the technical name (the real file or
//  tool) and, under it, the same step in plain words, so judges and
//  non-specialists can both follow it. Row 1 runs left to right, row 2 back
//  right to left, row 3 left to right, so the arrows read as one path; they
//  flow gently (switched off for people who turn off motion).
//  Numbers come from the live data. On phones the drawing keeps its size and
//  scrolls sideways so the text stays readable.
// =============================================================================

import type { ReactNode } from 'react'
import type { Dataset } from '../data'

// Site colours (tailwind.config.js) plus the chart green and blue used elsewhere.
const C = { ink: '#16181D', ink2: '#3D424C', mute: '#646B78', rule: '#E3E1DA', line: '#8A8F99', accent: '#B5400F', nasa: '#1F7A4D', check: '#2A78D6', wash: '#F3F1EA', paper: '#FAFAF7' }
type Kind = 'nasa' | 'ai' | 'check' | 'code' | 'site' | 'user'
const STYLE: Record<Kind, { fill: string; stroke: string; tech: string }> = {
  nasa: { fill: '#1F7A4D12', stroke: C.nasa, tech: C.nasa },
  ai: { fill: '#B5400F12', stroke: C.accent, tech: C.accent },
  check: { fill: '#2A78D612', stroke: C.check, tech: C.check },
  code: { fill: '#FFFFFF', stroke: '#B9B5AA', tech: C.ink2 },
  site: { fill: '#FFFFFF', stroke: C.ink, tech: C.ink2 },
  user: { fill: C.wash, stroke: '#B9B5AA', tech: C.ink2 },
}
const MONO = '"IBM Plex Mono", ui-monospace, monospace'

// Small line icons (24 x 24 grid), one per step.
const ICON: Record<string, string> = {
  report: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  ai: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3v4 M17 5h4',
  table: 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M8.5 12l2.5 2.5 4.5-5',
  upload: 'M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 7.9 M12 12v8 M9 15l3-3 3 3',
  browser: 'M3 5h18v14H3z M3 9h18 M6 7h.01 M9 7h.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3.5C11.5 9 11 6 12 3z',
}

const W = 270, H = 84                 // standard box
const X = [20, 365, 710]              // three columns (viewBox is 1000 wide)
const cx = (i: number) => X[i] + W / 2

function Icon({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  return <path d={ICON[name]} transform={`translate(${x} ${y}) scale(0.75)`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
}

/** Step number on the box's top-left corner: the order the data travels in. */
function Badge({ x, y, n, color }: { x: number; y: number; n: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={12} fill={color} stroke={C.paper} strokeWidth={3} />
      <text x={x} y={y + 4.5} textAnchor="middle" fontSize={12} fontWeight={700} fontFamily={MONO} fill="#FFFFFF">{n}</text>
    </g>
  )
}

/** tech: the real file or tool. plain: what it does in everyday words. detail: one fact. */
function Box({ col, y, kind, n, icon, tech, plain, detail }: { col: number; y: number; kind: Kind; n: number; icon: string; tech: string; plain: string; detail: string }) {
  const s = STYLE[kind]
  return (
    <g>
      <rect x={X[col]} y={y} width={W} height={H} rx={10} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
      <Icon x={X[col] + W - 28} y={y + 10} name={icon} color={s.stroke === '#B9B5AA' ? C.mute : s.stroke} />
      <text x={cx(col)} y={y + 26} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={MONO} fill={s.tech}>{tech}</text>
      <text x={cx(col)} y={y + 48} textAnchor="middle" fontSize={15} fontWeight={600} fill={C.ink}>{plain}</text>
      <text x={cx(col)} y={y + 68} textAnchor="middle" fontSize={12.5} fill={C.ink2}>{detail}</text>
      <Badge x={X[col] + 4} y={y + 4} n={n} color={s.stroke === '#B9B5AA' ? C.ink2 : s.stroke} />
    </g>
  )
}

/** NASA's data store, drawn as a database cylinder. */
function Cylinder({ col, y, n, tech, plain, detail }: { col: number; y: number; n: number; tech: string; plain: string; detail: string }) {
  const x = X[col], ry = 9
  return (
    <g>
      <path d={`M${x},${y + ry} v${H - ry} a${W / 2},${ry} 0 0 0 ${W},0 v-${H - ry}`} fill={STYLE.nasa.fill} stroke={C.nasa} strokeWidth={2} />
      <ellipse cx={cx(col)} cy={y + ry} rx={W / 2} ry={ry} fill="#E6F0EA" stroke={C.nasa} strokeWidth={2} />
      <text x={cx(col)} y={y + 36} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={MONO} fill={C.nasa}>{tech}</text>
      <text x={cx(col)} y={y + 57} textAnchor="middle" fontSize={15} fontWeight={600} fill={C.ink}>{plain}</text>
      <text x={cx(col)} y={y + 76} textAnchor="middle" fontSize={12.5} fill={C.ink2}>{detail}</text>
      <Badge x={x + 4} y={y + 12} n={n} color={C.nasa} />
    </g>
  )
}

/** Lane title. The paper-coloured strip behind it lets a connector pass under the words. */
const Lane = ({ y, n, label, note }: { y: number; n: string; label: string; note: string }) => (
  <g>
    <rect x={X[0] - 6} y={y - 13} width={430} height={18} fill={C.paper} />
    <text x={X[0]} y={y} fontSize={11.5} fill={C.mute}>
      <tspan fontWeight={700} letterSpacing={1.4} fill={C.ink2}>{n}  {label}</tspan><tspan dx={10}>{note}</tspan>
    </text>
  </g>
)
const Rule = ({ y }: { y: number }) => <line x1={10} x2={990} y1={y} y2={y} stroke={C.rule} strokeWidth={1.5} strokeDasharray="2 5" />

export default function HowItWorks({ data }: { data: Dataset }) {
  const bc = data.findings.bass2_counts
  // The full count, also in strict mode (where questions citing NASA reports are hidden).
  const nq = data.findings.research_questions.length + (data.findings.research_questions_hidden ?? 0)
  const nTests = data.tests.filter((t) => !t.is_note && !t.is_flow_vis).length
  const r1 = 44, r2 = 214, r3 = 384          // tops of the three rows
  const mid = (y: number) => y + H / 2
  const join = r1 + H + 24                    // where NASA tables and AI output meet
  const site = { x: X[1], y: r3 - 20, w: W, h: 150 }
  // The four main parts of the site, in the menu's order.
  const outs: [string, string, string][] = [
    ['#/lab', 'Experiment Lab', '3D flame, real test'],
    ['#/data', 'Data', `all ${data.tests.length.toLocaleString()} records`],
    ['#/questions', 'Research questions', `${nq} open gaps`],
    ['#/ranking', 'Ranking', 'score any mission'],
  ]
  const flow = (d: ReactNode) => <g className="hiw-flow" stroke={C.line} strokeWidth={2} fill="none">{d}</g>

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 1000 560" className="w-full min-w-[760px] h-auto font-sans" role="img"
             aria-label={`Flowchart in nine steps. Data from NASA: 1. the 14 PSI tables (${data.tests.length} records) and 2. NASA's BASS-II report, which 3. AI reads into ${bc.endings_report} test endings. Processing in Python: 4. loaders.py reads every table, 5. build_data.py and derive.py clean the data and build the findings, 6. test_pipeline.py runs 18 automatic checks. Product: 7. GitHub Actions publishes 8. the website (Experiment Lab, Data, Research questions, Ranking), which 9. you use in your browser.`}>
          <defs>
            <marker id="hiw-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.line} />
            </marker>
          </defs>
          <style>{`
            .hiw-flow line, .hiw-flow polyline { stroke-dasharray: 7 5; animation: hiw-dash 1.6s linear infinite }
            @keyframes hiw-dash { to { stroke-dashoffset: -24 } }
            @media (prefers-reduced-motion: reduce) { .hiw-flow line, .hiw-flow polyline { animation: none } }
            .hiw-link:hover text tspan:first-child { text-decoration: underline }
          `}</style>

          <Rule y={r2 - 38} />
          <Rule y={r3 - 54} />

          {/* connectors, drawn first so the boxes sit on top */}
          {flow(<>
            <line x1={X[1] + W} y1={mid(r1)} x2={X[2] - 2} y2={mid(r1)} markerEnd="url(#hiw-arrow)" />
            <polyline points={`${cx(0)},${r1 + H + 9} ${cx(0)},${join} ${cx(2)},${join}`} />
            <line x1={cx(2)} y1={r1 + H} x2={cx(2)} y2={join} />
            <line x1={cx(2)} y1={join} x2={cx(2)} y2={r2 - 2} markerEnd="url(#hiw-arrow)" />
            <line x1={X[2]} y1={mid(r2)} x2={X[1] + W + 2} y2={mid(r2)} markerEnd="url(#hiw-arrow)" />
            <line x1={X[1]} y1={mid(r2)} x2={X[0] + W + 2} y2={mid(r2)} markerEnd="url(#hiw-arrow)" />
            <line x1={cx(0)} y1={r2 + H} x2={cx(0)} y2={r3 - 2} markerEnd="url(#hiw-arrow)" />
            <line x1={X[0] + W} y1={mid(r3)} x2={site.x - 2} y2={mid(r3)} markerEnd="url(#hiw-arrow)" />
            <line x1={site.x + site.w} y1={mid(r3)} x2={X[2] - 2} y2={mid(r3)} markerEnd="url(#hiw-arrow)" />
          </>)}
          <circle cx={cx(2)} cy={join} r={4.5} fill={C.line} />

          {/* lane titles, after the connectors so the line passes under them */}
          <Lane y={24} n="A" label="DATA FROM NASA" note="downloaded, never edited" />
          <Lane y={r2 - 14} n="B" label="PROCESSING" note="Python, runs before the site goes live" />
          <Lane y={r3 - 32} n="C" label="PRODUCT" note="published on GitHub Pages, runs in your browser" />

          {/* row 1: data from NASA, left to right */}
          <Cylinder col={0} y={r1} n={1} tech="data_raw/PSI-*.csv  ×14" plain="NASA experiment tables" detail={`${data.tests.length.toLocaleString()} records (${nTests.toLocaleString()} tests)`} />
          <Box col={1} y={r1} kind="nasa" n={2} icon="report" tech="NASA/TM-20210011385" plain="NASA's BASS-II report" detail="144 pages; endings only as notes" />
          <Box col={2} y={r1} kind="ai" n={3} icon="ai" tech="AI transcription → CSV" plain="AI reads the report" detail={`${bc.endings_report} test endings, each with its page`} />

          {/* row 2: processing, right to left */}
          <Box col={2} y={r2} kind="code" n={4} icon="table" tech="loaders.py" plain="Read every table" detail="blank cells stay blank, never 0" />
          <Box col={1} y={r2} kind="code" n={5} icon="layers" tech="build_data.py · derive.py" plain="Clean, label, build findings" detail={`sources tagged · ${nq} questions · FLEX`} />
          <Box col={0} y={r2} kind="check" n={6} icon="shield" tech="test_pipeline.py" plain="18 automatic checks" detail="nothing invented, nothing deleted" />

          {/* row 3: product, left to right */}
          <Box col={0} y={r3} kind="code" n={7} icon="upload" tech="GitHub Actions → Pages" plain="Publish the website" detail="only if every check passes" />
          <g>
            <rect x={site.x} y={site.y} width={site.w} height={site.h} rx={10} fill="#FFFFFF" stroke={C.ink} strokeWidth={2} />
            <rect x={site.x} y={site.y} width={site.w} height={46} rx={10} fill={C.wash} />
            <rect x={site.x} y={site.y + 36} width={site.w} height={10} fill={C.wash} />
            <line x1={site.x} x2={site.x + site.w} y1={site.y + 46} y2={site.y + 46} stroke={C.rule} />
            <rect x={site.x} y={site.y} width={site.w} height={site.h} rx={10} fill="none" stroke={C.ink} strokeWidth={2} />
            <Icon x={site.x + site.w - 28} y={site.y + 10} name="flame" color={C.accent} />
            <text x={site.x + 20} y={site.y + 20} fontSize={12} fontWeight={600} fontFamily={MONO} fill={C.ink2}>React · TypeScript · three.js</text>
            <text x={site.x + 20} y={site.y + 38} fontSize={15} fontWeight={600} fill={C.ink}>The Micro Flamma website</text>
            {outs.map(([href, label, note], i) => (
              <a key={href} href={href} className="hiw-link">
                <text x={site.x + 20} y={site.y + 70 + i * 21} fontSize={13.5}>
                  <tspan fill={C.accent} fontWeight={600}>{label}</tspan><tspan fill={C.mute} fontSize={12}>  ·  {note}</tspan>
                </text>
              </a>
            ))}
            <Badge x={site.x + 4} y={site.y + 4} n={8} color={C.ink} />
          </g>
          <Box col={2} y={r3} kind="user" n={9} icon="person" tech="any browser or phone" plain="You explore and ask" detail="every number links back to NASA" />
        </svg>
      </div>
      <p className="flex flex-wrap gap-x-6 gap-y-1 small text-ink2 border-t border-rule pt-3">
        <span><b className="text-ink">$0</b> to run: no server, no API keys</span>
        <span><b className="text-ink">Offline</b> after the first visit</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1.5 border-2" style={{ borderColor: C.nasa }} />NASA data</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1.5 border-2" style={{ borderColor: C.accent }} />AI step</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1.5 border-2" style={{ borderColor: C.check }} />Automatic check</span>
      </p>
    </div>
  )
}
