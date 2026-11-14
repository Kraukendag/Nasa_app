#!/usr/bin/env python3
# =============================================================================
#  MICRO FLAMMA  ·  build_data.py   (run this one)
# =============================================================================
#  Reads the 14 NASA PSI experimental tables in ./data_raw and writes clean
#  JSON to ./public/data for the website. Run it once, or whenever data_raw
#  changes:      python3 scripts/build_data.py
#
#      data_raw/*.csv ─► loaders.py ─► derive.py + flex_model.py ─► public/data/*.json
#
#  The rule that shapes everything: we never invent a number. Blank cells
#  become null; corrections and inferences keep the original and carry a flag.
#
#  Files in this folder:
#    loaders.py     one reader per investigation (parsing, cleaning, flags)
#    derive.py      material cards, investigation profiles, negative
#                   knowledge, coverage grid, open questions, search index
#    flex_model.py  the FLEX droplet outcome model and its honest metrics
#    literature.py  verified results from outside PSI (LUCI, Saffire IV-VI...)
#    research_questions.py  the team's open research questions
# =============================================================================

import json
import os
from collections import Counter

import derive
from flex_model import build_flex_model
from literature import build_literature
from loaders import LOADERS, OUTCOME_LABELS
from research_questions import build_research_questions
from recommendations import TEAM_PICKS, build_recommendations

OUT_DIR = "public/data"
EXPECTED_TOTAL_ROWS = 1450

ANOMALY_DESCRIPTIONS = {
    "sensor_failure": "B2: final O2 of 1.6% and no frames; the test matrix notes 'cable came loose'.",
    "implausible_o2_reading": "Final O2 far outside the initial value for one burn: a sensor fault or a reading not taken. Excluded from statistics.",
    "baseline_co_offset": "Carbon monoxide recorded below zero: the sensor's zero point sits below zero.",
    "raw_percent_typo": "Oxygen written as 3400% or 2100%; read as 34% and 21%.",
    "raw_thickness_typo": "Thickness written as '037 mm'; read as 0.37 mm.",
    "zero_pressure_outlier": "Ambient pressure recorded as 0.0 mmHg, which is a vacuum.",
    "material_filled_forward": "Material cell was blank, meaning 'same as the row above'.",
    "material_inferred": "Material not written in this row; inferred from the same task's other rows.",
    "material_not_stated": "Neither the table nor NASA's test matrix names this sample's material.",
    "embedded_footnote": "Row is a footnote explaining the table, not a test.",
    "pre_test_flow_visualisation": "Pre-test airflow check, not a burn.",
    "duplicate_row": "This row repeats an earlier row in the same file.",
    "duplicate_row_block": "Part of a block of rows duplicated in the source file.",
    "maintenance_row": "A hardware maintenance log entry, not a test.",
    "date_year_typo": "The year in this date is inconsistent with its neighbours.",
    "date_punctuation_typo": "Stray punctuation inside the date.",
    "negative_flow_reading": "Air flow recorded as negative: instrument drift near zero.",
    "telemetry_loss": "Time column records a signal loss instead of a clock time.",
    "time_format_variant": "Time written with dots instead of colons.",
    "zero_fuel_rate": "Fuel rate recorded as zero.",
    "non_numeric_frame_count": "Frame count holds a word such as 'none' or 'video'.",
    "sensor_over_range": "A gas reading exceeded its measurable range ('OR').",
    "spreadsheet_division_error": "Cell holds a spreadsheet #DIV/0! error.",
    "not_applicable_cell": "Cell recorded as not applicable.",
    "unreadable_cell": "Cell contains bytes that could not be decoded.",
    "approximate_value": "Value written as approximate ('~').",
    "zero_ignition_day": "A full test day on which no flame ignited.",
    "flow_recorded_as_fan_setting_only": "Only a fan setting was logged, so no calibrated airspeed is given.",
    "geometry_from_sample_group": "Shape taken from other rows with the same sample number.",
    "o2_recorded_as_range": "Oxygen written as a range; the lower end is used for filtering.",
    "unit_inconsistency_across_tables": "SIBAL thickness is 0.37 cm / 0.33 cm in SAFFIRE-I/III but 0.37 mm in SAFFIRE-II.",
    "dimension_order_inconsistency": "Sample length and width are swapped between SAFFIRE-I and SAFFIRE-III.",
    "header_unit_mismatch": "Column says 'Spread Length' but holds rates in mm/s.",
    "inconsistent_ignition_record": "Hot ignition recorded 'No' yet a burn time and termination are recorded.",
}
SCIENCE_FLAG_DESCRIPTIONS = {
    "cool_flame_territory": "Heptane droplet above 2.4 mm: conditions where FLEX found invisible cool-flame burning can continue after visible extinction. A territory marker, not an observation recorded for this test.",
    "cool_flame_mentioned_in_comment_only": "The comment describes a cool flame but the 'Cool flame?' column is empty, so it is not counted as recorded.",
}


