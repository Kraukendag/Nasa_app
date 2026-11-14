# =============================================================================
#  MICRO FLAMMA  ·  derive.py
# =============================================================================
#  Everything the website shows ABOUT the data, computed from the data:
#  material cards, investigation profiles, negative knowledge, the coverage
#  grid, ranking features and key insights.
#
#  Every count and range here is computed from the normalized test records.
#  Text that comes from outside the 14 tables is marked with an evidence class:
#    E1  NASA PSI-hosted material (experimental tables, record pages, reports)
#    E2  publications listed by a PSI record
#    E3  outside context (challenge page, mission pages) -- framing only
# =============================================================================

from collections import Counter, defaultdict

MOON = {"o2_percent": 30.0, "pressure_kpa": 70.3, "gravity_g": 0.16}

# ---------------------------------------------------------------------------
#  INVESTIGATION PROFILES
# ---------------------------------------------------------------------------
#  `sensors_evidenced` lists only instruments the TABLE ITSELF shows (a column,
#  or a note naming the instrument), with the basis spelled out. `objectives`
#  is verbatim PSI record text where the team has collected it; otherwise None
#  and the site says the text has not been collected yet.
# ---------------------------------------------------------------------------

INVESTIGATIONS = {
    "PSI-20": dict(acronym="ACME BRE", title="Burning Rate Emulator", doi="10.60555/vb93-3y72",
        hardware="CIR (ACME insert)", platform="ISS", fuel_state="gas", pillar="prevention",
        summary="Gaseous burner tests that emulate the burning of solid and liquid fuels, using "
                "methane and ethylene at oxygen levels from 21% to 40%.",
        sensors=[], sensors_basis="The table summarises daily results; it names no instruments."),
    "PSI-22": dict(acronym="ACME E-FIELD",
        title="Electric-Field Effects on Laminar Diffusion Flames (ACME E-FIELD Flames)", doi="10.60555/se5a-8c73",
        objectives=("The objective of this investigation is to better understand the relationship between electric "
                    "field voltage and chemi-ion current, analyze the dynamic response of flames to electric field "
                    "changes, evaluate soot formation, and characterize stabilized near-limit lifted flames."),
        hardware="CIR (ACME insert)", platform="ISS", fuel_state="gas", pillar="prevention",
        summary="Applies a high-voltage electric field to microgravity flames. The ion wind mimics some "
                "effects of gravity, but this is NOT partial-gravity data.",
        sensors=[], sensors_basis="Mesh polarity is recorded (the field electrode), not a sensor."),
    "PSI-25": dict(acronym="BASS-II", title="Burning and Suppression of Solids II", doi="10.60555/4qc4-de67",
        hardware="MSG (fan-driven flow duct)", platform="ISS", fuel_state="solid", pillar="suppression",
        summary="129 solid-fuel tests: PMMA rods, films, slabs and spheres, SIBAL fabric, Nomex and a "
                "candle, at 13.6-22.2% oxygen in low-speed forced flow. Outcomes are transcribed from "
                "the BASS-II Summary Report.",
        objectives=("BASS-II results contribute to the combustion computational models used in the design "
                    "of fire detection and suppression systems in microgravity and on Earth. Objectives "
                    "Include: 1) Study the ignition, flame growth, flame spread, and extinction limits for "
                    "solid fuels burning in low-velocity forced flows in microgravity. 2) Begin to bridge the "
                    "gap between the normal gravity NASA-STD-6001 Test #1 method, ground-based microgravity "
                    "tests, and actual material flammability in microgravity. 3) Provide SoFIE PIs with "
                    "preliminary data to refine Science Requirements. 4) Practical, realistic (thicker) fuels "
                    "in typical geometries will be examined, including slabs, cylinders, and spherical "
                    "sections. The primary variables include: Forced flow velocity (speed and direction); "
                    "Ambient oxygen concentration (via working volume nitrogen vitiation); Sample geometry "
                    "(rods, spherical section, slabs, films, and fabric sheets)"),
        sensors=["Radiometer", "O₂ sensor", "CO₂ sensor", "CO sensor", "Still camera",
                 "Anemometer (Air display)", "Combustion products analyzer (CSA-CP)", "CO₂ monitor (CDM)"],
        sensors_basis="Columns for radiometer gain, calibrated O2/CO2/CO and frames shot; air display; "
                      "CSA-CP and CDM units are named in Appendix A of the Summary Report (test T1)."),
    "PSI-26": dict(acronym="BASS", title="Burning and Suppression of Solids", doi="10.60555/58h4-dy80",
        hardware="MSG (fan-driven flow duct)", platform="ISS", fuel_state="solid", pillar="suppression",
        summary="The first BASS campaign: 122 tests on PMMA spheres and slabs, SIBAL, Nomex, Ultem and wax. "
                "The experimental table records materials and dates only.",
        sensors=[], sensors_basis="The table records sample identity only."),
    "PSI-39": dict(acronym="CFI", title="Cool Flames Investigation", doi="10.60555/m6pj-a914",
        hardware="CIR (MDCA)", platform="ISS", fuel_state="liquid", pillar="detection",
        summary="87 droplet tests of n-dodecane and dodecane/iso-dodecane blends at 0.5-5 atm and 17% or "
                "21% oxygen, fibre-supported or free-floated.",
        sensors=[], sensors_basis="The table records conditions and fibre use; no instrument columns."),
    "PSI-47": dict(acronym="DAFT", title="Dust and Aerosol Measurement Feasibility Test", doi="10.60555/ztgj-d202",
        hardware="Handheld aerosol instruments", platform="ISS", fuel_state="aerosol", pillar="detection",
        summary="Two sessions aboard the ISS testing hand-held aerosol instruments (a modified P-Trak and a "
                "DustTrak) on Arizona Road Dust, a test dust, and sampling cabin air near racks.",
        sensors=["P-Trak (modified, alcohol wick)", "DustTrak"],
        sensors_basis="Named in the Hardware Description column."),
    "PSI-68": dict(acronym="FLEX-2", title="Flame Extinguishment Experiment 2", doi="10.60555/byp8-h018",
        hardware="CIR (MDCA)", platform="ISS", fuel_state="liquid", pillar="suppression",
        summary="Parameter ranges covered by FLEX-2 droplet tests. These 8 rows describe ranges, not "
                "individual tests; the per-test table is not in this dataset.",
        sensors=[], sensors_basis="Range summary only."),
    "PSI-69": dict(acronym="FLEX", title="Flame Extinguishment Experiment", doi="10.60555/mbq8-0451",
        hardware="CIR (MDCA)", platform="ISS", fuel_state="liquid", pillar="suppression",
        summary="274 methanol and heptane droplet tests with recorded outcomes, using carbon dioxide and "
                "helium as suppressants.",
        sensors=["Droplet and flame imaging (diameters recorded)", "Chamber pressure", "Gas composition"],
        sensors_basis="Columns for initial and extinction diameter, burning rate, pressure and mole fractions."),
    "PSI-98": dict(acronym="SAFFIRE-I", title="Spacecraft Fire Experiment I", doi="10.60555/0t15-1z43",
        hardware="Cygnus cargo vehicle (uncrewed)", platform="Cygnus", fuel_state="solid", pillar="prevention",
        summary="Large-scale SIBAL fabric burns aboard an uncrewed Cygnus, comparing concurrent and opposed "
                "flame spread.",
        sensors=["Camera 1", "Camera 2"], sensors_basis="Camera columns in the table."),
    "PSI-99": dict(acronym="SAFFIRE-II", title="Spacecraft Fire Experiment II", doi="10.60555/2chp-m469",
        hardware="Cygnus cargo vehicle (uncrewed)", platform="Cygnus", fuel_state="solid", pillar="prevention",
        summary="Nine samples of silicone, SIBAL, PMMA and Nomex. The only table here with BOTH microgravity "
                "and normal-gravity burn results for the same samples.",
        sensors=["Camera 1", "Camera 2", "CO₂ measurement (used to derive O₂, Note 1)"],
        sensors_basis="Camera columns; Note 1 says O2 was derived from measured CO2 production."),
    "PSI-100": dict(acronym="SAFFIRE-III", title="Spacecraft Fire Experiment III", doi="10.60555/040q-4h36",
        hardware="Cygnus cargo vehicle (uncrewed)", platform="Cygnus", fuel_state="solid", pillar="prevention",
        summary="Two large-scale SIBAL fabric burns at 30 cm/s, concurrent and opposed. The table records "
                "conditions only.",
        sensors=["Camera 1", "Camera 2"], sensors_basis="Camera columns in the table."),
    "PSI-101": dict(acronym="SAME-R", title="Smoke Aging and Measurement Experiment (Reflight)", doi="10.60555/2np7-jv14",
        hardware="MSG", platform="ISS", fuel_state="smoke", pillar="detection",
        summary="109 tests of how smoke particles grow as they age, from Kapton, silicone, lampwick, Teflon "
                "and Pyrell heated without flaming (pyrolysis smoke, not fire smoke).",
        sensors=["P-Trak", "Smoke detector (STS)"],
        sensors_basis="Named in the Description column (e.g. 'no Ptrak', 'STS det')."),
    "PSI-107": dict(acronym="SPICE", title="Smoke Point In Co-flow Experiment", doi="10.60555/9kbh-e962",
        hardware="MSG", platform="ISS", fuel_state="gas", pillar="detection",
        summary="469 gas-jet tests locating the smoke point (where a flame starts releasing soot) for "
                "ethylene, propane, propylene blends and methane across three nozzle sizes.",
        sensors=["Fuel flow controller (sccm)", "Co-flow air rate"],
        sensors_basis="Fuel rate and air rate columns."),
    "PSI-159": dict(acronym="CFI-G", title="Cool Flames Investigation with Gases", doi="10.60555/cyt1-kh64",
        hardware="CIR (ACME insert)", platform="ISS", fuel_state="gas", pillar="detection",
        summary="179 tests separating cool flames from hot ignition in ethane, propane and butane streams, "
                "with seven cool-flame regimes labelled PCI-A to PCI-G.",
        sensors=["Photomultiplier tube (PMT)", "Burner thermocouple", "O₂ measurement"],
        sensors_basis="PMT named in Comments; peak burner temperature and O2 before/after columns."),
}

