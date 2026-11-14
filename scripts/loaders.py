# =============================================================================
#  MICRO FLAMMA  ·  loaders.py
# =============================================================================
#  One function per NASA PSI experimental table. Each reads its CSV and turns
#  every row into a record of the same shape, so the website can treat all 14
#  investigations alike.
#
#  THE RULES EVERY LOADER FOLLOWS
#  ------------------------------
#  * `raw` keeps the original row, untouched, always.
#  * A blank cell becomes None (null in JSON) -- never 0, never a guess.
#  * When we correct or infer something, we record a flag saying so.
#  * When a value is a RANGE or a SEQUENCE, we keep it as one rather than
#    squashing it to a single number that NASA never wrote.
# =============================================================================

import csv
import os
import re

RAW_DIR = "data_raw"

# BASS-II airflow: NASA's calibration spreadsheet gives velocity in cm/s as the
# anemometer ("Air display") reading times 1.0066. See build notes in README.
AIR_DISPLAY_TO_CM_S = 1.0066

# The BASS-II Summary Report this project transcribed outcomes from.
BASS2_REPORT = "NASA/TM-20210011385, BASS-II Summary Report, Appendix A"


# =============================================================================
#  SMALL HELPERS
# =============================================================================

def clean(value):
    """Trim a cell; turn blanks into None."""
    if value is None:
        return None
    text = str(value).replace(" ", " ").strip()
    return text if text else None


def to_float(value):
    """First number in a cell, or None. Never returns 0 for an empty cell."""
    text = clean(value)
    if text is None:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(match.group()) if match else None


def read_csv(filename, encoding="utf-8"):
    """Return (header, rows). Column names are trimmed of stray spaces."""
    with open(os.path.join(RAW_DIR, filename), newline="", encoding=encoding,
              errors="replace") as handle:
        rows = list(csv.reader(handle))
    # PSI-25 and PSI-26 begin with an invisible UTF-8 byte-order mark. Left in,
    # it glues itself to the first column name ("\ufeffPI"), and that whole
    # column silently reads as empty -- which is how every BASS-II row lost its
    # investigator and every BASS row lost its date in an earlier build.
    header = [clean((c or "").lstrip("\ufeff")) or f"column_{i}" for i, c in enumerate(rows[0])]
    records = []
    for row in rows[1:]:
        if not any(clean(cell) for cell in row):
            continue
        padded = row + [None] * (len(header) - len(row))
        records.append({header[i]: padded[i] for i in range(len(header))})
    return header, records


def make_record(psi_id, acronym, test_number, raw_row, normalized, anomalies=None,
                science_flags=None, is_note=False, is_flow_vis=False, row_index=0):
    """Build one record in the shared shape every loader returns.

    `anomalies` are DATA-QUALITY problems (typos, failed sensors).
    `science_flags` are SCIENTIFIC observations (e.g. cool-flame territory).
    They are kept apart so a scientific finding is never shown as a data error.
    """
    return {
        "id": f"{psi_id}-{test_number}" if test_number else f"{psi_id}-row{row_index}",
        "psi_id": psi_id,
        "acronym": acronym,
        "test_number": test_number,
        "row_index": row_index,
        "raw": {k: clean(v) for k, v in raw_row.items()},
        "normalized": normalized,
        "anomalies": anomalies or [],
        "science_flags": science_flags or [],
        "is_note": is_note,
        "is_flow_vis": is_flow_vis,
    }


def blank_normalized(**overrides):
    """Every normalized field present and set to None, then the overrides."""
    base = {
        "material": None, "material_raw": None, "substance": None, "fuel_fraction": None,
        "geometry": None, "thickness_mm": None, "width_mm": None, "diameter_mm": None,
        "fuel": None, "fuel_state": None,
        "o2_percent": None, "o2_display": None, "o2_mole_fraction": None,
        "n2_mole_fraction": None, "co2_mole_fraction": None, "he_mole_fraction": None,
        "pressure_atm": None, "pressure_kpa": None, "pressure_mmhg": None,
        "flow_cm_s": None, "flow_min_cm_s": None, "flow_max_cm_s": None,
        "flow_sequence_cm_s": [], "flow_raw": None, "flow_direction": None,
        "gravity": None,
        "droplet_d0_mm": None, "extinction_d_mm": None,
        "burn_rate": None, "burn_time_s": None, "spread_rate_mm_s": None,
        "outcome": None, "outcome_class": None, "outcome_text": None, "outcome_source": None,
        "rt_r0": None, "temperature_c": None,
        "material_notes": [],
    }
    base.update(overrides)
    return base


# =============================================================================
#  FUEL NAMES
# =============================================================================
#  The same substance is written many ways across the 14 tables: "100% C2H4"
#  and "Ethylene"; "propane" and "Propane"; "Heptane (pure)" and "Heptane".
#  canonical_fuel() maps each to one SUBSTANCE name (for grouping and filters)
#  and a MATERIAL label that keeps the dilution ("Butane (30%)"), because a
#  30% butane stream and pure butane are different experimental conditions.
# =============================================================================

SUBSTANCES = [
    # (pattern, canonical substance)  -- checked in order
    (r"c12h26\s*/\s*iso-dodecane|iso-dodecane", "n-Dodecane / iso-dodecane"),
    (r"c12h26|dodecane", "n-Dodecane"),
    (r"isooctane|iso-octane", "Isooctane"),
    (r"n-octane", "n-Octane"),
    (r"c2h4|ethylene", "Ethylene"),
    (r"ch4|methane", "Methane"),
    (r"propylene", "Propylene"),
    (r"butane", "Butane"),
    (r"propane", "Propane"),
    (r"ethane", "Ethane"),
    (r"heptane", "Heptane"),
    (r"methanol", "Methanol"),
    (r"ethanol", "Ethanol"),
    (r"decane", "n-Decane"),
]


