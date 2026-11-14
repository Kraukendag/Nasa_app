# =============================================================================
#  PIPELINE CHECKS
# =============================================================================
#  Rebuilds the data, then checks that what the website shows still agrees
#  with the raw NASA files. Run it after any change to the pipeline:
#
#      python3 scripts/test_pipeline.py
#
#  It prints one line per check and exits with an error if any fails, so the
#  GitHub workflow refuses to publish a site whose numbers have drifted.
#  Python standard library only.
# =============================================================================

import csv
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
RESULTS = []


def check(name):
    """Decorator: run a check, record pass/fail with its message."""
    def wrap(fn):
        try:
            fn()
            RESULTS.append((True, name, ""))
        except AssertionError as e:
            RESULTS.append((False, name, str(e)))
        return fn
    return wrap


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


# ---- Rebuild from the raw files first, so we test the current code --------
subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_data.py")],
               check=True, stdout=subprocess.DEVNULL)
tests, invs, mats = load("tests.json"), load("investigations.json"), load("materials.json")
findings, lit, flex = load("findings.json"), load("literature.json"), load("flex_model.json")
by_id = {(t["psi_id"], t["test_number"]): t for t in tests}


@check("every row is accounted for: 1,450 = 1,431 tests + 15 footnotes + 4 flow-vis")
def _():
    notes = sum(t["is_note"] for t in tests)
    vis = sum(t["is_flow_vis"] for t in tests)
    assert len(tests) == 1450, f"{len(tests)} rows"
    assert (len(tests) - notes - vis, notes, vis) == (1431, 15, 4), (notes, vis)


@check("raw cells are kept exactly; a blank cell is never turned into 0")
def _():
    for t in tests:
        for k, v in t["raw"].items():
            assert v is None or v.strip() != "", f"{t['id']} {k}: empty string instead of null"
    for t in tests:
        if t["psi_id"] == "PSI-25" and not t["is_note"]:
            raw = (t["raw"].get("Calibrated  initial O2 % by vol") or "").strip()
            o2 = t["normalized"]["o2_percent"]
            if o2 is not None:
                assert re.sub(r"[^0-9.]", "", raw) and abs(float(re.sub(r"[^0-9.]", "", raw)) - o2) < 1e-9, \
                    f"{t['test_number']}: o2 {o2} vs raw '{raw}'"


@check("BASS-II endings (125) quote the transcription word for word, with a page in 103-113")
def _():
    with open(os.path.join(ROOT, "data_raw", "BASS-II_AppendixA_transcribed.csv"), encoding="utf-8-sig") as f:
        rows = {r["Test #"].strip(): r for r in csv.DictReader(f)}
    n = 0
    for t in tests:
        text = t["normalized"].get("outcome_text")
        source = t["normalized"].get("outcome_source") or ""
        if t["psi_id"] != "PSI-25" or not text:
            continue
        if not source.startswith("NASA/TM-20210011385"):
            # O22 (2016) is not in the report; its ending is read from the PSI
            # table's own cell and must say so.
            assert source == "Air/Fan display cells of the PSI-25 table", (t["test_number"], source)
            continue
        n += 1
        src = rows.get(t["test_number"])
        assert src, f"{t['test_number']} not in the transcription"
        assert " ".join(src["Test observations (matrix)"].split()) == " ".join(text.split()), t["test_number"]
        page = int(re.search(r"p\. (\d+)", t["normalized"]["outcome_source"]).group(1))
        assert 103 <= page <= 113 and str(page) == src["Report page"].strip(), t["test_number"]
    # 126 tests are in the report's matrices; O6 has a flow direction there but
    # no observation, so 125 endings.
    assert n == 125, f"{n} endings extracted from the report"


@check("cross-check against the PSI table's own airflow cells still holds")
def _():
    c = findings["cross_check"]
    assert c["checked"] >= 18 and c["agree"] >= c["checked"] - 1, c
    assert [d["test"] for d in c["disagree"]] == ["B14"], c["disagree"]