# Investigations the challenge / team strategy names that are NOT in this
# dataset. Listed so their absence is visible rather than silent.
NOT_INCLUDED = [
    {"name": "SAME (original)", "psi_id": "PSI-102", "doi": "10.60555/gd4k-8h62"},
    {"name": "DAFT-2", "psi_id": "PSI-47", "doi": "10.60555/ztgj-d202"},
    {"name": "SLICE", "psi_id": "PSI-106", "doi": "10.60555/pm12-rg61"},
    {"name": "ACME s-Flame", "psi_id": "PSI-23", "doi": "10.60555/k57n-p030"},
    {"name": "ACME Flame Design", "psi_id": "PSI-10", "doi": "10.60555/w4zy-bt45"},
    {"name": "ACME CLD Flame", "psi_id": "PSI-21", "doi": "10.60555/23e1-9950"},
    {"name": "FLEX-2 per-test table", "psi_id": "PSI-68", "doi": "10.60555/byp8-h018"},
    {"name": "Saffire IV-VI", "psi_id": None, "doi": None},
]

VARIABLE_LABELS = {
    "o2_percent": "Oxygen", "pressure_atm": "Pressure", "flow_cm_s": "Airflow",
    "flow_direction": "Flow direction", "droplet_d0_mm": "Droplet diameter",
    "extinction_d_mm": "Extinction diameter", "burn_rate": "Burning rate",
    "burn_time_s": "Burn time", "co2_mole_fraction": "CO₂ fraction",
    "he_mole_fraction": "Helium fraction", "rt_r0": "Smoke growth Rt/R₀",
    "temperature_c": "Burner temperature", "outcome_class": "Outcome",
    "geometry": "Sample shape", "thickness_mm": "Sample thickness",
    "diameter_mm": "Sample diameter", "spread_rate_mm_s": "Spread rate",
    "fuel_rate_mg_s": "Fuel rate", "nozzle_mm": "Nozzle size",
}