def build_search_text(t):
    """One lowercase string per row, so multi-word search is a substring test."""
    n = t["normalized"]
    parts = [t["psi_id"], t["acronym"], t["test_number"] or ""]
    for key in ("material", "material_raw", "substance", "fuel_state", "geometry", "outcome",
                "outcome_text", "flow_direction", "pci_regime", "principal_investigator",
                "description", "comments", "note_text", "date", "o2_display", "outcome_1g"):
        if n.get(key):
            parts.append(str(n[key]))
    for key in ("o2_percent", "pressure_atm", "flow_cm_s", "droplet_d0_mm", "rt_r0", "burn_time_s"):
        if n.get(key) is not None:
            parts.append(f"{n[key]:g}")
    parts += t["anomalies"] + t["science_flags"]
    return " ".join(parts).lower()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("=" * 72)
    print("  MICRO FLAMMA -- building data from NASA PSI experimental tables")
    print("=" * 72)

    per_inv, all_tests = {}, []
    for psi_id, loader in LOADERS:
        records = loader()
        per_inv[psi_id] = records
        all_tests.extend(records)
        notes = sum(r["is_note"] for r in records)
        vis = sum(r["is_flow_vis"] for r in records)
        extra = ", ".join(x for x in (f"{notes} note" if notes else "", f"{vis} flow-vis" if vis else "") if x)
        print(f"  {psi_id:8} {records[0]['acronym']:13} {len(records):4d} rows" + (f"  ({extra})" if extra else ""))

    # Unique ids: a few files repeat test numbers; React needs unique keys.
    seen = Counter()
    for t in all_tests:
        seen[t["id"]] += 1
        if seen[t["id"]] > 1:
            t["duplicate_of"] = t["id"]
            t["id"] = f"{t['id']}#r{t['row_index']}"
    for t in all_tests:
        t["search_text"] = build_search_text(t)

    total = len(all_tests)
    notes = sum(t["is_note"] for t in all_tests)
    vis = sum(t["is_flow_vis"] for t in all_tests)
    print("-" * 72)
    print(f"  Total rows {total}  =  {total - notes - vis} tests + {notes} footnotes + {vis} flow-vis")
    print(f"  Expected {EXPECTED_TOTAL_ROWS} -> {'OK' if total == EXPECTED_TOTAL_ROWS else 'MISMATCH'}")
    assert len({t['id'] for t in all_tests}) == total, "ids are not unique"

    real = [t for t in all_tests if not t["is_note"] and not t["is_flow_vis"]]
    solid_o2 = [t["normalized"]["o2_percent"] for t in real
                if t["normalized"]["fuel_state"] == "solid" and t["normalized"]["o2_percent"] is not None
                and "implausible_o2_reading" not in t["anomalies"]]
    max_solid_o2 = max(solid_o2)

    stats = compute_stats(real, per_inv, max_solid_o2)
    investigations = derive.build_investigations(per_inv)
    doi_of = {i["psi_id"]: i["doi"] for i in investigations}
    materials = derive.build_materials(all_tests)
    coverage = derive.build_coverage(all_tests)
    cool_rows = [t for t in real if t["normalized"].get("cool_flame") is True]
    cfig_cool = [t["test_number"] for t in cool_rows]
    # Describe the conditions FROM the rows, not from memory.
    cool_fuels = sorted({t["normalized"]["material"] for t in cool_rows})
    cool_kpa = sorted({round(t["normalized"]["pressure_kpa"]) for t in cool_rows if t["normalized"].get("pressure_kpa")})
    cool_o2 = [t["normalized"]["o2_percent"] for t in cool_rows if t["normalized"].get("o2_percent") is not None]
    cool_text = (f"CFI-G logged {len(cool_rows)} cool flames (regimes "
                 f"{', '.join(sorted({t['normalized']['pci_regime'] for t in cool_rows if t['normalized'].get('pci_regime')}))}), "
                 f"all in {', '.join(cool_fuels)} at {', '.join(f'{k} kPa' for k in cool_kpa)} and "
                 f"{min(cool_o2):.1f}-{max(cool_o2):.1f}% oxygen. A cool flame burns at low temperature "
                 f"and gives off little light.") if cool_rows else "No cool flames recorded."

    findings = {
        "max_solid_o2_percent": max_solid_o2,
        "moonbase": {
            "o2_percent": 30.0, "pressure_psi": 10.2, "pressure_kpa": 70.3, "pressure_atm": 0.69,
            "note": (f"A planned lunar habitat runs at about 30% oxygen and 10.2 psi (E3: challenge text). "
                     f"No solid fuel in this dataset was tested above {max_solid_o2:g}% oxygen, and no "
                     f"solid-fuel table here records pressure at all."),
        },
        "gravity": {
            "tested": ["0g", "1g"], "untested_zone": {"min": 0.01, "max": 0.99},
            "moon_g": 0.16, "mars_g": 0.38,
            "note": ("This dataset (NASA PSI) contains no partial-gravity combustion data. Partial-gravity "
                     "flame tests have been run on parabolic flights and a spinning suborbital rocket (LUCI), "
                     "but their results are not in PSI. The idea that flame spread peaks near lunar gravity "
                     "is a hypothesis here; NASA's FM2 experiment is designed to test it (E3)."),
        },
        "key_insights": derive.build_key_insights(stats),
        "surprises": [
            {"id": "silicone_reversal", "title": "Silicone burns on Earth but barely in space",
             "text": ("In SAFFIRE-II, all four silicone samples left about 0 cm burned in microgravity. In "
                      "normal gravity, samples 2-1 and 2-4 burned completely and 2-2 burned 7.6 cm; only the "
                      "thickest (2-3, 1.03 mm) failed in both."),
             "evidence_class": "E1",
             "evidence": {"psi_id": "PSI-99", "tests": ["2-1", "2-2", "2-3", "2-4"], "doi": "10.60555/2chp-m469"}},
            {"id": "cool_flames_recorded", "title": f"{len(cfig_cool)} cool flames recorded in CFI-G",
             "text": cool_text,
             "evidence_class": "E1",
             "evidence": {"psi_id": "PSI-159", "tests": cfig_cool, "doi": "10.60555/cyt1-kh64"}},
            {"id": "invisible_cool_flames", "title": "FLEX: flames that keep burning after they disappear",
             "text": ("FLEX researchers reported that large heptane droplets kept burning as invisible cool "
                      "flames after visible extinction. The FLEX table records visible extinction only, so "
                      "this app marks heptane droplets above 2.4 mm as cool-flame territory rather than "
                      "counting them as observed cool flames."),
             "evidence_class": "E2/E3",
             "evidence": {"psi_id": "PSI-69", "doi": "10.60555/mbq8-0451"}},
            {"id": "mixed_material_selectivity", "title": "One material burned out while its neighbour never lit",
             "text": "SAFFIRE-II sample 2-7: the PMMA portion was completely consumed while the adjacent Nomex was never ignited.",
             "evidence_class": "E1",
             "evidence": {"psi_id": "PSI-99", "tests": ["2-7"], "doi": "10.60555/2chp-m469"}},
        ],
        "gaps": [
            "This dataset has no combustion data at any gravity between 0 g and 1 g. Partial-gravity flame "
            "tests exist from parabolic flights and LUCI, but not in PSI.",
            f"No solid fuel in the PSI tables was tested above {max_solid_o2:g}% oxygen, while a lunar habitat "
            "is planned at about 30%. Saffire V and VI (outside PSI) did fly at 26.2-31.0% O2 and 54-71 kPa; see "
            "Findings > Beyond PSI.",
            "No solid-fuel table in this dataset records chamber pressure, so no reduced-pressure solid test "
            "is recorded.",
            "All SAME-R smoke data comes from heated, non-flaming samples: there are no measurements of smoke "
            "from genuine flaming fires.",
            "No tests here cover electronics, wiring insulation, foams or packaging.",
            "BASS (PSI-26) records which samples were burned, but not the conditions or how they ended.",
            "SAFFIRE-III records its two burns' conditions but no burn length, spread rate or burn time.",
        ],
        "negative_knowledge": derive.build_negative_knowledge(all_tests, doi_of),
        "coverage": coverage,
        "research_questions": build_research_questions(stats),
        "team_picks": TEAM_PICKS,
        # BASS-II tests whose NASA notes mention flamelets (quoted, with page).
        "flamelets": [{"test": t["test_number"], "text": t["normalized"]["outcome_text"],
                       "source": t["normalized"]["outcome_source"]}
                      for t in all_tests if t["psi_id"] == "PSI-25"
                      and "flamelet" in (t["normalized"].get("outcome_text") or "").lower()],
        "recommendations": build_recommendations(stats),
        "spot_check": {
            "checked": ["B18", "B21", "B9", "P22a", "P5", "M2", "M5", "T27", "T29", "T7"],
            "result": "10 of 10 match the report pages in content. One (M5) was a shortened quote without "
                      "ellipses; it and three other shortened notes (M10, M16, T1) are now marked with '…'.",
            "pages": [104, 107, 109, 113],
        },
        "cross_check": bass2_cross_check(all_tests),
        "bass2_counts": bass2_counts(all_tests),
        "not_included": derive.NOT_INCLUDED,
        "anomaly_summary": dict(Counter(a for t in all_tests for a in t["anomalies"])),
        "science_flag_summary": dict(Counter(f for t in all_tests for f in t["science_flags"])),
        "anomaly_descriptions": ANOMALY_DESCRIPTIONS,
        "science_flag_descriptions": SCIENCE_FLAG_DESCRIPTIONS,
        "outcome_labels": OUTCOME_LABELS,
        "transcription_note": ("BASS-II outcomes and flow directions were transcribed from the test "
                               "matrices in NASA/TM-20210011385 Appendix A (pp. 103-113) with AI assistance. "
                               "Each record cites its page so it can be checked; the summary category is "
                               "this project's reading of NASA's words, which are shown verbatim."),
    }
    literature = build_literature()
    attach_material_context(materials, real, literature)
    flex = build_flex_model(per_inv["PSI-69"])

    outputs = {"investigations.json": investigations, "tests.json": all_tests,
               "materials.json": materials, "findings.json": findings,
               "flex_model.json": flex, "literature.json": literature}
    stale = os.path.join(OUT_DIR, "knowledge.json")       # "Ask the data" was removed
    if os.path.exists(stale):
        os.remove(stale)
    print("-" * 72)
    for name, payload in outputs.items():
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        print(f"  wrote {path:36} {os.path.getsize(path) / 1024:8.1f} KB")

    m = flex["metrics"]
    print("-" * 72)
    print(f"  FLEX model   {flex['n_training_rows']} rows, {flex['n_condition_groups']} condition groups; "
          f"accuracy {m['accuracy']:.1%} vs baseline {m['baseline_accuracy']:.1%}; "
          f"balanced {m['balanced_accuracy']:.1%}; AUC {m['auc']:.2f}")
    with_outcome = sum(1 for t in real if t["normalized"].get("outcome_class"))
    print(f"  Tests with a recorded outcome: {with_outcome} of {len(real)}")
    print(f"  Material cards: {len(materials)}   Negative-knowledge entries: {len(findings['negative_knowledge'])}"
          f"   Research questions: {len(findings['research_questions'])}")
    print(f"  Data-quality flags: {sum(findings['anomaly_summary'].values())} across "
          f"{len(findings['anomaly_summary'])} types; science flags: {sum(findings['science_flag_summary'].values())}")
    print(f"  Highest solid-fuel oxygen in this dataset: {max_solid_o2:g}%")
    print("=" * 72)


