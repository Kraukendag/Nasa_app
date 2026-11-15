// =============================================================================
//  MICRO FLAMMA  ·  build_search_index.mjs
// =============================================================================
//  Builds the AI search index: every record, finding, research question,
//  material card, recommendation and glossary term is turned into a
//  "meaning vector" by a small open sentence-embedding model
//  (all-MiniLM-L6-v2, Apache-2.0), run HERE at build time.
//
//  In the browser, the same model (bundled in public/models, no network)
//  turns the visitor's question into a vector, and the page returns the
//  closest items. It only RETRIEVES existing NASA-sourced text with its
//  citation; it never writes an answer.
//
//      node scripts/build_search_index.mjs      (after build_data.py)
// =============================================================================

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { env, pipeline } from '@huggingface/transformers'

const DATA = 'public/data'
const read = (f) => JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8'))
env.localModelPath = 'public/models/'
env.allowRemoteModels = false        // never download anything during the build

const tests = read('tests.json')
const findings = read('findings.json')
const materials = read('materials.json')
const literature = read('literature.json')
const investigations = read('investigations.json')
const acr = Object.fromEntries(investigations.map((i) => [i.psi_id, i.acronym]))
const doiOf = Object.fromEntries(investigations.map((i) => [i.psi_id, i.doi]))
// What strict PSI mode keeps (built by build_data.py from PSI cells only).
const strictF = read('findings_strict.json')
const strictIds = new Set([...strictF.key_insights.map((k) => k.id), ...strictF.surprises.map((x) => x.id),
  ...strictF.negative_knowledge.map((x) => x.title), ...strictF.research_questions.map((q) => q.id)])
const strictMat = Object.fromEntries(read('materials_strict.json').map((m) => [m.id, m]))
const ntrs = (key) => ({ kind: 'ntrs', ntrs: literature.sources[key]?.ntrs ?? null, title: literature.sources[key]?.title ?? key })

// ---- The documents: short, self-contained, each with where it lives -------
const docs = []
// src: where the item comes from (shown as a badge). strict: kept in strict
// PSI mode. text_strict: the same item with Appendix A fields removed.
const clean = (x) => x.replace(/\s+/g, ' ').trim()
const add = (type, id, title, text, link, src, strict = true, textStrict = null) =>
  docs.push({ type, id, title, text: clean(text), link, src, strict, ...(textStrict != null ? { text_strict: clean(textStrict) } : {}) })

for (const t of tests) {
  if (t.is_note || t.is_flow_vis) continue
  const n = t.normalized
  const tiers = t.field_tiers ?? {}
  const appendix = (f) => tiers[f] === 'NTRS_APPENDIX_TRANSCRIBED'
  const bitsFor = (strict) => [
    n.material || n.material_raw, n.geometry, n.fuel_state,
    n.o2_display || (n.o2_percent != null ? `${n.o2_percent}% oxygen` : null),
    n.flow_cm_s != null ? `airflow ${n.flow_cm_s} cm/s ${strict && appendix('flow_direction') ? '' : n.flow_direction || ''}` : null,
    n.pressure_kpa != null ? `${n.pressure_kpa} kPa` : null,
    n.droplet_d0_mm != null ? `droplet ${n.droplet_d0_mm} mm` : null,
    strict && appendix('outcome') ? null : n.outcome, strict && appendix('outcome_text') ? null : n.outcome_text,
  ].filter(Boolean).join('. ')
  const usesAppendix = Object.values(tiers).includes('NTRS_APPENDIX_TRANSCRIBED') && (n.outcome || n.flow_direction)
  add('record', t.id, `${t.psi_id} ${acr[t.psi_id] ?? ''} · ${t.test_number ?? `row ${t.row_index}`}`, bitsFor(false),
    `#/data/inv:${t.psi_id}`, { kind: 'psi', psi: t.psi_id, doi: doiOf[t.psi_id] ?? null, appendix: !!usesAppendix },
    true, usesAppendix ? bitsFor(true) : null)
}
const psiSrc = (psi) => (psi ? { kind: 'psi', psi, doi: doiOf[psi] ?? null } : { kind: 'psi', psi: null, doi: null })
const mixed = (lits, psi) => (lits.length ? { kind: 'mixed', psi: psi ?? null, doi: psi ? doiOf[psi] ?? null : null, ntrs: lits.map((l) => literature.sources[l]?.ntrs).filter(Boolean) } : psiSrc(psi))
for (const k of findings.key_insights) add('finding', k.id, k.headline, `${k.headline}. ${k.detail}`, '#/findings', mixed(k.lit.filter((l) => l !== 'BASS2_TM'), k.psi_id), strictIds.has(k.id))
for (const s of findings.surprises) add('finding', s.id, s.title, `${s.title}. ${s.text}`, '#/findings', psiSrc(s.evidence?.psi_id ?? null), strictIds.has(s.id))
for (const x of findings.negative_knowledge) add('negative', x.title, x.title, `${x.title}. ${x.detail}`, '#/findings', psiSrc(x.psi_id ?? null), strictIds.has(x.title))
for (const f of findings.flamelets) add('finding', `flamelet-${f.test}`, `Flamelets in BASS-II test ${f.test}`, f.text, '#/findings', ntrs('BASS2_TM'), false)
for (const q of findings.research_questions)
  add('question', q.id, `${q.id} · ${q.question}`, `${q.question} ${q.why} ${q.gap}`, '#/questions',
    mixed((q.refs ?? []).filter((r) => !r.startsWith('PSI-')), (q.refs ?? []).find((r) => r.startsWith('PSI-')) ?? null), strictIds.has(q.id))