def _real(tests):
    return [t for t in tests if not t["is_note"] and not t["is_flow_vis"]]


def _range(values):
    v = [x for x in values if x is not None]
    return {"min": min(v), "max": max(v)} if v else None


def build_investigations(per_inv):
    out = []
    for psi_id, meta in INVESTIGATIONS.items():
        records = per_inv[psi_id]
        tests = _real(records)
        o2 = [t["normalized"]["o2_percent"] for t in tests]
        for t in tests:                       # ACME BRE keeps its list of levels
            o2.extend(t["normalized"].get("o2_levels_tested") or [])
        kpa = [t["normalized"]["pressure_kpa"] for t in tests]
        variables = [label for key, label in VARIABLE_LABELS.items()
                     if any(t["normalized"].get(key) not in (None, [], "") for t in tests)]
        with_outcome = sum(1 for t in tests if t["normalized"].get("outcome_class"))
        lengths = [t["normalized"].get("sample_length_cm") for t in tests]
        areas = [t["normalized"]["sample_length_cm"] * t["normalized"]["sample_width_cm"] for t in tests
                 if t["normalized"].get("sample_length_cm") and t["normalized"].get("sample_width_cm")]
        max_area = max(areas, default=None)
        out.append({
            "psi_id": psi_id,
            **{k: v for k, v in meta.items() if k not in ("sensors", "sensors_basis", "objectives")},
            "objectives": meta.get("objectives"),
            "sensors_evidenced": meta["sensors"],
            "sensors_basis": meta["sensors_basis"],
            "psi_url": f"https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}",
            "doi_url": f"https://doi.org/{meta['doi']}" if meta["doi"] else None,
            "row_count": len(records),
            "test_count": len(tests),
            "materials": sorted({t["normalized"]["material"] for t in tests if t["normalized"].get("material")}),
            "substances": sorted({t["normalized"]["substance"] for t in tests if t["normalized"].get("substance")}),
            "variables_recorded": variables,
            "o2_range": _range(o2),
            "pressure_kpa_range": _range(kpa),
            "outcome_fraction": round(with_outcome / len(tests), 3) if tests else 0,
            "has_1g_reference": any(t["normalized"].get("has_1g_reference") for t in tests),
            # Physical scale, used by the ranking's "scale" criterion. "large"
            # needs a RECORDED sample of at least 1,000 cm^2 (SAFFIRE-I and -III,
            # 40.6 x 94 cm); flying in a Cygnus is not enough on its own
            # (SAFFIRE-II's samples were 29 x 5 cm). The reviewer caught this.
            "scale_class": ("large" if max_area and max_area >= 1000
                            else "medium" if max_area
                            else "glovebox" if meta["hardware"].startswith("MSG")
                            else "cabin" if psi_id == "PSI-47" else "chamber"),
            "max_sample_area_cm2": round(max_area, 1) if max_area else None,
            "max_sample_length_cm": max([l for l in lengths if l], default=None),
            "embedded_notes": [r["normalized"].get("note_text") for r in records
                               if r["is_note"] and r["normalized"].get("note_text")],
            "anomaly_count": sum(len(r["anomalies"]) for r in records),
        })
    return out


