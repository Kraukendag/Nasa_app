// =============================================================================
//  HOW IT WORKS (one-glance flowchart, Pipeline page)
// =============================================================================
//  The whole system as a drawn flowchart in three lanes:
//    data from NASA  ->  processing (before the site goes live)  ->  product
//  Each box has the technical name (the real file or tool) and, under it,
//  the same step in plain words, so judges and non-specialists can both
//  follow it. Row 1 runs left to right, row 2 back right to left, row 3 left
//  to right, so the arrows read as one path. Numbers come from the live data.
//  On phones the drawing keeps its size and scrolls sideways.
// =============================================================================

import type { Dataset } from '../data'

// Site colours (tailwind.config.js) plus the chart green and blue used elsewhere.
const C = { ink: '#16181D', ink2: '#3D424C', mute: '#646B78', rule: '#E3E1DA', line: '#8A8F99', accent: '#B5400F', nasa: '#1F7A4D', check: '#2A78D6', wash: '#F3F1EA' }
type Kind = 'nasa' | 'ai' | 'check' | 'code' | 'user'
const STYLE: Record<Kind, { fill: string; stroke: string; tech: string }> = {
  nasa: { fill: '#1F7A4D12', stroke: C.nasa, tech: C.nasa },
  ai: { fill: '#B5400F12', stroke: C.accent, tech: C.accent },
  check: { fill: '#2A78D612', stroke: C.check, tech: C.check },
  code: { fill: '#FFFFFF', stroke: '#C9C6BC', tech: C.ink2 },
  user: { fill: C.wash, stroke: '#C9C6BC', tech: C.ink2 },
}
const MONO = '"IBM Plex Mono", ui-monospace, monospace'

const W = 260, H = 82                 // standard box
const X = [30, 370, 710]              // three columns (viewBox is 1000 wide)
const cx = (i: number) => X[i] + W / 2

/** tech: the real file or tool. plain: what it does, in everyday words. detail: one fact. */
function Box({ col, y, kind, tech, plain, detail }: { col: number; y: number; kind: Kind; tech: string; plain: string; detail: string }) {
  const s = STYLE[kind]
  return (
    <g>
      <rect x={X[col]} y={y} width={W} height={H} rx={10} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
      <text x={cx(col)} y={y + 24} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={MONO} fill={s.tech}>{tech}</text>
      <text x={cx(col)} y={y + 46} textAnchor="middle" fontSize={14.5} fontWeight={600} fill={C.ink}>{plain}</text>
      <text x={cx(col)} y={y + 66} textAnchor="middle" fontSize={12.5} fill={C.ink2}>{detail}</text>
    </g>
  )
}

/** NASA's data store, drawn as a database cylinder. */
function Cylinder({ col, y, tech, plain, detail }: { col: number; y: number; tech: string; plain: string; detail: string }) {
  const x = X[col], ry = 9
  return (
    <g>
      <path d={`M${x},${y + ry} v${H - ry} a${W / 2},${ry} 0 0 0 ${W},0 v-${H - ry}`} fill={STYLE.nasa.fill} stroke={C.nasa} strokeWidth={2} />
      <ellipse cx={cx(col)} cy={y + ry} rx={W / 2} ry={ry} fill="#E6F0EA" stroke={C.nasa} strokeWidth={2} />
      <text x={cx(col)} y={y + 34} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={MONO} fill={C.nasa}>{tech}</text>
      <text x={cx(col)} y={y + 55} textAnchor="middle" fontSize={14.5} fontWeight={600} fill={C.ink}>{plain}</text>
      <text x={cx(col)} y={y + 74} textAnchor="middle" fontSize={12.5} fill={C.ink2}>{detail}</text>
    </g>
  )
}

/** Lane title. The paper-coloured strip behind it lets a connector pass under the words. */
const Lane = ({ y, n, label, note }: { y: number; n: number; label: string; note: string }) => (
  <g>
    <rect x={X[0] - 6} y={y - 13} width={360} height={18} fill="#FAFAF7" />
    <text x={X[0]} y={y} fontSize={11.5} fill={C.mute}>
      <tspan fontWeight={700} letterSpacing={1.2}>{n} · {label}</tspan><tspan dx={8}>{note}</tspan>
    </text>
  </g>
)
const Rule = ({ y }: { y: number }) => <line x1={10} x2={990} y1={y} y2={y} stroke={C.rule} strokeWidth={1.5} />