@check("headline numbers match the rows they come from")
def _():
    pmma = next(m for m in mats if m["id"] == "PMMA|solid")["lowest_sustained_o2"]
    t = by_id[("PSI-25", pmma["test"])]
    assert t["normalized"]["material"] == "PMMA" and t["normalized"]["o2_percent"] == pmma["o2"], pmma
    assert t["normalized"]["outcome_class"] in {"extinguished_low_flow", "extinguished_flow_stopped",
                                                 "self_extinguished", "blowoff", "burned_entire", "burned_sustained"}
    solids = [x["normalized"]["o2_percent"] for x in tests
              if x["normalized"]["fuel_state"] == "solid" and x["normalized"]["o2_percent"] is not None
              and "implausible_o2_reading" not in x["anomalies"]]
    assert max(solids) == findings["max_solid_o2_percent"] == 22.2, max(solids)
    silicone = [x for x in tests if x["psi_id"] == "PSI-99" and x["normalized"]["material"] == "Silicone"]
    assert len(silicone) == 4, len(silicone)


@check("DOIs: every investigation has one, and each is well formed")
def _():
    missing = [i["psi_id"] for i in invs if not i["doi"]]
    assert missing == [], missing
    for i in invs:
        if i["doi"]:
            assert re.fullmatch(r"10\.60555/[0-9a-z]{4}-[0-9a-z]{4}", i["doi"]), i["doi"]


@check("every citation and cross-reference resolves")
def _():
    sources = lit["sources"]
    qids = {q["id"] for q in findings["research_questions"]}
    psi = {i["psi_id"] for i in invs}
    for p in lit["points"]:
        assert p["source"] in sources, p
    for k in findings["key_insights"]:
        assert all(l in sources for l in k["lit"]) and (k["psi_id"] is None or k["psi_id"] in psi), k["id"]
    for r in findings["recommendations"]:
        for e in r["evidence"]:
            assert (e["lit"] is None or e["lit"] in sources) and (e["psi"] is None or e["psi"] in psi), r["id"]
        assert all(q in qids for q in r["questions"]), r["id"]
    picks = findings["team_picks"]
    assert len(picks) == len(set(picks)) == 10 and all(q in qids for q in picks), picks


@check("bundled NASA photos exist for every image in src/media.ts")
def _():
    with open(os.path.join(ROOT, "src", "media.ts"), encoding="utf-8") as f:
        files = re.findall(r"file: '([^']+)'", f.read())
    assert files, "no images listed"
    for name in files:
        assert os.path.exists(os.path.join(ROOT, "public", "media", name)), name


@check("NASA sources only: every citation, DOI and image comes from a NASA host")
def _():
    nasa = re.compile(r"^https://([a-z0-9-]+\.)*nasa\.gov/")
    for k, src in lit["sources"].items():
        assert nasa.match(src["url"]), (k, src["url"])
    for i in invs:
        assert nasa.match(i["psi_url"]), i["psi_id"]
        # NASA PSI registers its DOIs under the 10.60555 prefix.
        assert i["doi"] is None or i["doi"].startswith("10.60555/"), i["doi"]
    with open(os.path.join(ROOT, "src", "media.ts"), encoding="utf-8") as f:
        media = f.read()
    hosts = set(re.findall(r"https://([a-z0-9.-]+)", media))
    assert hosts and all(h.endswith("nasa.gov") for h in hosts), hosts


@check("the FLEX model beats always guessing the common outcome")
def _():
    m = flex["metrics"]
    assert m["accuracy"] > m["baseline_accuracy"] and m["auc"] > 0.5, m


# ---- Report -----------------------------------------------------------------
for ok, name, msg in RESULTS:
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{'' if ok else '  ->  ' + msg}")
failed = sum(not ok for ok, _, _ in RESULTS)
print(f"\n{len(RESULTS) - failed} of {len(RESULTS)} checks passed.")
sys.exit(1 if failed else 0)