# ---------------------------------------------------------------------------
#  MATERIAL CARDS -- one per (material, fuel state)
# ---------------------------------------------------------------------------
#  Keyed by material AND state so that silicone burned as a solid (SAFFIRE-II)
#  and silicone heated for smoke (SAME-R) are two cards. An earlier build
#  merged them and labelled solid silicone as "smoke".
# ---------------------------------------------------------------------------

def _confidence(n_outcomes):
    if n_outcomes >= 20:
        return "high", f"{n_outcomes} tests with a recorded outcome"
    if n_outcomes >= 5:
        return "medium", f"{n_outcomes} tests with a recorded outcome"
    if n_outcomes >= 1:
        return "low", f"only {n_outcomes} test(s) with a recorded outcome"
    return "conditions only", "no test records how it ended"


def build_materials(all_tests):
    from loaders import OUTCOME_LABELS
    groups = defaultdict(list)
    for t in _real(all_tests):
        n = t["normalized"]
        if n.get("material"):
            groups[(n["material"], n["fuel_state"])].append(t)

    cards = []
    for (name, state), tests in sorted(groups.items()):
        n_ = [t["normalized"] for t in tests]
        clean_tests = [t for t in tests if "implausible_o2_reading" not in t["anomalies"]]
        o2 = _range([n["o2_percent"] for n in (t["normalized"] for t in clean_tests)])
        classes = Counter(n["outcome_class"] for n in n_ if n.get("outcome_class") and n["outcome_class"] != "ignition_count")
        n_outcomes = sum(classes.values())
        level, reason = _confidence(n_outcomes)
        comparisons = [{
            "test": t["test_number"], "psi_id": t["psi_id"],
            "outcome_0g": t["normalized"].get("outcome"),
            "outcome_1g": t["normalized"].get("outcome_1g"),
            "burn_length_0g": t["normalized"].get("burn_length_0g_raw"),
            "burn_length_1g": t["normalized"].get("burn_length_1g_raw"),
        } for t in tests if t["normalized"].get("has_1g_reference")]
        dims = {
            "diameter_mm": sorted({n["diameter_mm"] for n in n_ if n.get("diameter_mm")}),
            "thickness_mm": sorted({n["thickness_mm"] for n in n_ if n.get("thickness_mm")}),
        }
        pressures = [n["pressure_kpa"] for n in n_ if n.get("pressure_kpa") is not None]
        near_iss = any(20 <= (n.get("o2_percent") or 0) <= 22.5 for n in n_)

        mission = {
            "iss": ("tested" if near_iss else "not tested",
                    "Tests near ISS cabin oxygen (about 21%) in microgravity." if near_iss
                    else "No test near 21% oxygen in this dataset."),
            "lunar_habitat": ("not tested",
                    "No test at 30% oxygen with reduced pressure and lunar gravity exists in this dataset."
                    + ("" if not o2 or o2["max"] < 30 else " Oxygen reached 30%+ but not with reduced pressure and lunar gravity.")),
            "spacesuit": ("not tested", "No test near 100% oxygen at 4.3 psi exists in this dataset."),
        }

        outcome_words = ", ".join(f"{c} {OUTCOME_LABELS.get(k, k).lower()}" for k, c in classes.most_common(3))
        summary = (f"{len(tests)} recorded test{'s' if len(tests) != 1 else ''} across "
                   f"{len({t['psi_id'] for t in tests})} investigation(s)"
                   + (f"; oxygen {o2['min']:g}-{o2['max']:g}%" if o2 else "; oxygen not recorded")
                   + (f"; recorded endings: {outcome_words}" if outcome_words else "; no recorded endings")
                   + ".")

        cards.append({
            "id": f"{name}|{state}",
            "name": name,
            "substance": Counter(n.get("substance") for n in n_).most_common(1)[0][0],
            "fuel_state": state,
            "test_count": len(tests),
            "investigations": sorted({t["psi_id"] for t in tests}),
            "geometries": sorted({n["geometry"] for n in n_ if n.get("geometry")}),
            "dimensions": dims,
            "o2_range": o2,
            "flow_range": _range([n.get("flow_min_cm_s") if n.get("flow_min_cm_s") is not None else n.get("flow_cm_s") for n in n_]
                                 + [n.get("flow_max_cm_s") for n in n_]),
            "pressure_range": _range([n.get("pressure_atm") for n in n_]),
            "pressure_kpa_range": _range(pressures),
            "rt_r0_range": _range([n.get("rt_r0") for n in n_]),
            "burn_time_range": _range([n.get("burn_time_s") for n in n_]),
            "outcome_classes": dict(classes),
            "outcomes": dict(Counter(n["outcome"] for n in n_ if n.get("outcome"))),
            "has_1g_reference": bool(comparisons),
            "gravity_comparisons": comparisons,
            "tested_at_moonbase_o2": bool(o2 and o2["max"] >= 30),
            "tested_at_reduced_pressure": any(p < 80 for p in pressures),
            "mission_context": {k: {"status": v[0], "note": v[1]} for k, v in mission.items()},
            "confidence": {"level": level, "reason": reason},
            "anomaly_count": sum(len(t["anomalies"]) for t in tests),
            "summary": summary,
        })
    return cards


