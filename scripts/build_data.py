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
# =============================================================================

import json
import os
from collections import Counter

import derive
from flex_model import build_flex_model
from loaders import LOADERS, OUTCOME_LABELS

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
        "key_insights": derive.build_key_insights(all_tests, max_solid_o2),
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
             "evidence": {"psi_id": "PSI-159", "tests": cfig_cool, "doi": None}},
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
            f"No solid fuel in this dataset was tested above {max_solid_o2:g}% oxygen, while a lunar habitat "
            "is planned at about 30%. Later Saffire flights (IV-VI) studied other atmospheres; their tables are "
            "not included here.",
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
    knowledge = derive.build_knowledge(investigations, materials, findings)
    flex = build_flex_model(per_inv["PSI-69"])

    outputs = {"investigations.json": investigations, "tests.json": all_tests,
               "materials.json": materials, "findings.json": findings,
               "flex_model.json": flex, "knowledge.json": knowledge}
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
          f"   Open questions: {len(coverage['questions'])}")
    print(f"  Data-quality flags: {sum(findings['anomaly_summary'].values())} across "
          f"{len(findings['anomaly_summary'])} types; science flags: {sum(findings['science_flag_summary'].values())}")
    print(f"  Highest solid-fuel oxygen in this dataset: {max_solid_o2:g}%")
    print("=" * 72)


if __name__ == "__main__":
    main()