def canonical_fuel(raw):
    """Return (substance, material_label, fraction) for a fuel string."""
    if not raw:
        return None, None, None
    text = raw.lower()

    # Mixtures of two named liquids (FLEX-2) keep their own descriptive label.
    if "glycerol" in text or ("heptane" in text and "isooctane" in text):
        label = re.sub(r"\s*\(mixture\)\s*", "", raw).strip()
        return label, label, None

    # CFI writes blends as "[.75]/[.25] C12H26/iso-dodecane".
    blend = re.match(r"\[\.(\d+)\]\s*/\s*\[\.(\d+)\]", raw.strip())
    if blend:
        a, b = blend.group(1), blend.group(2)
        return "n-Dodecane / iso-dodecane", f"n-Dodecane / iso-dodecane ({a}/{b})", None

    substance = None
    for pattern, name in SUBSTANCES:
        if re.search(pattern, text):
            substance = name
            break
    if substance is None:
        return raw, raw, None

    pct = re.search(r"(\d+)\s*%", raw)
    fraction = int(pct.group(1)) / 100 if pct else None
    if fraction is not None and fraction < 1:
        return substance, f"{substance} ({int(fraction * 100)}%)", fraction
    return substance, substance, 1.0 if pct else None


# =============================================================================
#  SOLID MATERIAL PARSING
# =============================================================================

def parse_material(raw_text):
    """Split a messy solid-sample string into material / geometry / size.

    Anything we cannot read from the string stays None. Inferences are added
    by the loaders afterwards, each with a flag, never silently here.
    """
    r = {"material": None, "geometry": None, "thickness_mm": None, "width_mm": None,
         "diameter_mm": None, "notes": []}
    if not raw_text:
        return r
    t = raw_text.lower()

    # ---- substance (most specific first) ---------------------------------
    if "pmma" in t and "nomex" in t:
        r["material"] = "PMMA + Nomex"
    elif "sibal" in t or "cotton-fiberglass" in t:
        r["material"] = "SIBAL"
    elif "nomex" in t:
        r["material"] = "Nomex"
    elif "ultem" in t:
        r["material"] = "Ultem"
    elif "silicone" in t:
        r["material"] = "Silicone"
    elif "kapton" in t:
        r["material"] = "Kapton"
    elif "teflon" in t:
        r["material"] = "Teflon"
    elif "pyrell" in t:
        r["material"] = "Pyrell"
    elif "lampwick" in t:
        r["material"] = "Lampwick"
    elif "japan wax" in t:
        r["material"] = "Japan Wax"
    elif "paraffin" in t or "parrafin" in t:           # "parrafin": typo in BASS file
        r["material"] = "Paraffin Wax"
    elif "wax" in t or "candle" in t:
        r["material"] = "Wax"
    elif "pmma" in t or re.search(r"(clear|black|blac)\s*(pmma\s*)?rod", t):
        # BASS-II rods are PMMA; colour is the dye. "blac" is a typo (P14).
        r["material"] = "PMMA"
        if "blac rod" in t:
            r["notes"].append("'blac' read as 'black' (typo in source)")

    # ---- shape --------------------------------------------------------------
    if "spherical section" in t:
        r["geometry"] = "spherical section"
    elif "sphere" in t:
        r["geometry"] = "sphere"
    elif "rod" in t or "cylinder" in t:
        r["geometry"] = "rod"
    elif "slab" in t:
        r["geometry"] = "slab"
    elif "film" in t:
        r["geometry"] = "film"
    elif "sheet" in t:
        r["geometry"] = "sheet"
    elif "candle" in t:
        r["geometry"] = "candle"
    elif r["material"] in ("SIBAL", "Nomex"):
        r["geometry"] = "fabric"

    # ---- size -----------------------------------------------------------------
    frac = re.search(r"(\d)\s*/\s*(\d)\s*\"?", t)
    dec_inch = re.search(r"(\d*\.\d+)\s*\"", t)
    mm_rod = re.search(r"(\d+(?:\.\d+)?)\s*-?\s*mm\s+(?:black|clear)?\s*rod", t)
    if r["geometry"] == "rod" and frac:
        r["diameter_mm"] = round(int(frac.group(1)) / int(frac.group(2)) * 25.4, 3)
    elif r["geometry"] == "rod" and dec_inch:
        r["diameter_mm"] = round(float(dec_inch.group(1)) * 25.4, 3)
    elif mm_rod:
        r["diameter_mm"] = float(mm_rod.group(1))

    micron = re.search(r"(\d+)\s*(?:micron|um|µm)", t)
    if micron:
        r["thickness_mm"] = int(micron.group(1)) / 1000.0
    elif r["geometry"] != "rod":
        mm = re.search(r"(\d+(?:\.\d+)?)\s*mm", t)
        if mm:
            r["thickness_mm"] = float(mm.group(1))

    cm = re.search(r"(\d+(?:\.\d+)?)\s*cm", t)
    if cm:
        value_mm = float(cm.group(1)) * 10.0
        # A sphere's "2 cm" is its DIAMETER, not a width. Storing it as width
        # used to leave every sphere with no diameter at all.
        if r["geometry"] in ("sphere", "spherical section"):
            r["diameter_mm"] = value_mm
        else:
            r["width_mm"] = value_mm

    # A thin sample with no shape word is a film; a thick one a slab.
    if r["geometry"] is None and r["thickness_mm"] is not None:
        r["geometry"] = "film" if r["thickness_mm"] < 1.0 else "slab"
        r["notes"].append("shape inferred from thickness")

    # ---- conditions hidden inside the material column ------------------------
    if "opposed" in t or "oppsed" in t:                 # "oppsed": typo in BASS file
        r["notes"].append("opposed flow")
    if "concurrent" in t:
        r["notes"].append("concurrent flow")
    if "wake" in t:
        r["notes"].append("wake ignition")
    if "top side ign" in t:
        r["notes"].append("top-side ignition")
    if "moved igniter" in t:
        r["notes"].append("igniter repositioned")
    if "1 sided" in t or "one-sided" in t or "1-sided" in t:
        r["notes"].append("one-sided sample")
    if "2 sided" in t or "two-sided" in t:
        r["notes"].append("two-sided sample")
    return r


# =============================================================================
#  BASS-II: AIRFLOW SEQUENCES AND OUTCOMES
# =============================================================================