# ---------------------------------------------------------------------------
#  NEGATIVE KNOWLEDGE -- what failed, broke, surprised, or was never asked
# ---------------------------------------------------------------------------

def build_negative_knowledge(all_tests, doi_of):
    tests = _real(all_tests)
    out = []

    def add(category, title, detail, psi_id, test_ids, source=None):
        out.append({"category": category, "title": title, "detail": detail, "psi_id": psi_id,
                    "tests": test_ids, "doi": doi_of.get(psi_id), "source": source})

    # ---- Failed ignitions ---------------------------------------------------
    cfig = defaultdict(list)
    cfig_all = Counter()
    for t in tests:
        if t["psi_id"] == "PSI-159":
            cfig_all[t["normalized"]["material"]] += 1
            if t["normalized"].get("outcome_class") == "no_ignition_gas":
                cfig[t["normalized"]["material"]].append(t["test_number"])
    for fuel, ids in sorted(cfig.items(), key=lambda kv: -len(kv[1])):
        add("failed_ignition", f"{fuel}: {len(ids)} of {cfig_all[fuel]} attempts never ignited",
            "CFI-G recorded these attempts with no hot ignition and nothing to terminate.",
            "PSI-159", ids)

    bass2 = [t for t in tests if t["psi_id"] == "PSI-25"
             and t["normalized"].get("outcome_class") in ("no_ignition", "no_sustained_flame")]
    by_mat = defaultdict(list)
    for t in bass2:
        by_mat[t["normalized"]["material"] or "Unspecified material"].append(t["test_number"])
    for mat, ids in by_mat.items():
        add("failed_ignition", f"BASS-II {mat}: {len(ids)} test(s) with no sustained flame",
            "The test-matrix observations describe a flame that never established or went out at once.",
            "PSI-25", ids, "NASA/TM-20210011385 Appendix A")

    zero = [t["test_number"] for t in tests if "zero_ignition_day" in t["anomalies"]]
    if zero:
        add("failed_ignition", "ACME BRE: a full test day with zero flames ignited",
            "1 April 2019 recorded no successful ignitions.", "PSI-20", zero)

    add("unexpected_result", "Nomex never ignited next to burning PMMA",
        "SAFFIRE-II sample 2-7: the PMMA portion was completely consumed but the Nomex was not ignited "
        "(table Note 2).", "PSI-99", ["2-7"])
    add("unexpected_result", "Silicone burned on Earth but barely in space",
        "SAFFIRE-II samples 2-1 to 2-4 show about 0 cm burn length in microgravity; three of the four "
        "burned completely or partly in normal gravity.", "PSI-99", ["2-1", "2-2", "2-3", "2-4"])

    # ---- Instrument and record problems ------------------------------------
    def flagged(flag, psi=None):
        return [t for t in tests if flag in t["anomalies"] and (psi is None or t["psi_id"] == psi)]

    for flag, title, detail in [
        ("implausible_o2_reading", "Final oxygen readings that cannot be right",
         "Final O2 far outside the initial value for a single burn (sensor fault or reading not taken)."),
        ("sensor_over_range", "CO sensor over range", "Carbon monoxide exceeded the sensor's range ('OR')."),
        ("telemetry_loss", "Telemetry lost during tests", "Time columns record Ku-band loss of signal."),
        ("unreadable_cell", "Unreadable cells in the FLEX table", "Bytes in the source file cannot be decoded."),
        ("spreadsheet_division_error", "Spreadsheet #DIV/0! errors", "A formula divided by a zero fuel fraction."),
        ("inconsistent_ignition_record", "Ignition column contradicts the burn time",
         "Hot ignition is 'No' yet a burn time and termination are recorded."),
        ("unit_inconsistency_across_tables", "SIBAL thickness recorded in different units",
         "0.37 cm in SAFFIRE-I, 0.33 cm in SAFFIRE-III, but 0.37 mm in SAFFIRE-II for the same fabric."),
    ]:
        hits = flagged(flag)
        if hits:
            psis = sorted({t["psi_id"] for t in hits})
            add("instrument_or_record", f"{title} ({len(hits)})", detail, psis[0],
                [t["test_number"] or t["id"] for t in hits][:40])
    return out


