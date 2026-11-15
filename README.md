# Micro Flamma — Fire in Freefall

An interactive explorer for NASA's microgravity combustion research, built for the
NASA Space Apps Challenge 2026 ("Flame in Freefall").

The numbers come from 14 NASA Physical Sciences Informatics (PSI) experimental tables
(1,450 rows). The BASS-II outcomes come from NASA's BASS-II Summary Report. Nothing is
estimated, interpolated, or filled in from memory.

---

## How the project is put together

```
data_raw/*.csv  +  BASS-II Appendix A transcription
      │
      │   scripts/build_data.py   ← Python. Run by hand when data_raw changes.
      │     ├─ loaders.py           one reader per investigation (parsing, flags)
      │     ├─ derive.py            material cards, investigation profiles, negative
      │     │                       knowledge, coverage grid, key insights
      │     ├─ literature.py        verified values from NASA NTRS reports (LUCI,
      │     │                       Saffire IV-VI, KC-135), kept apart from PSI rows
      │     ├─ research_questions.py  54 open research questions, each from a data gap
      │     └─ flex_model.py        FLEX droplet outcome model + honest metrics
      ▼
public/data/*.json   (tests, investigations, materials, findings, flex_model, literature)
      │
      │   src/**                  ← React + TypeScript. The website.
      ▼
dist/                the finished static site
```

`data_raw/` holds the 14 NASA PSI experimental tables exactly as downloaded from PSI, under
PSI's own file names, with SHA-256 fingerprints in `data_raw/SHA256SUMS.txt`; `npm test` fails if
any of them is modified.

The website never runs Python and never calls a server. It loads six JSON files when it
opens and then works offline.