export default function HowItWorks({ data }: { data: Dataset }) {
  const bc = data.findings.bass2_counts
  const nq = data.findings.research_questions.length
  const r1 = 40, r2 = 206, r3 = 368          // tops of the three rows
  const mid = (y: number) => y + H / 2
  const join = r1 + H + 22                    // where NASA tables and AI output meet
  const site = { x: X[1], y: r3 - 18, w: W, h: 140 }
  const outs: [string, string, string][] = [
    ['#/lab', '3D Experiment Lab', 'GLSL flame'],
    ['#/habitat', 'Lunar habitat chart', 'Moon base'],
    ['#/search', 'AI search', 'MiniLM, offline'],
    ['#/findings', `Findings & ${nq} questions`, 'open gaps'],
  ]

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 1000 520" className="w-full min-w-[760px] h-auto font-sans" role="img"
             aria-label={`Flowchart. Data from NASA: ${data.tests.length} records in 14 PSI tables and the BASS-II report, which AI reads into ${bc.endings_report} test endings. Processing in Python: loaders read every table, build_data and derive clean the data and build the findings, 18 automatic checks. Product: GitHub Actions publishes a React and three.js website with a 3D lab, lunar habitat chart, AI search and findings, used in the browser.`}>
          <defs>
            <marker id="hiw-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.line} />
            </marker>
          </defs>

          <Rule y={r2 - 34} />
          <Rule y={r3 - 50} />

          {/* connectors, drawn first so the boxes sit on top */}
          <g stroke={C.line} strokeWidth={2} fill="none">
            <line x1={X[1] + W} y1={mid(r1)} x2={X[2] - 2} y2={mid(r1)} markerEnd="url(#hiw-arrow)" />
            <polyline points={`${cx(0)},${r1 + H + 9} ${cx(0)},${join} ${cx(2)},${join}`} />
            <line x1={cx(2)} y1={r1 + H} x2={cx(2)} y2={join} />
            <line x1={cx(2)} y1={join} x2={cx(2)} y2={r2 - 2} markerEnd="url(#hiw-arrow)" />
            <line x1={X[2]} y1={mid(r2)} x2={X[1] + W + 2} y2={mid(r2)} markerEnd="url(#hiw-arrow)" />
            <line x1={X[1]} y1={mid(r2)} x2={X[0] + W + 2} y2={mid(r2)} markerEnd="url(#hiw-arrow)" />
            <line x1={cx(0)} y1={r2 + H} x2={cx(0)} y2={r3 - 2} markerEnd="url(#hiw-arrow)" />
            <line x1={X[0] + W} y1={mid(r3)} x2={site.x - 2} y2={mid(r3)} markerEnd="url(#hiw-arrow)" />
            <line x1={site.x + site.w} y1={mid(r3)} x2={X[2] - 2} y2={mid(r3)} markerEnd="url(#hiw-arrow)" />
          </g>
          <circle cx={cx(2)} cy={join} r={4} fill={C.line} />

          {/* lane titles, after the connectors so the line passes under them */}
          <Lane y={26} n={1} label="DATA FROM NASA" note="downloaded, never edited" />
          <Lane y={r2 - 12} n={2} label="PROCESSING" note="Python, runs before the site goes live" />
          <Lane y={r3 - 30} n={3} label="PRODUCT" note="runs in your browser, no server" />

          {/* row 1: data from NASA, left to right */}
          <Cylinder col={0} y={r1} tech="data_raw/PSI-*.csv  ×14" plain="NASA experiment tables" detail={`${data.tests.length.toLocaleString()} test records`} />
          <Box col={1} y={r1} kind="nasa" tech="NASA/TM-20210011385" plain="NASA's BASS-II report" detail="144 pages; endings only as notes" />
          <Box col={2} y={r1} kind="ai" tech="AI transcription → CSV" plain="AI reads the report" detail={`${bc.endings_report} test endings, each with its page`} />

          {/* row 2: processing, right to left */}
          <Box col={2} y={r2} kind="code" tech="loaders.py" plain="Read every table" detail="blank cells stay blank, never 0" />
          <Box col={1} y={r2} kind="code" tech="build_data.py · derive.py" plain="Clean, label, build findings" detail={`sources tagged · ${nq} questions · FLEX model`} />
          <Box col={0} y={r2} kind="check" tech="test_pipeline.py" plain="18 automatic checks" detail="nothing invented, nothing deleted" />

          {/* row 3: product, left to right */}
          <Box col={0} y={r3} kind="code" tech="GitHub Actions → Pages" plain="Publish the website" detail="only if every check passes" />
          <g>
            <rect x={site.x} y={site.y} width={site.w} height={site.h} rx={10} fill="#FFFFFF" stroke={C.ink2} strokeWidth={2} />
            <text x={site.x + 18} y={site.y + 24} fontSize={13} fontWeight={600} fontFamily={MONO} fill={C.ink2}>React · TypeScript · three.js</text>
            <text x={site.x + 18} y={site.y + 45} fontSize={14.5} fontWeight={600} fill={C.ink}>The Micro Flamma website</text>
            {outs.map(([href, label, tech], i) => (
              <a key={href} href={href}>
                <text x={site.x + 18} y={site.y + 69 + i * 18.5} fontSize={13}>
                  <tspan fill={C.accent}>• {label}</tspan><tspan fill={C.mute} fontSize={11.5}>  {tech}</tspan>
                </text>
              </a>
            ))}
          </g>
          <Box col={2} y={r3} kind="user" tech="any browser, phone or laptop" plain="You explore and ask" detail="every number links back to NASA" />
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