# ---------------------------------------------------------------------------
#  COVERAGE GRID AND OPEN QUESTIONS
# ---------------------------------------------------------------------------

O2_BINS = [("<16%", 0, 16), ("16-19%", 16, 19), ("19-21%", 19, 21), ("21-22.2%", 21, 22.21),
           ("22.2-30%", 22.21, 30), ("≥30%", 30, 101)]
GRAVITY = ["Microgravity", "0.16 g (Moon)", "0.38 g (Mars)", "1 g"]


def build_coverage(all_tests):
    solids = [t for t in _real(all_tests) if t["normalized"]["fuel_state"] == "solid"
              and t["normalized"].get("material") and "implausible_o2_reading" not in t["anomalies"]]
    counts = Counter(t["normalized"]["material"] for t in solids)
    materials = [m for m, c in counts.most_common() if c >= 3]
    grid = {}
    NR = "O\u2082 not recorded"
    for m in materials:
        rows = {}
        mine = [t for t in solids if t["normalized"]["material"] == m]
        for label, lo, hi in O2_BINS:
            cells = {}
            for g in GRAVITY:
                cells[g] = (sum(1 for t in mine if t["normalized"].get("o2_percent") is not None
                                and lo <= t["normalized"]["o2_percent"] < hi) if g == "Microgravity" else 0)
            rows[label] = cells
        # Tests whose table gives no oxygen are counted here, not shown as 0.
        # SAFFIRE-II's normal-gravity burns record no oxygen of their own, so
        # they land in this column at 1 g (no partial-gravity data exists).
        unknown = sum(1 for t in mine if t["normalized"].get("o2_percent") is None)
        one_g = sum(1 for t in mine if t["normalized"].get("has_1g_reference"))
        rows[NR] = {g: (unknown if g == "Microgravity" else one_g if g == "1 g" else 0) for g in GRAVITY}
        grid[m] = {"cells": rows, "o2_not_recorded_0g": unknown, "one_g_references": one_g}

    return {"o2_bins": [b[0] for b in O2_BINS] + ["O\u2082 not recorded"], "gravity": GRAVITY, "grid": grid,
            "pressure_note": "No solid-fuel table in this dataset records chamber pressure, so reduced-"
                             "pressure coverage for solids cannot be shown; none is recorded."}