def bass2_counts(all_tests):
    """The BASS-II numbers every page quotes, counted once here.

    observations     tests whose report note was transcribed (word for word)
    endings_report   of those, how many the rules could give an ending category
    endings_table    endings read from the PSI table's own airflow cells
                     (O22, a 2016 test that is not in the report)
    by_class         every ending category over ALL BASS-II tests
    """
    rows = [t for t in all_tests if t["psi_id"] == "PSI-25" and not t["is_note"]]
    rep = [t for t in rows if (t["normalized"].get("outcome_source") or "").startswith("NASA/TM-20210011385")]
    obs = [t for t in rep if t["normalized"].get("outcome_text")]
    rep_end = [t for t in obs if t["normalized"]["outcome_class"]]
    tab_end = [t for t in rows if t["normalized"]["outcome_class"] and t not in rep]
    by_class = Counter(t["normalized"]["outcome_class"] for t in rows if t["normalized"]["outcome_class"])
    by_class_report = Counter(t["normalized"]["outcome_class"] for t in rep_end)
    return {
        "tests_in_table": len(rows),
        "transcribed": len(rep),
        "observations": len(obs),
        "observation_missing": [t["test_number"] for t in rep if not t["normalized"].get("outcome_text")],
        "endings_report": len(rep_end),
        "no_category": sorted(t["test_number"] for t in obs if not t["normalized"]["outcome_class"]),
        "endings_table": [t["test_number"] for t in tab_end],
        "endings_total": sum(by_class.values()),
        "by_class": dict(by_class),
        "by_class_report": dict(by_class_report),
    }