// Habitat recommendations may use NASA reports outside PSI (they are kept in strict mode, labelled).
for (const r of findings.recommendations)
  add('recommendation', r.id, `${r.id} · ${r.title}`, `${r.title}. ${r.action} ${r.evidence.map((e) => e.text).join(' ')}`, '#/habitat',
    mixed([...new Set(r.evidence.map((e) => e.lit).filter(Boolean))], null))
for (const m of materials) {
  const sm = strictMat[m.id]
  add('material', m.id, `${m.name} (${m.fuel_state})`, `${m.name}. ${m.summary} ${m.caveat ?? ''}`, `#/data/${encodeURIComponent(m.name)}`,
    psiSrc(m.investigations?.[0] ?? null), true, sm && sm.summary !== m.summary ? `${m.name}. ${sm.summary} ${sm.caveat ?? ''}` : null)
}
for (const g of literature.glossary) add('glossary', g.term, g.term, `${g.term}: ${g.plain}`, '#/about', ntrs(g.source), false)
for (const s of literature.statements) add('literature', s.text.slice(0, 40), literature.sources[s.source].title, s.text, '#/findings', ntrs(s.source), false)

// ---- Embed ------------------------------------------------------------------
const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
const dim = 384
const q = new Int8Array(docs.length * dim)
const BATCH = 64
for (let i = 0; i < docs.length; i += BATCH) {
  const slice = docs.slice(i, i + BATCH)
  const out = await embed(slice.map((d) => `${d.title}. ${d.text}`.slice(0, 1000)), { pooling: 'mean', normalize: true })
  const arr = out.data
  for (let j = 0; j < slice.length; j++) {
    for (let k = 0; k < dim; k++) q[(i + j) * dim + k] = Math.max(-127, Math.min(127, Math.round(arr[j * dim + k] * 127)))
  }
  process.stdout.write(`\r  embedded ${Math.min(i + BATCH, docs.length)} / ${docs.length}`)
}

// A fingerprint of the data, so the pipeline checks can tell a stale index.
const hash = createHash('sha256')
for (const f of ['tests.json', 'findings.json', 'materials.json', 'literature.json', 'findings_strict.json', 'materials_strict.json']) hash.update(readFileSync(`${DATA}/${f}`))

writeFileSync(`${DATA}/search_index.json`, JSON.stringify({
  model: 'Xenova/all-MiniLM-L6-v2 (q8, Apache-2.0)', dim, count: docs.length,
  data_hash: hash.digest('hex'),
  docs: docs.map((d) => ({ ...d, text: d.text.slice(0, 400), ...(d.text_strict != null ? { text_strict: d.text_strict.slice(0, 400) } : {}) })),
  vectors_int8_base64: Buffer.from(q.buffer).toString('base64'),
}))
console.log(`\n  wrote ${DATA}/search_index.json (${docs.length} items)`)