# ---------------------------------------------------------------------------
#  KEY INSIGHTS -- three facts for the landing page, computed
# ---------------------------------------------------------------------------

def build_key_insights(stats):
    """Three findings for the home page. Each is a result, not a description
    of the test protocol, and each names its source."""
    return [
        {"id": "low_oxygen",
         "headline": f"PMMA kept burning in microgravity at {stats['pmma_min_o2']}% oxygen",
         "detail": (f"BASS-II test {stats['pmma_min_test']} (a PMMA rod) sustained a flame at {stats['pmma_min_o2']}% O2. "
                    f"Attempts at {stats['pmma_fail_range']} did not sustain one; the closest, O13b at 14.6%, "
                    "\u201conly stayed lit at 0.9 for less than a minute\u201d. A separate NASA result, for a cellulose "
                    "fuel rather than PMMA: its Earth oxygen limit is 16.5%, yet flames survived at 14% under "
                    "spacecraft-like ventilation of 5-20 cm/s. No NASA normal-gravity oxygen limit for PMMA is "
                    "cited here, so the two numbers are not compared."),
         "psi_id": "PSI-25", "doi": "10.60555/4qc4-de67", "lit": ["OLSON2004", "BASS2_TM"],
         "source": f"PSI-25 tests {stats['pmma_min_test']}, O12 (NASA/TM-20210011385 App. A); Olson, NASA/TM-2004-213114"},
        {"id": "silicone",
         "headline": "Silicone burned on Earth but barely in space",
         "detail": ("All four SAFFIRE-II silicone samples left about 0 cm burned in microgravity; at 1 g two burned "
                    "completely and one 7.6 cm. Earth testing can misjudge a material in either direction. Caveat: "
                    "four samples, all near the oxygen limit (21.5-22.1% O2)."),
         "psi_id": "PSI-99", "doi": "10.60555/2chp-m469", "lit": [],
         "source": "PSI-99 SAFFIRE-II, samples 2-1 to 2-4, burn length columns"},
        {"id": "lunar_g",
         "headline": "Lunar-gravity flame data now exists, outside PSI",
         "detail": ("LUCI (Blue Origin New Shepard, 4 Feb 2025) burned SIBAL at simulated lunar gravity: its flame tip "
                    "spread at 1.1 mm/s against 2.8 mm/s at 1 g, yet it burned about 45 s longer before going out. "
                    "PSI itself still holds no partial-gravity data."),
         "psi_id": None, "doi": None, "lit": ["LUCI"],
         "source": "Ferkul et al., ASGSR 2025, NTRS 20250010653"},
    ]