## Running it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run data
```

`npm run data` rebuilds the JSON from the CSVs and prints a reconciliation
(`1450 = 1431 tests + 15 footnotes + 4 flow-vis`). `npm run build` produces `dist/`.

```bash
npm test
```

`npm test` rebuilds the data and runs `scripts/test_pipeline.py`: row reconciliation,
raw cells kept, every BASS-II ending quoted word for word from the transcription with
its page, the cross-check, headline numbers recomputed from their rows, DOIs, citations
and bundled photos.

## Publishing

`.github/workflows/deploy.yml` runs the checks and the build on every push and, on the
publishing branch, deploys `dist/` to GitHub Pages. One-time setup in the repository:
**Settings → Pages → Source: GitHub Actions**.

## The pages

| Page | What it is |
|---|---|
| **Home** | A 3D match you can strike, with a gravity switch, and three data-backed findings. |
| **Lunar habitat** | Five recommendations for a habitat at about 30% O₂, 70 kPa and 0.16 g, each with its evidence and sources, how strong the evidence is, and the open questions it leaves. Drafted from the data for team review. |
| **AI search** | A small open language model (all-MiniLM-L6-v2) runs in the browser from bundled files and finds the records, findings, questions and materials closest in meaning to a question. Retrieval only; no server, API or key. |
| **Experiment Lab** | Choose what burns, which investigation, and the conditions. **Every control offers only values NASA recorded**, and each choice narrows the others. Centre: the 3D specimen in its recorded shape with a volumetric (ray-marched) flame whose behaviour follows NASA evidence: a spreading front, flamelets with branching char at very low airflow (BASS-II T4/T5, NASA Glenn NTRS 20050217475) that re-form a front when the airflow returns, a rod-tip cap that quenches or blows off as described in the BASS-II report, shrinking droplet shells, burner flames and cool-flame glow; a timeline to play, pause and scrub; a 0 g | 1 g split view where SAFFIRE-II recorded both; a real NASA photo to compare; and a panel listing the evidence for what is drawn; real NASA photographs and videos of the same experiments (NASA Image and Video Library), plus
related NASA SoFIE imagery for flat samples, for comparison; a 2D side view with the recorded dimensions; and a flammability map. Right: what actually happened. Moon and Mars show cited literature results and no flame. |
| **Data** | *Records*: all 1,450 rows with search, filters and a raw-row drawer. *Investigations*: profiles and a two-way compare. *Materials*: a card per tested material, with oxygen limits, 0 g vs 1 g, and literature from outside PSI marked as such. |
| **Findings** | Key findings, surprises, flames that break into flamelets (BASS-II tests T4 and T5 plus a NASA Glenn ground experiment), verified results beyond PSI (LUCI, Saffire IV-VI, KC-135), negative knowledge, and a coverage grid. |
| **Ranking** | Ranks investigations for a mission (default: lunar habitat, solid materials) on seven criteria, with every score, weight and calculation shown, a worked example and limitations. |
| **Research questions** | The team's ten picks, then 54 open questions, each with why it matters, what is known, what is missing, how to answer it and what to measure. Filterable, exportable as CSV. |
| **Pipeline** | How the data was built, and the AI-assisted extraction of BASS-II endings from the NASA report, with examples and the checks that were run on it. |
| **About** | Team, how AI was used, Earth benefits, limitations, sources. |

## Rules the code enforces

0. **NASA sources only.** Every value comes from NASA: the PSI tables, NASA technical reports
   on NTRS, and NASA imagery (images.nasa.gov, svs.gsfc.nasa.gov). Other sources may only be
   mentioned to point out what NASA lacks. `npm test` fails if a non-NASA source is cited.
1. **Nothing is invented.** A blank cell is `null`, never `0`. Lists and ranges stay lists
   and ranges (ACME BRE's "21; 26.5; 40" is not collapsed to 40).
2. **No partial-gravity values are computed.** PSI has 0 g and, for SAFFIRE-II, 1 g. Moon
   and Mars are selectable to show that PSI has no data there; the only numbers shown at
   those levels are measured results from cited NASA reports, labelled as outside PSI.
3. **Recorded values only.** The Lab cannot be set to a condition NASA did not test.
4. **Anomalies are shown, not fixed.** 201 data-quality flags across 33 types, each with the
   original value and the reason. Scientific markers (e.g. cool-flame territory) are kept
   separate from data errors.
5. **The droplet model states its limits.** Logistic regression on 261 FLEX tests,
   validated on held-out *conditions* (grouped 5-fold): 82% accuracy vs a 69%
   always-extinction baseline, balanced accuracy 76%, AUC 0.87. It is hidden when the
   input combination is far from every real test.

## BASS-II outcomes

The BASS-II experimental table records conditions but not how each test ended. The
flow directions for 126 tests and observations for 125 of them (the report gives none for
O6) were transcribed (with AI assistance)
from the test matrices in NASA/TM-20210011385, Appendix A, pp. 103-113, into
`data_raw/BASS-II_AppendixA_transcribed.csv`. Every record cites its page. The summary
category is this project's reading; NASA's words are shown verbatim beside it. The three
2016 tests (O20-O22) are not in the report. Checks: where the PSI table's own airflow cell
names the ending ("ext", "blowoff"), it agrees with the transcribed category on 17 of 18
tests (B14: brief ignition then extinction); a manual spot-check of 10 rows against the
PDF found all 10 matching, and abridged notes are marked with an ellipsis.

BASS-II airflow uses NASA's calibration: velocity (cm/s) = Air display × 1.0066.

## Known gaps

- All 14 investigations have a DOI (NASA PSI prefix 10.60555); four were found in DataCite and
  PSI-22's was read from its PSI page.
- Objectives text is collected only for PSI-25.
- Not in this dataset as PSI tables: SAME, DAFT-2, SLICE, other ACME experiments, FLEX-2
  per-test table, Saffire IV-VI (selected Saffire IV-VI and LUCI values appear on the
  Findings page as cited literature, never mixed into PSI counts).

Licence: MIT for the code (see LICENSE); NASA data and imagery as published by NASA. After the first
visit the site opens offline (service worker in public/sw.js).

Not affiliated with or endorsed by NASA. No NASA branding is used. A research summary,
not a material certification or a safety approval.


## Use of Super Intelligence (SI)

Declared as the NASA Space Apps rules require. The same text is on the site's About page and in
the `ai-disclosure` meta tag of `index.html`.

- **Code (SI-assisted):** the data pipeline (`scripts/`), the website (`src/`) and the tests were
  written with Claude Code (Anthropic) under the team's direction; the team reviewed and tested them.
- **Data (SI-assisted transcription):** `data_raw/BASS-II_AppendixA_transcribed.csv` holds the test
  observations of NASA/TM-20210011385, Appendix A, transcribed word for word with AI assistance,
  each with its report page; checked against the PSI table's own airflow cells (18 of 19 agree)
  and by a manual spot check of 10 rows against the PDF. Everything derived from it is labelled
  `NTRS_APPENDIX_TRANSCRIBED` and is hidden in the default strict PSI mode.
- **Source finding:** AI helped search and read NASA Technical Reports Server documents; every
  value used was checked in the document itself (document number and page are cited).
- **In the product:** the AI search runs the open model all-MiniLM-L6-v2 (Apache-2.0) in the
  browser. It only retrieves existing NASA-sourced text; it never generates answers or values.
- **Not SI-generated:** the 14 NASA PSI tables in `data_raw/` (byte-identical to NASA's files,
  see `SHA256SUMS.txt`) and the NASA photos in `public/media/`.
- No NASA logos, flags or mission identifiers are used or modified in any generated content.