def parse_air_sequence(raw):
    """Numbers in a BASS-II "Air display" cell, in the order the crew set them.

    The crew often stepped airflow during a burn, e.g. "5  3  2  1  ext". We
    keep the whole sequence. Values that are NOT anemometer readings are
    removed first: potentiometer settings ("pot 0.4"), fan values in brackets,
    approximate or uncertain values ("~8", "2(?)", "<1") and targets that were
    never reached ("approaching 10").
    """
    if not raw:
        return []
    text = raw.lower()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"pot\s*\d*\.?\d+", " ", text)
    text = re.sub(r"\d*\.?\d+\s*pot", " ", text)
    text = re.sub(r"approaching\s*\d+", " ", text)
    text = re.sub(r"[<~]\s*\d*\.?\d+", " ", text)
    text = re.sub(r"\d+\s*\(\?\)", " ", text)
    return [float(n) for n in re.findall(r"(?<![\d.])\d+(?:\.\d+)?", text)]


def terminal_event_from_cells(*cells):
    """How the test ended, if the airflow cells of the TABLE itself say so."""
    text = " ".join(c for c in cells if c).lower()
    if not text:
        return None
    if "blowoff" in text or "blew" in text:
        return "blowoff"
    if "would not stay lit" in text or "no ign" in text:
        return "no_sustained_flame"
    if re.search(r"\bext\b|extinc|extinguish|\bout\b|\d+ext", text):
        return "extinguished"
    return None


# Plain-language labels. These are OUR summary categories; NASA's own words
# are always shown alongside them.
OUTCOME_LABELS = {
    "extinguished_low_flow": "Extinguished as airflow was reduced",
    "extinguished_flow_stopped": "Put out by stopping the airflow",
    "self_extinguished": "Self-extinguished",
    "extinguished": "Extinguished",
    "blowoff": "Blew off at high airflow",
    "burned_entire": "Burned the whole sample",
    "burned_sustained": "Kept burning (no extinction recorded)",
    "no_sustained_flame": "No sustained flame",
    "no_ignition": "Did not ignite",
    "negligible_burn": "Barely burned (about 0 cm)",
    "partial_burn": "Partly burned",
    # FLEX and CFI-G use their own recorded words:
    "Extinction": "Extinction", "Disruption": "Disruption", "Completion": "Completion",
    "self_extinguished_gas": "Self-extinguished", "flow_terminated": "Flow terminated",
    "no_ignition_gas": "No ignition", "ignition_count": "Ignition count recorded",
}


def classify_observation(text):
    """Turn a BASS-II test-matrix observation into one summary category.

    Rules are applied in order; the first that matches wins. Negations such as
    "did not blowoff" are removed before looking for "blowoff", so a test that
    FAILED to blow off is not counted as one.
    """
    if not text:
        return "not_stated"
    t = text.lower()

    if "did not ignite" in t:
        return "no_ignition"
    if any(p in t for p in (
            "no sustained flame", "would not sustain", "would not stay lit",
            "no joy on sustained", "only briefly flashed", "brief flames go out",
            "brief ignition flash", "only brief ignition", "ignited briefly but did not spread",
            "extinguished before spreading beyond igniter", "only stayed lit",
            "igniter broke after third attempt")):
        return "no_sustained_flame"

    no_neg = t
    for neg in ("did not blowoff", "did not blow off", "tried blowoff without success",
                "without success", "no blowoff attained", "tried to blowoff, but did not",
                "but did not", "tried blowoff", "tried to blowoff"):
        no_neg = no_neg.replace(neg, " ")
    if any(p in no_neg for p in ("blew out", "blowoff", "blew off")):
        return "blowoff"

    if any(p in t for p in (
            "turned off flow", "turned flow off", "just fan off", "turned down flow to 0",
            "turned fan pot to 0 to extinguish", "until turned flow off",
            "put flame out by turning off flow", "flame out when pot turned to 0;")):
        return "extinguished_flow_stopped"

    if any(p in t for p in (
            "burned entire sample", "burned completely", "complete burnout",
            "spread whole sample", "fuel is burned out", "burn full sample length",
            "reached end of sample", "at end of sample", "burned entire")):
        return "burned_entire"

    if any(p in t for p in ("self-extinguished", "went out on its own", "died after")):
        return "self_extinguished"

    if any(p in t for p in (
            "extinguished at pot", "extinction at", "quench", "flame out", "went out at pot",
            "goes out at", "out at 0.", "reduced flow below", "turned air down",
            "turned down to 5 and extinguished", "extinguished at 0.", "reached a pot",
            "decreased flow, extinguished", "as soon as he turned flow down",
            "flame went out after", "turning into flamelet", "turning pot down",
            "turned down flow to extinguish", "extinction finally", "flame out after",
            "slow extinction", "extinguished at lower flow", "extinguished at same",
            "out immediately at", "reduced flow in increments")):
        return "extinguished_low_flow"

    if "extinguish" in t.replace("did not extinguish", "") or "extinction" in t:
        return "extinguished"

    if any(p in t for p in ("did not blowoff", "no blowoff attained", "but did not",
                            "did not extinguish",
                            "steady burn", "still did not extinguish", "steady spread",
                            "stable burn", "without success")):
        return "burned_sustained"
    return "not_stated"


def load_appendix_a():
    """The hand transcription of the BASS-II test matrices (see data_raw)."""
    path = os.path.join(RAW_DIR, "BASS-II_AppendixA_transcribed.csv")
    out = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            out[row["Test #"].strip()] = {
                "direction": clean(row["Flow direction (matrix)"]),
                "observation": clean(row["Test observations (matrix)"]),
                "page": int(row["Report page"]),
            }
    return out


# =============================================================================
#  LOADERS
# =============================================================================

