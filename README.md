# Micro Flamma — Fire in Freefall

An interactive explorer for NASA's microgravity combustion research, built for the
NASA Space Apps Challenge.

Every number on the site comes from a NASA Physical Sciences Informatics (PSI)
experimental table. Nothing is estimated, interpolated, or filled in from memory.

---

## How the project is put together

There are two halves, and they never run at the same time.

```
data_raw/*.csv                  14 raw NASA tables (1,450 rows)
      |
      |   scripts/build_data.py     <- Python. You run this by hand, once.
      v
public/data/*.json              clean data the website reads
      |
      |   src/**                    <- React. This is the website.
      v
dist/                           the finished site, ready to host
```

The website never runs Python and never calls a server. It loads five JSON files
when it opens and then works entirely offline.

## Running it

```bash
npm install
```

```bash
npm run data
```

```bash
npm run dev
```

`npm run data` rebuilds the JSON from the CSVs. You only need it if the raw files
change. `npm run build` produces the hostable site in `dist/`.

## The three tabs

| Tab | What it is |
|---|---|
| **3D Match** | A match you can rotate and light, with a gravity switch. Shows the core idea in three seconds: gravity on gives a tall teardrop, gravity off gives a blue sphere. |
| **Experiment Lab** | Pick a material and conditions. The sidebar shows the real NASA tests nearest to your settings, with their measured values and DOIs. |
| **Data Library** | All 1,450 rows. Multi-word search, filter checkboxes, and a drawer showing any row exactly as NASA recorded it. |

## The rules the code follows

These are enforced in the code, not just written down:

1. **Nothing is invented.** An empty cell becomes `null`, never `0`. Null means
   "not recorded"; zero is a measurement.
2. **No partial gravity.** PSI has data at 0 g and 1 g and nothing between. The
   gravity control is two buttons with a locked, hatched band between them. No
   value is ever computed inside that band.
3. **Extrapolation is labelled.** No solid fuel was flight-tested above 22.2%
   oxygen. Above that the interface shows an `EXTRAPOLATED` badge rather than a
   confident-looking answer.
4. **Anomalies are surfaced, not fixed.** 234 flags across 22 types. Each one
   shows the original value, the corrected value, and the reason.
5. **The droplet model knows its limits.** A logistic regression fitted to the
   274 real FLEX rows (81% cross-validated accuracy). Outside the conditions FLEX
   tested, it refuses to predict.

## Data sources

14 PSI investigations: PSI-20, 22, 25, 26, 39, 47, 68, 69, 98, 99, 100, 101, 107, 159.
DOIs are listed on the About page. Five investigations have no DOI recorded yet and
are shown as such rather than guessed.

BASS-II airflow is converted from the instrument reading to cm/s using NASA's own
published calibration (`velocity = Air display x 1.0066`).

Not affiliated with or endorsed by NASA. No NASA branding is used. This is a
research summary, not a material certification or a safety approval.