def bass2_cross_check(all_tests):
    """Check the AI-assisted transcription against an independent source.

    Some BASS-II rows in the PSI table write how the run ended in their own
    "Air display" cell ("... down to ext", "10 blowoff"). Those words were typed
    by the crew support team, not taken from the report, so they can test the
    category we derived from the report's matrix notes:
        cell mentions "blowoff"  ->  category must be blowoff
        cell mentions "ext"      ->  category must be one of the "went out" kinds
    """
    went_out = {"extinguished_low_flow", "extinguished_flow_stopped", "extinguished", "self_extinguished"}
    checked, disagree = [], []
    for t in all_tests:
        if t["psi_id"] != "PSI-25" or t["is_note"]:
            continue
        cell = (t["raw"].get("Air display") or "").lower()
        cls = t["normalized"]["outcome_class"]
        if "blowoff" in cell:
            expected = {"blowoff"}
        elif "ext" in cell:
            expected = went_out
        else:
            continue
        checked.append(t["test_number"])
        if cls not in expected:
            disagree.append({"test": t["test_number"], "cell": t["raw"].get("Air display"),
                             "category": cls, "report": t["normalized"]["outcome_text"]})
    return {"checked": len(checked), "agree": len(checked) - len(disagree), "disagree": disagree,
            "rule": "PSI table 'Air display' cell says 'blowoff' or 'ext'; the category from the report must say the same."}