def load_psi20():
    """ACME BRE -- 18 daily summary rows of gaseous burner tests."""
    _, rows = read_csv("PSI-20_ACME-BRE.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        o2_raw = clean(row.get("Oxygen Conc (percent)"))
        levels = []
        for piece in (o2_raw or "").split(";"):
            number = to_float(piece)
            if number is None:
                continue
            if number > 100:          # "3400%" and "2100%": a stray "00"
                number /= 100.0
                if "raw_percent_typo" not in anomalies:
                    anomalies.append("raw_percent_typo")
            levels.append(number)

        ignited = to_float(row.get("Flames Ignited"))
        if ignited == 0:
            anomalies.append("zero_ignition_day")

        fuel_raw = clean(row.get("Fuel Bottle"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_fraction=fraction, fuel_state="gas", gravity="0g",
            # A day spans several oxygen levels. We do NOT collapse them into
            # one number: o2_percent is set only when a single level was used,
            # and the full list is kept for display and filtering.
            o2_percent=levels[0] if len(levels) == 1 else None,
            o2_display="; ".join(f"{v:g}" for v in levels) if levels else None,
            outcome=f"{int(ignited)} flames ignited" if ignited is not None else None,
            outcome_class="ignition_count" if ignited is not None else None,
        )
        normalized["o2_levels_tested"] = levels
        normalized["burner_size_mm"] = to_float(row.get("Burner Size (mm)"))
        normalized["flames_ignited"] = int(ignited) if ignited is not None else None
        normalized["date"] = f"{clean(row.get('Date'))} {clean(row.get('Month'))} {clean(row.get('Year'))}"
        out.append(make_record("PSI-20", "ACME BRE", f"D{i}", row, normalized,
                               anomalies, row_index=i))
    return out


def load_psi22():
    """ACME E-FIELD -- 21 test rows + 11 note-only continuation rows."""
    _, rows = read_csv("PSI-22_ACME-EFIELD.csv")
    out, seen = [], set()
    for i, row in enumerate(rows, start=1):
        test_type = clean(row.get("Test Type"))
        if not test_type:
            normalized = blank_normalized(fuel_state="gas")
            normalized["note_text"] = clean(row.get("Notes")) or clean(row.get("Fuel Conc"))
            out.append(make_record("PSI-22", "ACME E-FIELD", None, row, normalized,
                                   ["embedded_footnote"], is_note=True, row_index=i))
            continue
        anomalies = []
        test_day = clean(row.get("Test Day"))
        if test_day in seen:
            anomalies.append("duplicate_row_block")
        seen.add(test_day)
        fuel_raw = clean(row.get("Fuel Bottle"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        flames = to_float(row.get("Flames Ignited"))
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_fraction=fraction, fuel_state="gas", gravity="0g",
            outcome=f"{int(flames)} flames ignited" if flames is not None else None,
            outcome_class="ignition_count" if flames is not None else None,
        )
        normalized["mesh_polarity"] = clean(row.get("Mesh Polarity"))
        normalized["fuel_concentration"] = clean(row.get("Fuel Conc"))
        normalized["flames_ignited"] = int(flames) if flames is not None else None
        normalized["test_day"] = test_day
        normalized["burner_round"] = test_type
        out.append(make_record("PSI-22", "ACME E-FIELD", test_day, row, normalized,
                               anomalies, row_index=i))
    return out


def load_psi25():
    """BASS-II -- 129 solid-fuel tests, plus outcomes from the report."""
    _, rows = read_csv("PSI-25_BASS-II.csv")
    appendix = load_appendix_a()
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        test = clean(row.get("Test #"))
        pi = clean(row.get("PI"))

        o2_initial = to_float(row.get("Calibrated  initial O2 % by vol"))
        o2_final_raw = clean(row.get("Calibrated final O2 % by vol"))
        o2_final = to_float(o2_final_raw)
        co_initial_raw = clean(row.get("Initial CO (ppm)"))
        co_initial = to_float(co_initial_raw)
        frames = clean(row.get("Total Frames Shot"))

        # A final O2 far outside the initial value cannot be right for one
        # short burn in a sealed volume. Six rows do this (B2, F3, P22a, P22b,
        # T28a, T28b). Kept visible; excluded from statistics.
        if o2_final is not None and o2_initial is not None and (
                o2_final < o2_initial * 0.5 or o2_final > o2_initial * 1.5):
            anomalies.append("implausible_o2_reading")
            if test == "B2":
                anomalies.append("sensor_failure")
        if co_initial is not None and co_initial < 0:
            anomalies.append("baseline_co_offset")
        if frames and not re.match(r"^\d", frames):
            anomalies.append("non_numeric_frame_count")
        if co_initial_raw in ("OR", "over") or clean(row.get("Final CO (ppm)")) in ("OR", "over"):
            anomalies.append("sensor_over_range")
        date = clean(row.get("Date"))
        if date and "2018" in date:
            anomalies.append("date_year_typo")

        material_raw = clean(row.get("Fuel Sample Material"))
        p = parse_material(material_raw)
        notes = list(p["notes"])

        # Inference 1: Bhattacharjee's thin samples are PMMA films. Four rows
        # omit the word "PMMA" ("100 micron film 2 cm wide"); the same task's
        # other rows name it. Inferred, and flagged as inferred.
        if p["material"] is None and pi == "Bhattacharjee" and p["thickness_mm"] is not None:
            p["material"] = "PMMA"
            anomalies.append("material_inferred")
            notes.append("material inferred: same task and sample family as rows that name PMMA film")
        # The "4 cm spherical section" rows (T3, T7) name no material, and
        # neither does NASA's test matrix. We leave it unknown.
        if p["material"] is None:
            anomalies.append("material_not_stated")

        air_raw = clean(row.get("Air display"))
        fan_raw = clean(row.get("Fan display"))
        seq_cm = [round(v * AIR_DISPLAY_TO_CM_S, 2) for v in parse_air_sequence(air_raw)]
        if not seq_cm and fan_raw:
            # Only a fan setting was logged. The fan-to-airspeed relationship
            # drifted as the duct sooted, so we do not back-calculate a speed.
            anomalies.append("flow_recorded_as_fan_setting_only")
        if len(seq_cm) > 1:
            notes.append("airflow stepped during the test")

        # ---- outcome ----------------------------------------------------------
        app = appendix.get(test)
        table_event = terminal_event_from_cells(air_raw, fan_raw)
        if app:
            outcome_class = classify_observation(app["observation"])
            outcome_text = app["observation"]
            outcome_source = f"{BASS2_REPORT}, p. {app['page']}"
            direction = app["direction"].lower() if app["direction"] else None
        else:
            # O20-O22 (2016) are not in the report; use the table's own cells.
            outcome_class = table_event or None
            outcome_text = f"Airflow cells: {air_raw or ''} / {fan_raw or ''}".strip() if table_event else None
            outcome_source = "Air/Fan display cells of the PSI-25 table" if table_event else None
            direction = None
        if outcome_class == "not_stated":
            outcome_class = None

        normalized = blank_normalized(
            material=p["material"], material_raw=material_raw, substance=p["material"],
            geometry=p["geometry"], thickness_mm=p["thickness_mm"], width_mm=p["width_mm"],
            diameter_mm=p["diameter_mm"], fuel_state="solid", gravity="0g",
            o2_percent=o2_initial,
            flow_cm_s=seq_cm[0] if seq_cm else None,
            flow_min_cm_s=min(seq_cm) if seq_cm else None,
            flow_max_cm_s=max(seq_cm) if seq_cm else None,
            flow_sequence_cm_s=seq_cm, flow_raw=air_raw, flow_direction=direction,
            outcome=OUTCOME_LABELS.get(outcome_class) if outcome_class else None,
            outcome_class=outcome_class, outcome_text=outcome_text, outcome_source=outcome_source,
            material_notes=notes,
        )
        normalized["table_terminal_event"] = table_event
        normalized["o2_final_percent"] = o2_final
        normalized["co2_initial_percent"] = to_float(row.get("Initial CO2 % by vol"))
        normalized["co2_final_percent"] = to_float(row.get("Final CO2 % by vol"))
        normalized["co_initial_ppm"] = co_initial
        normalized["co_final_ppm"] = to_float(row.get("Final CO (ppm)"))
        normalized["fan_display"] = fan_raw
        normalized["flow_restrictor"] = to_float(row.get("Flow restrictor"))
        normalized["principal_investigator"] = pi
        normalized["sample_number"] = clean(row.get("Sample #"))
        normalized["frames_shot"] = frames
        normalized["date"] = date
        out.append(make_record("PSI-25", "BASS-II", test, row, normalized,
                               anomalies, row_index=i))
    return out


def load_psi26():
    """BASS -- 122 rows. The table records materials and dates only."""
    _, rows = read_csv("PSI-26_BASS.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        material_raw = clean(row.get("Fuel Sample Material"))
        date = clean(row.get("Date"))
        is_maint = bool(material_raw and "soot cleaning" in material_raw.lower())
        if is_maint:
            anomalies.append("maintenance_row")
        if date and "2103" in date:
            anomalies.append("date_year_typo")
        if date and "`" in date:
            anomalies.append("date_punctuation_typo")
        p = parse_material(material_raw)
        direction = ("opposed" if "opposed flow" in p["notes"]
                     else "concurrent" if "concurrent flow" in p["notes"] else None)
        normalized = blank_normalized(
            material=p["material"], material_raw=material_raw, substance=p["material"],
            geometry=p["geometry"], thickness_mm=p["thickness_mm"], width_mm=p["width_mm"],
            diameter_mm=p["diameter_mm"], fuel_state="solid", gravity="0g",
            flow_direction=direction, material_notes=list(p["notes"]),
        )
        normalized["sample_number"] = clean(row.get("Sample #"))
        normalized["as_run_test_number"] = clean(row.get("As Run Test #"))
        normalized["gmt_day"] = clean(row.get("GMT"))
        normalized["date"] = date
        normalized["is_maintenance"] = is_maint
        out.append(make_record("PSI-26", "BASS", clean(row.get("Test #")), row, normalized,
                               anomalies, row_index=i))

    # Sample-number grouping. Several rows say only "PMMA 2 cm" while other
    # rows with the SAME sample number say "PMMA sphere 2 cm". Same sample,
    # same shape -- fill it in, and flag that it came from the group.
    by_sample = {}
    for r in out:
        n = r["normalized"]
        if n["geometry"] and n["sample_number"]:
            by_sample.setdefault(n["sample_number"], set()).add(n["geometry"])
    for r in out:
        n = r["normalized"]
        shapes = by_sample.get(n["sample_number"])
        if n["geometry"] is None and shapes and len(shapes) == 1:
            n["geometry"] = next(iter(shapes))
            if n["geometry"] == "sphere" and n["width_mm"] and not n["diameter_mm"]:
                n["diameter_mm"], n["width_mm"] = n["width_mm"], None
            if n["material"] is None:
                n["material"] = n["substance"] = "PMMA"
            r["anomalies"].append("geometry_from_sample_group")
    return out


def load_psi39():
    """CFI -- 87 droplet tests across pressures. Diameter is not recorded."""
    _, rows = read_csv("PSI-39_CFI.csv")
    out, seen = [], set()
    for i, row in enumerate(rows, start=1):
        anomalies = []
        number = clean(row.get("Flex Number"))
        if number in seen:
            anomalies.append("duplicate_row")
        seen.add(number)
        fuel_raw = clean(row.get("Fuel"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        pressure = to_float(row.get("Pressure"))
        fiber = clean(row.get("Fiber"))
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_fraction=fraction, fuel_state="liquid", gravity="0g",
            o2_mole_fraction=to_float(row.get("Oxygen")),
            n2_mole_fraction=to_float(row.get("Nitrogen")),
            he_mole_fraction=to_float(row.get("Helium")),
            pressure_atm=pressure,
            pressure_kpa=round(pressure * 101.325, 2) if pressure else None,
        )
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        # Fibre-supported or free-floated droplet. Blank means not recorded.
        normalized["fiber_supported"] = (True if fiber == "Yes" else False if fiber == "No" else None)
        normalized["cir_id"] = clean(row.get("CIR"))
        normalized["date"] = clean(row.get("Test Date"))
        out.append(make_record("PSI-39", "CFI", number, row, normalized, anomalies, row_index=i))
    return out


def load_psi47():
    """DAFT -- 2 dust-aerosol sampling sessions."""
    _, rows = read_csv("PSI-47_DAFT.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        normalized = blank_normalized(
            material="Arizona Road Dust", substance="Arizona Road Dust",
            material_raw=clean(row.get("Sample Material")), fuel_state="aerosol", gravity="0g")
        normalized["hardware"] = clean(row.get("Hardware Description"))
        normalized["sampled_location"] = clean(row.get("Sampled Location"))
        normalized["date"] = clean(row.get("Actual Day"))
        out.append(make_record("PSI-47", "DAFT", clean(row.get("Session Name")), row,
                               normalized, [], row_index=i))
    return out


def load_psi68():
    """FLEX-2 -- 8 rows describing parameter RANGES, not individual tests."""
    _, rows = read_csv("PSI-68_FLEX-2.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        fuel_raw = clean(row.get("Sample (Fuel Type)"))
        substance, label, fraction = canonical_fuel(re.sub(r"\(pure\)", "", fuel_raw or "").strip())
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_state="liquid", gravity="0g")
        normalized["droplet_d0_range"] = clean(row.get("Initial Droplet Diameter (mm)"))
        normalized["gas_mixture"] = clean(row.get("Ambient Gas Mixture"))
        normalized["o2_display"] = clean(row.get("Oxygen Mole Fraction"))
        normalized["pressure_range"] = clean(row.get("Ambient Pressure (atm)"))
        normalized["temperature_c"] = to_float(row.get("Ambient Temperature (C)"))
        normalized["flow_range"] = clean(row.get("Flow Velocity (cm/s)"))
        normalized["is_range_summary"] = True
        out.append(make_record("PSI-68", "FLEX-2", f"R{i}", row, normalized, [], row_index=i))
    return out


def load_psi69():
    """FLEX -- 274 droplet tests WITH recorded outcomes (cp1252 file)."""
    _, rows = read_csv("PSI-69_FLEX.csv", encoding="cp1252")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies, flags = [], []
        test = clean(row.get("FLEX Test #"))
        p_mmhg = to_float(row.get("Ambient pressure; mmHg"))
        if p_mmhg == 0:
            anomalies.append("zero_pressure_outlier")

        def number(column):
            text = clean(row.get(column))
            if text and "�" in text:
                if "unreadable_cell" not in anomalies:
                    anomalies.append("unreadable_cell")
                return None
            if text and text.startswith("~"):
                if "approximate_value" not in anomalies:
                    anomalies.append("approximate_value")
            return to_float(text)

        fuel_raw = clean(row.get("Fuel"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        outcome = clean(row.get("Test end"))
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_state="liquid", gravity="0g",
            pressure_mmhg=p_mmhg,
            pressure_kpa=round(p_mmhg * 0.133322, 2) if p_mmhg else None,
            pressure_atm=round(p_mmhg / 760.0, 4) if p_mmhg else None,
            o2_mole_fraction=to_float(row.get("O initial ambient composition; mole fraction")),
            n2_mole_fraction=to_float(row.get("N initial ambient composition; mole fraction")),
            co2_mole_fraction=to_float(row.get("CO initial ambient composition; mole fraction")),
            he_mole_fraction=to_float(row.get("He initial ambient composition; mole fraction")),
            droplet_d0_mm=number("Droplet initial diameter; mm"),
            extinction_d_mm=number("Visible flame extinction diameter; mm"),
            burn_rate=number("Burning rate; mm"),
            burn_time_s=number("Burn time; s"),
            outcome=outcome, outcome_class=outcome if outcome in ("Extinction", "Disruption", "Completion") else None,
        )
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        normalized["flex_identifier"] = clean(row.get("FLEX Identifier"))
        normalized["date"] = clean(row.get("Test Date"))
        # FLEX found that large heptane droplets can keep burning as an
        # invisible cool flame after visible extinction. This is a HEURISTIC
        # territory marker, not an observation recorded for this test -- so it
        # goes in science_flags, never in the cool-flame counts.
        if (substance == "Heptane" and normalized["droplet_d0_mm"] is not None
                and normalized["droplet_d0_mm"] > 2.4):
            flags.append("cool_flame_territory")
        out.append(make_record("PSI-69", "FLEX", test, row, normalized, anomalies, flags,
                               row_index=i))
    return out


def load_saffire1():
    """SAFFIRE-I -- 2 large SIBAL burns + 2 pre-test flow-visualisation rows."""
    _, rows = read_csv("PSI-98_SAFFIRE-1.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        sample = clean(row.get("Sample Number"))
        material_raw = clean(row.get("Material"))
        if material_raw and "flow visulation" in material_raw.lower():
            normalized = blank_normalized(fuel_state="solid", gravity="0g")
            normalized["note_text"] = material_raw
            out.append(make_record("PSI-98", "SAFFIRE-I", sample, row, normalized,
                                   ["pre_test_flow_visualisation"], is_flow_vis=True, row_index=i))
            continue
        anomalies = ["unit_inconsistency_across_tables", "dimension_order_inconsistency"]
        o2_raw = clean(row.get("Percent O2"))
        o2_numbers = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", o2_raw or "")]
        if len(o2_numbers) > 1:
            anomalies.append("o2_recorded_as_range")
        thickness_cm = to_float(row.get("Sample Thickness (cm)"))
        normalized = blank_normalized(
            material="SIBAL", substance="SIBAL", material_raw=material_raw, geometry="fabric",
            fuel_state="solid", gravity="0g",
            thickness_mm=thickness_cm * 10 if thickness_cm else None,
            # "21.5 - 21.7" is kept as a range. o2_percent holds its LOWER end
            # for filtering; o2_display shows exactly what NASA wrote.
            o2_percent=min(o2_numbers) if o2_numbers else None,
            o2_display=o2_raw,
            flow_cm_s=to_float(row.get("Air Flow (cm/s)")),
            flow_direction=(clean(row.get("Flow Direction")) or "").lower() or None,
            burn_time_s=to_float(row.get("Burn Time (s)")),
        )
        normalized["o2_range_recorded"] = o2_numbers
        normalized["sample_length_cm"] = to_float(row.get("Sample Length (cm)"))
        normalized["sample_width_cm"] = to_float(row.get("Sample Width (cm)"))
        normalized["ignition_power_w"] = to_float(row.get("Ignition Power (W)"))
        out.append(make_record("PSI-98", "SAFFIRE-I", sample, row, normalized, anomalies,
                               row_index=i))
    return out


def _length_cm(text):
    """Burn length cell -> (cm or None, kind). 'Complete' becomes the full
    29 cm sample length; '~ 0' becomes 0 with kind 'negligible'."""
    if not text:
        return None, None
    t = text.lower()
    if t.startswith("complete"):
        return 29.0, "complete"
    if re.match(r"^~\s*0\b", t):
        return 0.0, "negligible"
    value = to_float(text)
    return value, "measured" if value is not None else None


def load_saffire2():
    """SAFFIRE-II -- 9 samples with BOTH microgravity and 1 g burn results."""
    _, rows = read_csv("PSI-99_SAFFIRE-2.csv")
    out, last_material = [], None
    for i, row in enumerate(rows, start=1):
        sample = clean(row.get("Sample Number"))
        material_raw = clean(row.get("Material"))
        if sample and sample.lower().startswith("note"):
            normalized = blank_normalized(fuel_state="solid")
            normalized["note_text"] = sample
            out.append(make_record("PSI-99", "SAFFIRE-II", None, row, normalized,
                                   ["embedded_footnote"], is_note=True, row_index=i))
            continue
        if material_raw and "flow visulation" in material_raw.lower():
            normalized = blank_normalized(fuel_state="solid", gravity="0g")
            normalized["note_text"] = material_raw
            out.append(make_record("PSI-99", "SAFFIRE-II", sample, row, normalized,
                                   ["pre_test_flow_visualisation"], is_flow_vis=True, row_index=i))
            continue

        anomalies = []
        if not material_raw and last_material:
            material_raw = last_material
            anomalies.append("material_filled_forward")
        elif material_raw:
            last_material = material_raw

        thickness_raw = clean(row.get("Samle Thickness"))     # sic: header typo in source
        thickness_mm = None
        if thickness_raw:
            if re.match(r"^0\d{2}\s*mm", thickness_raw):
                thickness_mm = 0.37
                anomalies.append("raw_thickness_typo")
            elif "fig" not in thickness_raw.lower() and " and " not in thickness_raw:
                value = to_float(thickness_raw)
                if value is not None:
                    thickness_mm = value * 10 if "cm" in thickness_raw else value

        p = parse_material(material_raw)
        geometry = p["geometry"]
        if p["material"] == "Silicone":
            geometry = "sheet"
        elif p["material"] == "PMMA + Nomex":
            geometry = "composite sheet"
        elif p["material"] == "PMMA":
            geometry = "slab"
        if p["material"] == "SIBAL":
            anomalies.append("unit_inconsistency_across_tables")

        b0_raw = clean(row.get("?-g Burn Length"))
        b1_raw = clean(row.get("1-g Burn Length"))
        s0_raw = clean(row.get("?-g Spread Length"))
        s1_raw = clean(row.get("1-g Spread Rate"))
        b0, b0_kind = _length_cm(b0_raw)
        b1, b1_kind = _length_cm(b1_raw)
        # The "?-g Spread Length" column actually holds RATES in mm/s.
        spread0 = to_float(s0_raw) if s0_raw and "mm/s" in s0_raw else None
        spread1 = to_float(s1_raw) if s1_raw and "mm/s" in s1_raw else None
        if spread0 is not None:
            anomalies.append("header_unit_mismatch")

        def cls(length, kind):
            if kind == "negligible":
                return "negligible_burn"
            if kind == "complete" or (length is not None and length >= 29):
                return "burned_entire"
            if length is not None:
                return "partial_burn"
            return None

        c0, c1 = cls(b0, b0_kind), cls(b1, b1_kind)
        if p["material"] == "PMMA + Nomex":
            c0 = "partial_burn"          # Note 2: PMMA consumed, Nomex never ignited
        burn_note = f"Microgravity burn length: {b0_raw or 'not recorded'}. 1 g burn length: {b1_raw or 'not recorded'}."

        normalized = blank_normalized(
            material=p["material"], material_raw=material_raw, substance=p["material"],
            geometry=geometry, thickness_mm=thickness_mm, fuel_state="solid", gravity="0g",
            o2_percent=to_float(row.get("Percent O2 (Note 1)")),
            o2_display=clean(row.get("Percent O2 (Note 1)")),
            flow_cm_s=to_float(row.get("Air Flow (cm/s)")),
            flow_direction=(clean(row.get("Flow Direction")) or "").lower() or None,
            burn_time_s=to_float(row.get("Burn Time (s)")),
            spread_rate_mm_s=spread0,
            outcome=OUTCOME_LABELS.get(c0) if c0 else None,
            outcome_class=c0, outcome_text=burn_note,
            outcome_source="PSI-99 experimental table (burn length columns)",
        )
        normalized["thickness_raw"] = thickness_raw
        normalized["burn_length_0g_cm"] = b0
        normalized["burn_length_1g_cm"] = b1
        normalized["burn_length_0g_raw"] = b0_raw
        normalized["burn_length_1g_raw"] = b1_raw
        normalized["outcome_1g_class"] = c1
        normalized["outcome_1g"] = OUTCOME_LABELS.get(c1) if c1 else None
        normalized["spread_rate_1g_mm_s"] = spread1
        normalized["spread_rate_1g_raw"] = s1_raw
        normalized["has_1g_reference"] = b1_raw is not None
        normalized["ignition_power_w"] = to_float(row.get("Ignition Power (W)"))
        out.append(make_record("PSI-99", "SAFFIRE-II", sample, row, normalized, anomalies,
                               row_index=i))
    return out


def load_saffire3():
    """SAFFIRE-III -- 2 large SIBAL burns at 30 cm/s. No burn results recorded."""
    _, rows = read_csv("PSI-100_SAFFIRE-3.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        thickness_cm = to_float(row.get("Sample Thickness"))
        normalized = blank_normalized(
            material="SIBAL", substance="SIBAL", material_raw=clean(row.get("Material")),
            geometry="fabric", fuel_state="solid", gravity="0g",
            thickness_mm=thickness_cm * 10 if thickness_cm else None,
            flow_cm_s=to_float(row.get("Air Flow")),
            flow_direction=(clean(row.get("Direction")) or "").lower() or None,
        )
        normalized["sample_length_cm"] = to_float(row.get("Sample Length"))
        normalized["sample_width_cm"] = to_float(row.get("Sample Width"))
        out.append(make_record("PSI-100", "SAFFIRE-III", clean(row.get("Sample Number")), row,
                               normalized, ["unit_inconsistency_across_tables",
                                            "dimension_order_inconsistency"], row_index=i))
    return out


def load_psi101():
    """SAME-R -- 109 smoke-aging tests on heated (non-flaming) samples."""
    _, rows = read_csv("PSI-101_SAME-R.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        material = clean(row.get("Sample Type"))
        test = clean(row.get("SAME Test #"))
        net = clean(row.get("Net aging time (sec)"))
        if net == "n/a":
            anomalies.append("not_applicable_cell")
        normalized = blank_normalized(
            material=material, substance=material, material_raw=material,
            fuel_state="smoke", gravity="0g",
            flow_cm_s=to_float(row.get("Inlet velocity (cm/s)")),
            rt_r0=to_float(row.get("Rt/R0")),
        )
        normalized["description"] = clean(row.get("Description"))
        normalized["duration_s"] = to_float(row.get("Duration (sec)"))
        normalized["primary_aging_time_s"] = to_float(row.get("Primary aging time (sec)"))
        normalized["net_aging_time_s"] = to_float(net)
        normalized["is_aged_followup"] = bool(test and test.endswith("a"))
        normalized["date"] = clean(row.get("Date"))
        out.append(make_record("PSI-101", "SAME-R", test, row, normalized, anomalies,
                               row_index=i))
    return out


def load_psi107():
    """SPICE -- 469 gas-jet smoke-point tests."""
    _, rows = read_csv("PSI-107_SPICE.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        fuel_raw = clean(row.get("Fuel"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        air = to_float(row.get("Air Rate (cm/s)"))
        if air is not None and air < 0:
            anomalies.append("negative_flow_reading")
        ign = clean(row.get("GMT ignition"))
        if ign and re.search(r"ku|los|n/a", ign, re.I):
            anomalies.append("telemetry_loss")
        elif ign and re.match(r"^\d{1,2}\.\d{2}\.\d{2}$", ign):
            anomalies.append("time_format_variant")
        rate = to_float(row.get("Fuel Rate (sccm)"))
        if rate == 0:
            anomalies.append("zero_fuel_rate")
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_fraction=fraction, fuel_state="gas", gravity="0g", flow_cm_s=air)
        normalized["nozzle_mm"] = to_float(row.get("Nozzle (mm)"))
        normalized["fuel_rate_sccm"] = rate
        normalized["fuel_rate_mg_s"] = to_float(row.get("Fuel Rate (mg/s)"))
        normalized["hc_fuel_rate_mg_s"] = to_float(row.get("HC Fuel Rate (mg/s)"))
        normalized["gmt_day"] = clean(row.get("GMT date"))
        normalized["gmt_ignition"] = ign
        normalized["gmt_flame_off"] = clean(row.get("GMT  Flame Off"))
        out.append(make_record("PSI-107", "SPICE", f"S{i}", row, normalized, anomalies,
                               row_index=i))
    return out


def load_psi159():
    """CFI-G -- 179 tests separating cool flames from hot ignition."""
    _, rows = read_csv("PSI-159_CFI-G.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies, flags = [], []
        fuel_raw = clean(row.get("Fuel"))
        substance, label, fraction = canonical_fuel(fuel_raw)
        tad_raw = clean(row.get("Tad (K)"))
        if tad_raw and "DIV/0" in tad_raw:
            anomalies.append("spreadsheet_division_error")

        cool_raw = clean(row.get("Cool flame?"))
        cool = None
        regime = None
        if cool_raw:
            cool = cool_raw.lower().startswith("yes")
            m = re.search(r"(PCI-[A-Za-z]+)", cool_raw)
            regime = m.group(1) if m else None
        comments = clean(row.get("Comments"))
        if comments and "direct cool" in comments.lower() and not cool_raw:
            # The comment describes a cool flame, but the "Cool flame?" column
            # is empty. We do not count it as recorded -- we flag the mismatch.
            flags.append("cool_flame_mentioned_in_comment_only")

        hot_raw = clean(row.get("Hot ignition"))
        hot = True if hot_raw == "Yes" else False if hot_raw == "No" else None
        burn = to_float(row.get("burn time (sec)"))
        termination = clean(row.get("Self-ext or flow term"))
        if hot is False and burn and burn > 0 and termination not in ("-", None):
            anomalies.append("inconsistent_ignition_record")

        cls = {"SE": "self_extinguished_gas", "FT": "flow_terminated", "-": "no_ignition_gas"}.get(termination)
        bar = to_float(row.get("approx p (bar)"))
        normalized = blank_normalized(
            fuel=label, material=label, material_raw=fuel_raw, substance=substance,
            fuel_fraction=fraction, fuel_state="gas", gravity="0g",
            o2_mole_fraction=to_float(row.get("XO2 before test")),
            pressure_kpa=round(bar * 100, 2) if bar else None,
            pressure_atm=round(bar * 0.986923, 4) if bar else None,
            burn_time_s=burn,
            temperature_c=to_float(row.get("Peak burner T (C )")),
            outcome=OUTCOME_LABELS.get(cls) if cls else termination,
            outcome_class=cls,
        )
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        normalized["fuel_rate_mg_s"] = to_float(row.get("mHC (mg/s)"))
        normalized["fuel_mole_fraction"] = to_float(row.get("Xf"))
        normalized["adiabatic_temp_k"] = None if (tad_raw and "DIV/0" in tad_raw) else to_float(tad_raw)
        normalized["cool_flame"] = cool
        normalized["pci_regime"] = regime
        normalized["hot_ignition"] = hot
        normalized["termination"] = termination
        normalized["comments"] = comments
        normalized["test_day"] = clean(row.get("Day"))
        out.append(make_record("PSI-159", "CFI-G", clean(row.get("Test")), row, normalized,
                               anomalies, flags, row_index=i))
    return out


LOADERS = [
    ("PSI-20", load_psi20), ("PSI-22", load_psi22), ("PSI-25", load_psi25),
    ("PSI-26", load_psi26), ("PSI-39", load_psi39), ("PSI-47", load_psi47),
    ("PSI-68", load_psi68), ("PSI-69", load_psi69), ("PSI-98", load_saffire1),
    ("PSI-99", load_saffire2), ("PSI-100", load_saffire3), ("PSI-101", load_psi101),
    ("PSI-107", load_psi107), ("PSI-159", load_psi159),
]
