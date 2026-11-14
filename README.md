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
      │     │                       knowledge, coverage grid, open questions, search index
      │     └─ flex_model.py        FLEX droplet outcome model + honest metrics
      ▼
public/data/*.json   (tests, investigations, materials, findings, flex_model, knowledge)
      │
      │   src/**                  ← React + TypeScript. The website.
      ▼
dist/                the finished static site
```

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

## The tabs

| Tab | What it is |
|---|---|
| **3D Match** | A match you can rotate and light, with a gravity switch, beside three data-backed key insights. |
| **Experiment Lab** | Choose what burns, which investigation, and the conditions. **Every control offers only values NASA recorded**, and each choice narrows the others, so the matching set is always real tests of one material. The 3D model uses recorded sample geometry and airflow; the right panel counts what happened. |
| **Data Library** | *Records*: all 1,450 rows with search, filters, investigation-specific columns and a raw-row drawer. *Investigations*: profiles with variables, evidenced instruments and a two-way Compare. *Materials*: a card for every tested material with 0 g vs 1 g behaviour, mission environments and confidence. |
| **Insights** | Key findings, mission ranking with visible weights, negative knowledge, open questions generated from coverage gaps (exportable), and "Ask the data" keyword retrieval with citations. |
| **About** | Team, how AI was used, Earth benefits, limitations, references. |

## Rules the code enforces

1. **Nothing is invented.** A blank cell is `null`, never `0`. Lists and ranges stay lists
   and ranges (ACME BRE's "21; 26.5; 40" is not collapsed to 40).
2. **No partial gravity.** PSI has 0 g and, for SAFFIRE-II, 1 g. Moon and Mars are selectable
   only to show that there is no data; no value is computed for them.
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
observations and flow directions for 126 tests were transcribed (with AI assistance)
from the test matrices in NASA/TM-20210011385, Appendix A, pp. 103-113, into
`data_raw/BASS-II_AppendixA_transcribed.csv`. Every record cites its page. The summary
category is this project's reading; NASA's words are shown verbatim beside it. The three
2016 tests (O20-O22) are not in the report.

BASS-II airflow uses NASA's calibration: velocity (cm/s) = Air display × 1.0066.

## Known gaps

- Five investigations have no DOI recorded yet: PSI-22, 39, 47, 107, 159.
- Objectives text is collected only for PSI-25.
- Not in this dataset: SAME, DAFT-2, SLICE, other ACME experiments, FLEX-2 per-test table,
  Saffire IV-VI.

Not affiliated with or endorsed by NASA. No NASA branding is used. A research summary,
not a material certification or a safety approval.