# Endings that prove a flame was ESTABLISHED before it ended. The generic
# "extinguished" class is left out on purpose: NASA's note for it is often
# "Extinguished quickly", which does not show a sustained flame.
SUSTAINED = {"extinguished_low_flow", "extinguished_flow_stopped", "self_extinguished",
             "blowoff", "burned_entire", "burned_sustained"}


def compute_stats(real, per_inv, max_solid_o2):
    """Every number quoted in the insights and research questions, computed
    here from the rows so the prose can never drift from the data."""
    import statistics as st
    # ONE COUNTING RULE (the reviewer found the same count differing between
    # pages): endings are counted over EVERY BASS-II test with an ending.
    # A doubtful oxygen reading does not change how a test ended, so those
    # rows are left out only of oxygen-based numbers (b2 below), never of
    # ending counts (b2_all).
    b2_all = [t for t in real if t["psi_id"] == "PSI-25"]
    b2 = [t for t in b2_all if "implausible_o2_reading" not in t["anomalies"]]
    n = lambda t: t["normalized"]
    pmma_ok = sorted((n(t)["o2_percent"], t["test_number"]) for t in b2
                     if n(t)["material"] == "PMMA" and n(t)["outcome_class"] in SUSTAINED)
    pmma_fail = sorted(n(t)["o2_percent"] for t in b2 if n(t)["material"] == "PMMA"
                       and n(t)["outcome_class"] in ("no_sustained_flame", "no_ignition")
                       and n(t)["o2_percent"] < pmma_ok[0][0])
    cls = lambda c: [t for t in b2_all if n(t)["outcome_class"] == c]
    drops = [n(t)["o2_percent"] - n(t)["o2_final_percent"] for t in b2 if n(t)["o2_final_percent"] is not None]
    co = max((n(t)["co_final_ppm"], t["test_number"]) for t in b2 if n(t)["co_final_ppm"] is not None)
    fx = [t for t in real if t["psi_id"] == "PSI-69"]
    ext = [n(t)["extinction_d_mm"] for t in fx if n(t)["extinction_d_mm"]]
    kpa = [n(t)["pressure_kpa"] for t in fx if n(t)["pressure_kpa"]]
    def ext_share(rows):
        rows = [t for t in rows if n(t)["outcome_class"]]
        return 100 * sum(n(t)["outcome_class"] == "Extinction" for t in rows) / max(1, len(rows))
    co2 = [t for t in fx if n(t)["co2_mole_fraction"]]
    he = [t for t in fx if n(t)["he_mole_fraction"]]
    neither = [t for t in fx if not n(t)["co2_mole_fraction"] and not n(t)["he_mole_fraction"]]
    cfig = [t for t in real if t["psi_id"] == "PSI-159"]
    butane = [t for t in cfig if n(t)["material"] == "Butane (30%)"]
    cool = [t for t in cfig if n(t).get("cool_flame") is True]
    samer = [t for t in real if t["psi_id"] == "PSI-101"]
    s1 = {t["test_number"]: n(t)["burn_time_s"] for t in real if t["psi_id"] == "PSI-98"}
    watts = sorted({n(t)["ignition_power_w"] for t in real if t["psi_id"] in ("PSI-98", "PSI-99") and n(t).get("ignition_power_w")})
    selfx = [t["test_number"] for t in cls("self_extinguished")]
    widths = sorted({n(t)["width_mm"] for t in b2 if n(t)["width_mm"]})
    return {
        "max_solid_o2": max_solid_o2,
        "pmma_min_o2": pmma_ok[0][0], "pmma_min_test": pmma_ok[0][1],
        "pmma_fail_range": f"{pmma_fail[0]:g}-{pmma_fail[-1]:g}% O2",
        "nomex_fail": sum(1 for t in b2 if n(t)["material"] == "Nomex" and n(t)["outcome_class"] == "no_sustained_flame"),
        "flow_stopped": len(cls("extinguished_flow_stopped")), "low_flow": len(cls("extinguished_low_flow")),
        "blowoff": len(cls("blowoff")), "self_ext_n": len(selfx), "self_ext_ids": ", ".join(selfx),
        "o2_drop_median": st.median(drops), "o2_drop_max": max(drops),
        "co_max": co[0], "co_max_test": co[1],
        "stagnation_n": sum(1 for t in b2 if n(t)["flow_direction"] == "stagnation"),
        "bass2_widths": " and ".join(f"{w / 10:g} cm" for w in widths),
        "flex_n": len(fx), "flex_co2_n": len(co2), "flex_he_n": len(he),
        "flex_kpa_min": min(kpa), "flex_kpa_max": max(kpa),
        "dext_min": min(ext), "dext_max": max(ext), "dext_median": st.median(ext),
        "ext_co2": ext_share(co2), "ext_he": ext_share(he), "ext_none": ext_share(neither),
        "territory_n": sum(1 for t in fx if "cool_flame_territory" in t["science_flags"]),
        "cfig_n": len(cfig), "butane_total": len(butane),
        "butane_fail": sum(1 for t in butane if n(t)["outcome_class"] == "no_ignition_gas"),
        "cool_n": len(cool), "cool_fuel": ", ".join(sorted({n(t)["material"] for t in cool})),
        "cool_kpa": ", ".join(sorted({f"{n(t)['pressure_kpa']:.0f}" for t in cool})),
        "cool_o2": f"{min(n(t)['o2_percent'] for t in cool):.1f}-{max(n(t)['o2_percent'] for t in cool):.1f}%",
        "samer_n": len(samer), "rt_min": min(n(t)["rt_r0"] for t in samer), "rt_max": max(n(t)["rt_r0"] for t in samer),
        "aging_max": max(n(t)["net_aging_time_s"] or 0 for t in samer),
        "saffire1_s1": s1.get("S1"), "saffire1_s2": s1.get("S2"),
        "saffire_w": ", ".join(f"{w:g}" for w in watts),
        "daft_n": sum(1 for t in real if t["psi_id"] == "PSI-47"),
        "co_over_range": sum(1 for t in b2 if "sensor_over_range" in t["anomalies"]),
        "flamelet_tests": " and ".join(t["test_number"] for t in b2
                                       if "flamelet" in (n(t).get("outcome_text") or "").lower()),
        "bass_n": sum(1 for t in real if t["psi_id"] == "PSI-26"),
    }


def attach_material_context(materials, real, literature):
    """Extra evidence on the material cards: the lowest oxygen at which a
    flame was sustained in BASS-II, and verified literature rows."""
    n = lambda t: t["normalized"]
    b2 = [t for t in real if t["psi_id"] == "PSI-25" and "implausible_o2_reading" not in t["anomalies"]]
    lit_for = {
        "PMMA": {"points": [p for p in literature["points"] if p["material"] == "PMMA"],
                 "saffire": [r for r in literature["saffire_iv_vi"] if "PMMA" in r["material"]]},
        "SIBAL": {"points": [p for p in literature["points"] if p["material"] == "SIBAL"],
                  "saffire": [r for r in literature["saffire_iv_vi"] if "SIBAL" in r["material"]]},
    }
    for m in materials:
        if m["fuel_state"] != "solid":
            continue
        ok = sorted((n(t)["o2_percent"], t["test_number"]) for t in b2
                    if n(t)["material"] == m["name"] and n(t)["outcome_class"] in SUSTAINED)
        bad = sorted((n(t)["o2_percent"], t["test_number"]) for t in b2
                     if n(t)["material"] == m["name"] and n(t)["outcome_class"] in ("no_sustained_flame", "no_ignition"))
        m["lowest_sustained_o2"] = {"o2": ok[0][0], "test": ok[0][1]} if ok else None
        m["failed_attempts"] = [{"o2": o, "test": t} for o, t in bad]
        m["literature"] = lit_for.get(m["name"])
        if m["name"] == "Silicone":
            m["caveat"] = "Four samples, all near the oxygen limit (21.5-22.1% O2)."


if __name__ == "__main__":
    main()
