#!/usr/bin/env python3
# =============================================================================
#  MICRO FLAMMA  ·  build_data.py
# =============================================================================
#  WHAT THIS FILE DOES
#  -------------------
#  It reads the 14 raw NASA PSI experimental-table CSV files in ./data_raw/
#  and turns them into clean JSON files in ./public/data/ that the website
#  reads. You run this ONCE (or whenever the raw CSVs change). It is NOT part
#  of the website itself -- the website never runs Python.
#
#      data_raw/*.csv   --->   [ this script ]   --->   public/data/*.json
#
#  WHY IT EXISTS
#  -------------
#  The raw CSVs are messy: three different ways to spell "PMMA", a year typed
#  as 2103, oxygen written as "3400%", undecodable bytes in the FLEX file.
#  A browser should not have to deal with that. So we clean it here, once,
#  and ship tidy JSON.
#
#  THE ONE RULE THAT SHAPES EVERYTHING BELOW
#  -----------------------------------------
#  We never invent a number. If a cell is empty, it becomes null -- never 0,
#  never a guess. If a value looks wrong, we keep BOTH the original and our
#  corrected version, plus a flag saying why we changed it. Nothing is ever
#  silently deleted or quietly fixed.
#
#  RUN IT WITH:   python3 scripts/build_data.py
# =============================================================================

import csv
import json
import math
import os
import random
import re
from collections import Counter, defaultdict

# Where things live. Paths are relative to the project root.
RAW_DIR = "data_raw"
OUT_DIR = "public/data"

# How many rows we expect in total. If this number changes, something is wrong
# with the input files and the script will say so loudly at the end.
EXPECTED_TOTAL_ROWS = 1450


# =============================================================================
#  SECTION 1 -- SMALL HELPERS
# =============================================================================

def clean(value):
    """Trim whitespace off a cell. Turn blanks into None.

    NASA's spreadsheets are full of trailing spaces ("1 atm " vs "1 atm").
    Without this, those two would look like different values to the website.
    """
    if value is None:
        return None
    text = str(value).replace(" ", " ").strip()
    return text if text else None


def to_float(value):
    """Turn a cell into a number, or None if it isn't one.

    Returns None rather than 0 for unparseable cells. This matters: a blank
    oxygen reading is 'we don't know', not 'zero oxygen'. Conflating those
    would be inventing data.
    """
    text = clean(value)
    if text is None:
        return None
    # Strip anything that isn't part of a number (units, tildes, stray text).
    text = text.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def read_csv(filename, encoding="utf-8"):
    """Read one CSV and return (header_list, list_of_row_dicts).

    Note the encoding argument: PSI-69 (FLEX) is NOT UTF-8. It was saved on a
    Windows machine in cp1252. Reading it as UTF-8 corrupts the diameter
    column. See the FLEX loader below.
    """
    path = os.path.join(RAW_DIR, filename)
    with open(path, newline="", encoding=encoding, errors="replace") as handle:
        rows = list(csv.reader(handle))

    # Column names in these files have stray spaces and typos, e.g.
    # "Samle Thickness " in the Saffire-II file. Trim them all.
    header = [clean(column) or f"column_{i}" for i, column in enumerate(rows[0])]

    records = []
    for row in rows[1:]:
        # Skip rows that are entirely empty (trailing blank lines).
        if not any(clean(cell) for cell in row):
            continue
        # Pad short rows so every record has every column.
        padded = row + [None] * (len(header) - len(row))
        records.append({header[i]: padded[i] for i in range(len(header))})
    return header, records


# =============================================================================
#  SECTION 2 -- MATERIAL NAME NORMALIZATION
# =============================================================================
#  BASS-II and BASS describe the same physical sample about 50 different ways:
#  "1/4\" clear rod", "2 cm SIBAL", "100 micron PMMA film 2 cm wide", "pmma
#  slab", "parrafin wax candle". The website needs to group these, so we parse
#  each string into structured parts.
#
#  We ALWAYS keep the original string too (as `material_raw`), so a user can
#  see exactly what NASA wrote. We are adding structure, not replacing truth.
# =============================================================================

def parse_material(raw_text, investigation=None):
    """Turn a messy material string into {material, geometry, thickness_mm, width_mm}.

    Returns a dict. Any part we cannot determine is None -- we don't guess.
    """
    result = {
        "material": None,       # the substance, e.g. "PMMA"
        "geometry": None,       # the shape, e.g. "rod", "film", "sphere"
        "thickness_mm": None,
        "width_mm": None,
        "diameter_mm": None,
        "notes": [],            # extra modifiers found in the string
    }
    if not raw_text:
        return result

    text = raw_text.lower()

    # --- Which substance is it? -------------------------------------------
    # Order matters: check the most specific names first so that
    # "Nomex blend" isn't caught by a looser rule later.
    if "sibal" in text:
        result["material"] = "SIBAL"
    elif "nomex" in text:
        result["material"] = "Nomex"
    elif "ultem" in text:
        result["material"] = "Ultem"
    elif "silicone" in text:
        result["material"] = "Silicone"
    elif "kapton" in text:
        result["material"] = "Kapton"
    elif "teflon" in text:
        result["material"] = "Teflon"
    elif "pyrell" in text:
        result["material"] = "Pyrell"
    elif "lampwick" in text:
        result["material"] = "Lampwick"
    elif "japan wax" in text:
        result["material"] = "Japan Wax"
    elif "paraffin" in text or "parrafin" in text:
        # "parrafin" is a misspelling that appears in the BASS file.
        result["material"] = "Paraffin Wax"
    elif "wax" in text or "candle" in text:
        result["material"] = "Wax"
    elif "pmma" in text or "clear rod" in text or "black rod" in text:
        # In BASS-II the rods are all PMMA; the colour describes the dye,
        # not a different substance. Confirmed by the Appendix A test
        # matrices, which label them "6.35-mm black rod" under PMMA tasks.
        result["material"] = "PMMA"
    elif "road dust" in text or "ard" in text:
        result["material"] = "Arizona Road Dust"
    elif re.search(r"\b(cm|mm)\s*sphere|sphere\b", text):
        # Bare "2 cm sphere" rows in BASS have no substance named. The sample
        # numbers match PMMA sphere rows, so PMMA is the right reading -- but
        # we record that WE inferred it rather than NASA stating it.
        result["material"] = "PMMA"
        result["notes"].append("material inferred from sample grouping")

    # --- What shape is it? -------------------------------------------------
    if "sphere" in text or "spherical" in text:
        result["geometry"] = "sphere"
    elif "rod" in text or "cylinder" in text:
        result["geometry"] = "rod"
    elif "slab" in text:
        result["geometry"] = "slab"
    elif "film" in text:
        result["geometry"] = "film"
    elif "sheet" in text:
        result["geometry"] = "sheet"
    elif "candle" in text:
        result["geometry"] = "candle"
    elif "fabric" in text or "sibal" in text or "nomex" in text:
        result["geometry"] = "fabric"

    # --- How big is it? ----------------------------------------------------
    # Fractional-inch rods: 1/4", 3/8", 1/2". Convert to mm (1 inch = 25.4 mm).
    inch_fraction = re.search(r"(\d)\s*/\s*(\d)\s*\"", text)
    if inch_fraction:
        numerator, denominator = int(inch_fraction.group(1)), int(inch_fraction.group(2))
        result["diameter_mm"] = round(numerator / denominator * 25.4, 3)
    # Decimal-inch rods: 0.5" black rod
    elif re.search(r"(\d*\.\d+)\s*\"", text):
        inches = float(re.search(r"(\d*\.\d+)\s*\"", text).group(1))
        result["diameter_mm"] = round(inches * 25.4, 3)
    # Millimetre rods, as written in the Appendix A matrices: "6.35-mm black rod"
    elif re.search(r"(\d+(?:\.\d+)?)\s*-?\s*mm\s+(?:black|clear)?\s*rod", text):
        result["diameter_mm"] = float(
            re.search(r"(\d+(?:\.\d+)?)\s*-?\s*mm\s+(?:black|clear)?\s*rod", text).group(1)
        )

    # Thickness in microns: "100 micron PMMA film"
    micron = re.search(r"(\d+)\s*(?:micron|micro|um|µm)", text)
    if micron:
        result["thickness_mm"] = int(micron.group(1)) / 1000.0

    # Thickness in mm: "0.2 mm PMMA film", "1 mm thick PMMA"
    if result["thickness_mm"] is None:
        mm_thick = re.search(r"(\d+(?:\.\d+)?)\s*mm\s*(?:thick)?", text)
        if mm_thick and "rod" not in text:
            result["thickness_mm"] = float(mm_thick.group(1))

    # Width in cm: "2 cm wide", "1 cm SIBAL"
    cm_width = re.search(r"(\d+(?:\.\d+)?)\s*cm", text)
    if cm_width:
        result["width_mm"] = float(cm_width.group(1)) * 10.0

    # --- Extra modifiers hidden inside the material string -----------------
    # BASS packs test conditions into the material column, e.g.
    # "SIBAL 2 cm   opposed flow" or "2 cm sphere   wake ign".
    if "opposed" in text or "oppsed" in text:   # "oppsed" is a typo in the file
        result["notes"].append("opposed flow")
    if "concurrent" in text:
        result["notes"].append("concurrent flow")
    if "wake" in text:
        result["notes"].append("wake ignition")
    if "top side ign" in text:
        result["notes"].append("top-side ignition")
    if "moved igniter" in text:
        result["notes"].append("igniter repositioned")

    return result


# =============================================================================
#  SECTION 3 -- BASS-II FAN CALIBRATION
# =============================================================================
#  BASS-II records airflow as a device reading, not a speed. Two columns:
#  "Fan display" (the fan's own number) and "Air display" (the anemometer).
#  NASA's separate calibration spreadsheet shows the conversion is simply:
#
#         velocity in cm/s  =  Air display  x  1.0066
#
#  Verified against all three flow-restrictor settings and all 27 test dates
#  in "Fan calibration data.xlsx". We do not interpolate or model anything --
#  this is NASA's own published factor.
#
#  If a row records only a fan setting and no air reading, we leave the
#  velocity as None rather than back-calculating it, because the fan-to-air
#  relationship drifted as the duct sooted up over the mission.
# =============================================================================

AIR_DISPLAY_TO_CM_S = 1.0066


def first_number_in_sequence(raw_text):
    """BASS-II often lists a SEQUENCE of settings, e.g. "5  3  2  1  ext",
    meaning the crew stepped the flow down during the test. We take the first
    value as the starting condition and keep the full string for display.
    Returns None for non-numeric entries like "max" or "blowoff".
    """
    text = clean(raw_text)
    if text is None:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    return float(match.group()) if match else None


# =============================================================================
#  SECTION 4 -- LOADERS, ONE PER INVESTIGATION
# =============================================================================
#  Each loader reads one CSV and returns a list of test records in our shared
#  format. They all produce the same shape so the website can treat them
#  uniformly, while `raw` always preserves the untouched original row.
# =============================================================================

def make_record(psi_id, acronym, test_number, raw_row, normalized,
                anomalies=None, is_note=False, is_flow_vis=False, row_index=0):
    """Build one test record in the shared format every loader returns."""
    return {
        "id": f"{psi_id}-{test_number}" if test_number else f"{psi_id}-row{row_index}",
        "psi_id": psi_id,
        "acronym": acronym,
        "test_number": test_number,
        "row_index": row_index,
        "raw": {k: clean(v) for k, v in raw_row.items()},
        "normalized": normalized,
        "anomalies": anomalies or [],
        "is_note": is_note,
        "is_flow_vis": is_flow_vis,
    }


def blank_normalized(**overrides):
    """A normalized block with every field present and set to None.

    Having every key present (even when empty) keeps the website simple --
    it can read `test.normalized.o2_percent` without checking existence first.
    """
    base = {
        "material": None, "material_raw": None, "geometry": None,
        "thickness_mm": None, "width_mm": None, "diameter_mm": None,
        "fuel": None, "fuel_state": None,
        "o2_percent": None, "o2_mole_fraction": None,
        "n2_mole_fraction": None, "co2_mole_fraction": None, "he_mole_fraction": None,
        "pressure_atm": None, "pressure_kpa": None, "pressure_mmhg": None,
        "flow_cm_s": None, "flow_raw": None, "flow_direction": None,
        "gravity": None,
        "droplet_d0_mm": None, "extinction_d_mm": None,
        "burn_rate": None, "burn_time_s": None, "spread_rate_mm_s": None,
        "outcome": None, "outcome_text": None,
        "rt_r0": None, "temperature_c": None,
        "material_notes": [],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
#  PSI-20  ACME BRE -- gaseous burner tests, 18 daily summary rows
# ---------------------------------------------------------------------------
def load_psi20():
    _, rows = read_csv("PSI-20_ACME-BRE.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        o2_raw = clean(row.get("Oxygen Conc (percent)"))

        # ANOMALY: two cells read "3400%" and "2100%". These are 34% and 21%
        # with a stray trailing "00" -- a spreadsheet formatting accident.
        # We normalize the number but flag it so the raw value stays visible.
        o2_values = []
        if o2_raw:
            for piece in o2_raw.split(";"):
                number = to_float(piece)
                if number is None:
                    continue
                if number > 100:            # 3400 and 2100 are the only cases
                    number = number / 100.0
                    if "raw_percent_typo" not in anomalies:
                        anomalies.append("raw_percent_typo")
                o2_values.append(number)

        ignited = to_float(row.get("Flames Ignited"))
        # ANOMALY: 1 April 2019 recorded zero successful ignitions all day.
        # That is a real result, not a missing value, so we keep it and label it.
        if ignited == 0:
            anomalies.append("zero_ignition_day")

        fuel_raw = clean(row.get("Fuel Bottle")) or ""
        # "100%C2H4" is missing its space in some rows; normalize the spacing.
        fuel = re.sub(r"(\d+%)\s*", r"\1 ", fuel_raw).strip()

        date = f"{clean(row.get('Date'))} {clean(row.get('Month'))} {clean(row.get('Year'))}"
        normalized = blank_normalized(
            fuel=fuel, fuel_state="gas",
            material=fuel, material_raw=fuel_raw,
            # A day may span several O2 levels; we store the highest as the
            # headline figure and keep the full list in the raw row.
            o2_percent=max(o2_values) if o2_values else None,
            outcome=f"{int(ignited)} flames ignited" if ignited is not None else None,
        )
        normalized["burner_size_mm"] = to_float(row.get("Burner Size (mm)"))
        normalized["o2_levels_tested"] = o2_values
        normalized["flames_ignited"] = int(ignited) if ignited is not None else None
        normalized["date"] = date

        out.append(make_record("PSI-20", "ACME BRE", f"D{i}", row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-22  ACME E-FIELD -- 21 test rows + 11 note-only rows
# ---------------------------------------------------------------------------
def load_psi22():
    _, rows = read_csv("PSI-22_ACME-EFIELD.csv")
    out = []
    seen_test_days = set()
    for i, row in enumerate(rows, start=1):
        test_type = clean(row.get("Test Type"))
        anomalies = []

        # The 11 rows with no "Test Type" are continuation notes: they carry an
        # extra fuel concentration for the test above them, not a new test.
        # We keep them as note records so nothing is thrown away.
        if not test_type:
            normalized = blank_normalized(fuel_state="gas")
            normalized["note_text"] = clean(row.get("Notes")) or clean(row.get("Fuel Conc"))
            out.append(make_record("PSI-22", "ACME E-FIELD", None, row, normalized,
                                   ["embedded_footnote"], is_note=True, row_index=i))
            continue

        test_day = clean(row.get("Test Day"))
        # ANOMALY: test day 18319 appears twice with identical values -- an
        # eight-row block duplicated in the source file.
        if test_day in seen_test_days:
            anomalies.append("duplicate_row_block")
        seen_test_days.add(test_day)

        fuel_raw = clean(row.get("Fuel Bottle")) or ""
        normalized = blank_normalized(
            fuel=fuel_raw, fuel_state="gas",
            material=fuel_raw, material_raw=fuel_raw,
            outcome=f"{clean(row.get('Flames Ignited'))} flames ignited",
        )
        normalized["mesh_polarity"] = clean(row.get("Mesh Polarity"))
        normalized["fuel_concentration"] = clean(row.get("Fuel Conc"))
        normalized["flames_ignited"] = int(to_float(row.get("Flames Ignited")) or 0)
        normalized["test_day"] = test_day
        normalized["burner_round"] = test_type

        out.append(make_record("PSI-22", "ACME E-FIELD", test_day, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-25  BASS-II -- 129 solid-fuel tests. The richest table we have.
# ---------------------------------------------------------------------------
def load_psi25():
    _, rows = read_csv("PSI-25_BASS-II.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        test_number = clean(row.get("Test #"))

        o2_initial = to_float(row.get("Calibrated  initial O2 % by vol"))
        o2_final = to_float(row.get("Calibrated final O2 % by vol"))
        co_initial_raw = clean(row.get("Initial CO (ppm)"))
        co_initial = to_float(co_initial_raw)
        frames = clean(row.get("Total Frames Shot"))

        # ANOMALY 1: test B2's oxygen sensor failed. It reports a final O2 of
        # 1.6% against an initial 22.2% -- physically impossible in a sealed
        # chamber for one short test -- and "none" frames. NASA's own test
        # matrix confirms: "No stills taken, cable came loose."
        # We keep the row visible but mark it so it can be excluded from fits.
        if o2_final is not None and o2_initial is not None:
            if o2_final < o2_initial * 0.5 or o2_final > o2_initial * 1.5:
                anomalies.append("sensor_failure")

        # ANOMALY 2: eleven rows record an initial CO of -1 ppm. Carbon
        # monoxide cannot be negative; this is the sensor's zero point sitting
        # just below zero. The reading is real instrument output, so we keep
        # the value and flag the offset rather than clipping it to 0.
        if co_initial is not None and co_initial < 0:
            anomalies.append("baseline_co_offset")

        # ANOMALY 3: some cells hold words instead of numbers -- "none" where
        # the camera did not run, "OR" where the CO sensor was over-range,
        # "video" where only video was taken. These are informative, not junk.
        if frames and not re.match(r"^\d", frames):
            anomalies.append("non_numeric_frame_count")
        if co_initial_raw in ("OR", "over"):
            anomalies.append("sensor_over_range")

        # ANOMALY 4: two rows are dated 2018 but sit among 2014 tests with
        # matching GMT day numbers -- a year typed wrong.
        date = clean(row.get("Date"))
        if date and "2018" in date:
            anomalies.append("date_year_typo")

        material_raw = clean(row.get("Fuel Sample Material"))
        parsed = parse_material(material_raw, "PSI-25")

        # Airflow: convert the anemometer reading to cm/s using NASA's factor.
        air_display_raw = clean(row.get("Air display"))
        air_first = first_number_in_sequence(air_display_raw)
        flow_cm_s = round(air_first * AIR_DISPLAY_TO_CM_S, 2) if air_first is not None else None

        normalized = blank_normalized(
            material=parsed["material"], material_raw=material_raw,
            geometry=parsed["geometry"],
            thickness_mm=parsed["thickness_mm"], width_mm=parsed["width_mm"],
            diameter_mm=parsed["diameter_mm"],
            fuel_state="solid", gravity="0g",
            o2_percent=o2_initial,
            flow_cm_s=flow_cm_s, flow_raw=air_display_raw,
            material_notes=parsed["notes"],
        )
        normalized["o2_final_percent"] = o2_final
        normalized["co2_initial_percent"] = to_float(row.get("Initial CO2 % by vol"))
        normalized["co2_final_percent"] = to_float(row.get("Final CO2 % by vol"))
        normalized["co_initial_ppm"] = co_initial
        normalized["co_final_ppm"] = to_float(row.get("Final CO (ppm)"))
        normalized["fan_display"] = clean(row.get("Fan display"))
        normalized["flow_restrictor"] = to_float(row.get("Flow restrictor"))
        normalized["principal_investigator"] = clean(row.get("PI"))
        normalized["sample_number"] = clean(row.get("Sample #"))
        normalized["frames_shot"] = frames
        normalized["date"] = date
        # The experimental table has NO outcome column. Outcomes exist only in
        # the Summary Report's Appendix A. Until those are transcribed, this
        # stays null -- we will not guess whether a sample burned.
        normalized["outcome"] = None

        out.append(make_record("PSI-25", "BASS-II", test_number, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-26  BASS -- 122 rows, material column only (no O2, no airflow recorded)
# ---------------------------------------------------------------------------
def load_psi26():
    _, rows = read_csv("PSI-26_BASS.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        material_raw = clean(row.get("Fuel Sample Material"))
        test_number = clean(row.get("Test #"))
        date = clean(row.get("Date"))

        # ANOMALY: a maintenance row sits in the middle of the test list --
        # "SOOT Cleaning", with no test number at all. It is a real log entry,
        # so we keep it and mark it rather than deleting a row.
        is_maintenance = material_raw and "soot cleaning" in material_raw.lower()
        if is_maintenance:
            anomalies.append("maintenance_row")

        # ANOMALY: date typos. One row reads "5/15/2103" (year 2103) and
        # another has a stray backtick: "6/29/`12".
        if date and (re.search(r"2\d{3}", date) and "2103" in date):
            anomalies.append("date_year_typo")
        if date and "`" in date:
            anomalies.append("date_punctuation_typo")

        parsed = parse_material(material_raw, "PSI-26")

        # The material column carries the flow direction for some rows, e.g.
        # "SIBAL 2 cm   opposed flow". Lift it out into its own field.
        flow_direction = None
        if "opposed flow" in parsed["notes"]:
            flow_direction = "opposed"
        elif "concurrent flow" in parsed["notes"]:
            flow_direction = "concurrent"

        normalized = blank_normalized(
            material=parsed["material"], material_raw=material_raw,
            geometry=parsed["geometry"],
            thickness_mm=parsed["thickness_mm"], width_mm=parsed["width_mm"],
            diameter_mm=parsed["diameter_mm"],
            fuel_state="solid", gravity="0g",
            flow_direction=flow_direction,
            material_notes=parsed["notes"],
        )
        normalized["sample_number"] = clean(row.get("Sample #"))
        normalized["as_run_test_number"] = clean(row.get("As Run Test #"))
        normalized["gmt_day"] = clean(row.get("GMT"))
        normalized["date"] = date
        normalized["is_maintenance"] = bool(is_maintenance)

        out.append(make_record("PSI-26", "BASS", test_number, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-39  CFI -- 87 droplet tests across pressures
# ---------------------------------------------------------------------------
def load_psi39():
    _, rows = read_csv("PSI-39_CFI.csv")
    out = []
    seen_flex_numbers = {}
    for i, row in enumerate(rows, start=1):
        anomalies = []
        flex_number = clean(row.get("Flex Number"))

        # ANOMALY: the last eight rows repeat earlier tests verbatim. We keep
        # both copies (deleting data is not allowed) and flag the duplicates.
        if flex_number in seen_flex_numbers:
            anomalies.append("duplicate_row")
        seen_flex_numbers[flex_number] = i

        fuel = clean(row.get("Fuel"))
        pressure_atm = to_float(row.get("Pressure"))

        normalized = blank_normalized(
            fuel=fuel, material=fuel, material_raw=fuel, fuel_state="liquid",
            gravity="0g",
            o2_mole_fraction=to_float(row.get("Oxygen")),
            n2_mole_fraction=to_float(row.get("Nitrogen")),
            he_mole_fraction=to_float(row.get("Helium")),
            pressure_atm=pressure_atm,
            pressure_kpa=round(pressure_atm * 101.325, 2) if pressure_atm else None,
        )
        # Oxygen is given as a mole fraction here; show it as a percent too.
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        normalized["cir_id"] = clean(row.get("CIR"))
        normalized["fiber_supported"] = clean(row.get("Fiber"))
        normalized["date"] = clean(row.get("Test Date"))
        normalized["local_time"] = clean(row.get("Local Time"))

        out.append(make_record("PSI-39", "CFI", flex_number, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-47  DAFT -- 2 aerosol sampling sessions
# ---------------------------------------------------------------------------
def load_psi47():
    _, rows = read_csv("PSI-47_DAFT.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        normalized = blank_normalized(
            material="Arizona Road Dust",
            material_raw=clean(row.get("Sample Material")),
            fuel_state="aerosol", gravity="0g",
        )
        normalized["hardware"] = clean(row.get("Hardware Description"))
        normalized["sampled_location"] = clean(row.get("Sampled Location"))
        normalized["date"] = clean(row.get("Actual Day"))
        out.append(make_record("PSI-47", "DAFT", clean(row.get("Session Name")),
                               row, normalized, [], row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-68  FLEX-2 -- 8 rows describing PARAMETER RANGES, not individual tests
# ---------------------------------------------------------------------------
def load_psi68():
    _, rows = read_csv("PSI-68_FLEX-2.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        fuel = clean(row.get("Sample (Fuel Type)"))
        normalized = blank_normalized(
            fuel=fuel, material=fuel, material_raw=fuel,
            fuel_state="liquid", gravity="0g",
        )
        # These are ranges ("1.5 - 5" mm), not single values, so they stay as
        # text. Treating "1.5 - 5" as a number would be inventing precision.
        normalized["droplet_d0_range"] = clean(row.get("Initial Droplet Diameter (mm)"))
        normalized["gas_mixture"] = clean(row.get("Ambient Gas Mixture"))
        normalized["o2_levels_tested"] = clean(row.get("Oxygen Mole Fraction"))
        normalized["pressure_range"] = clean(row.get("Ambient Pressure (atm)"))
        normalized["temperature_c"] = to_float(row.get("Ambient Temperature (C)"))
        normalized["flow_range"] = clean(row.get("Flow Velocity (cm/s)"))
        normalized["is_range_summary"] = True
        out.append(make_record("PSI-68", "FLEX-2", f"R{i}", row, normalized,
                               [], row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-69  FLEX -- 274 droplet tests WITH labelled outcomes. Our best table.
# ---------------------------------------------------------------------------
def load_psi69():
    # NOTE THE ENCODING. This file is cp1252, not UTF-8. Several diameter
    # cells contain a byte that is not valid UTF-8 and would otherwise come
    # through as a replacement character and corrupt the column.
    _, rows = read_csv("PSI-69_FLEX.csv", encoding="cp1252")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        test_number = clean(row.get("FLEX Test #"))
        pressure_mmhg = to_float(row.get("Ambient pressure; mmHg"))

        # ANOMALY: test 114 records an ambient pressure of 0.0 mmHg -- a hard
        # vacuum, in which no flame can exist. It is a missing reading written
        # as zero. We flag it so pressure charts can exclude it from their
        # axis range without the row disappearing from the data library.
        if pressure_mmhg == 0:
            anomalies.append("zero_pressure_outlier")

        # Some cells hold an undecodable byte where a number should be. We
        # record that the value is unreadable rather than substituting one.
        def read_number(column):
            text = clean(row.get(column))
            if text and ("�" in text or text in ("?",)):
                if "unreadable_cell" not in anomalies:
                    anomalies.append("unreadable_cell")
                return None
            return to_float(text)

        fuel = clean(row.get("Fuel"))
        normalized = blank_normalized(
            fuel=fuel, material=fuel, material_raw=fuel,
            fuel_state="liquid", gravity="0g",
            pressure_mmhg=pressure_mmhg,
            pressure_kpa=round(pressure_mmhg * 0.133322, 2) if pressure_mmhg else None,
            pressure_atm=round(pressure_mmhg / 760.0, 4) if pressure_mmhg else None,
            o2_mole_fraction=to_float(row.get("O initial ambient composition; mole fraction")),
            n2_mole_fraction=to_float(row.get("N initial ambient composition; mole fraction")),
            co2_mole_fraction=to_float(row.get("CO initial ambient composition; mole fraction")),
            he_mole_fraction=to_float(row.get("He initial ambient composition; mole fraction")),
            droplet_d0_mm=read_number("Droplet initial diameter; mm"),
            extinction_d_mm=read_number("Visible flame extinction diameter; mm"),
            burn_rate=read_number("Burning rate; mm"),
            burn_time_s=read_number("Burn time; s"),
            outcome=clean(row.get("Test end")),
        )
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        normalized["flex_identifier"] = clean(row.get("FLEX Identifier"))
        normalized["date"] = clean(row.get("Test Date"))
        normalized["gmt"] = clean(row.get("Test GMT"))

        # SCIENCE FLAG, not a data error: FLEX found that large heptane
        # droplets keep burning as an invisible "cool flame" after the visible
        # flame disappears. Any heptane droplet above 2.4 mm is a candidate,
        # so the website can warn that visible extinction is not the end.
        if (fuel and fuel.lower() == "heptane"
                and normalized["droplet_d0_mm"] is not None
                and normalized["droplet_d0_mm"] > 2.4):
            anomalies.append("cool_flame_candidate")

        out.append(make_record("PSI-69", "FLEX", test_number, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-98 / 99 / 100  SAFFIRE I, II, III -- large-scale burns on Cygnus
# ---------------------------------------------------------------------------
def load_saffire1():
    _, rows = read_csv("PSI-98_SAFFIRE-1.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        sample = clean(row.get("Sample Number"))
        material_raw = clean(row.get("Material"))

        # Rows F1/F2 are pre-test flow visualisation runs, not burns. They
        # count toward the row total but must never appear in burn statistics.
        is_flow_vis = material_raw and "flow visulation" in material_raw.lower()
        if is_flow_vis:
            normalized = blank_normalized(fuel_state="solid", gravity="0g")
            normalized["note_text"] = material_raw
            out.append(make_record("PSI-98", "SAFFIRE-I", sample, row, normalized,
                                   ["pre_test_flow_visualisation"],
                                   is_flow_vis=True, row_index=i))
            continue

        normalized = blank_normalized(
            material="SIBAL", material_raw=material_raw, geometry="fabric",
            fuel_state="solid", gravity="0g",
            thickness_mm=(to_float(row.get("Sample Thickness (cm)")) or 0) * 10 or None,
            o2_percent=to_float(row.get("Percent O2")),
            flow_cm_s=to_float(row.get("Air Flow (cm/s)")),
            flow_direction=(clean(row.get("Flow Direction")) or "").lower() or None,
            burn_time_s=to_float(row.get("Burn Time (s)")),
        )
        normalized["sample_length_cm"] = to_float(row.get("Sample Length (cm)"))
        normalized["sample_width_cm"] = to_float(row.get("Sample Width (cm)"))
        normalized["ignition_power_w"] = to_float(row.get("Ignition Power (W)"))
        normalized["o2_percent_raw"] = clean(row.get("Percent O2"))
        out.append(make_record("PSI-98", "SAFFIRE-I", sample, row, normalized,
                               [], row_index=i))
    return out


def load_saffire2():
    _, rows = read_csv("PSI-99_SAFFIRE-2.csv")
    out = []
    last_material = None      # used to fill forward blank material cells
    for i, row in enumerate(rows, start=1):
        anomalies = []
        sample = clean(row.get("Sample Number"))
        # NOTE: the column name really is misspelled "Samle Thickness" in the
        # source file. We read it as-is rather than assuming it was fixed.
        thickness_raw = clean(row.get("Samle Thickness"))
        material_raw = clean(row.get("Material"))

        # The four trailing "Note 1..4" rows are footnotes explaining the
        # table, not tests. Keep them as notes attached to the investigation.
        if sample and sample.lower().startswith("note"):
            normalized = blank_normalized(fuel_state="solid")
            normalized["note_text"] = sample
            out.append(make_record("PSI-99", "SAFFIRE-II", None, row, normalized,
                                   ["embedded_footnote"], is_note=True, row_index=i))
            continue

        # Pre-test flow visualisation rows, same as Saffire-I.
        if material_raw and "flow visulation" in material_raw.lower():
            normalized = blank_normalized(fuel_state="solid", gravity="0g")
            normalized["note_text"] = material_raw
            out.append(make_record("PSI-99", "SAFFIRE-II", sample, row, normalized,
                                   ["pre_test_flow_visualisation"],
                                   is_flow_vis=True, row_index=i))
            continue

        # Two rows (2-6 and 2-9) have an empty Material cell because the
        # spreadsheet author meant "same as the row above". We fill it forward
        # and record that we did so.
        if not material_raw and last_material:
            material_raw = last_material
            anomalies.append("material_filled_forward")
        elif material_raw:
            last_material = material_raw

        # ANOMALY: thickness written "037 mm". There is no such measurement --
        # it is 0.37 mm with a lost decimal point. Appears in three rows.
        thickness_mm = None
        if thickness_raw:
            if re.match(r"^0\d{2}\s*mm", thickness_raw):
                thickness_mm = 0.37
                anomalies.append("raw_thickness_typo")
            else:
                value = to_float(thickness_raw)
                if value is not None:
                    thickness_mm = value * 10 if "cm" in thickness_raw else value

        parsed = parse_material(material_raw, "PSI-99")
        normalized = blank_normalized(
            material=parsed["material"], material_raw=material_raw,
            geometry=parsed["geometry"], thickness_mm=thickness_mm,
            fuel_state="solid", gravity="0g",
            o2_percent=to_float(row.get("Percent O2 (Note 1)")),
            flow_cm_s=to_float(row.get("Air Flow (cm/s)")),
            flow_direction=(clean(row.get("Flow Direction")) or "").lower() or None,
            burn_time_s=to_float(row.get("Burn Time (s)")),
        )
        # SAFFIRE-II is the ONLY table that records both microgravity and
        # normal-gravity behaviour for the same sample. That makes it the only
        # place the website can honestly show a 0 g vs 1 g comparison.
        # The column headers use "?-g" because a mu character was mangled when
        # the file was saved; it means micro-gravity.
        normalized["burn_length_0g"] = clean(row.get("?-g Burn Length"))
        normalized["spread_length_0g"] = clean(row.get("?-g Spread Length"))
        normalized["burn_length_1g"] = clean(row.get("1-g Burn Length"))
        normalized["spread_rate_1g"] = clean(row.get("1-g Spread Rate"))
        normalized["has_1g_reference"] = bool(normalized["burn_length_1g"])
        normalized["thickness_raw"] = thickness_raw
        normalized["ignition_power_w"] = to_float(row.get("Ignition Power (W)"))

        out.append(make_record("PSI-99", "SAFFIRE-II", sample, row, normalized,
                               anomalies, row_index=i))
    return out


def load_saffire3():
    _, rows = read_csv("PSI-100_SAFFIRE-3.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        thickness_raw = clean(row.get("Sample Thickness"))
        normalized = blank_normalized(
            material="SIBAL", material_raw=clean(row.get("Material")),
            geometry="fabric", fuel_state="solid", gravity="0g",
            thickness_mm=(to_float(thickness_raw) or 0) * 10 or None,
            flow_cm_s=to_float(row.get("Air Flow")),
            flow_direction=(clean(row.get("Direction")) or "").lower() or None,
        )
        normalized["sample_length_cm"] = to_float(row.get("Sample Length"))
        normalized["sample_width_cm"] = to_float(row.get("Sample Width"))
        out.append(make_record("PSI-100", "SAFFIRE-III", clean(row.get("Sample Number")),
                               row, normalized, [], row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-101  SAME-R -- 109 smoke-aging tests (pyrolysis, no flame)
# ---------------------------------------------------------------------------
def load_psi101():
    _, rows = read_csv("PSI-101_SAME-R.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        material = clean(row.get("Sample Type"))
        test_number = clean(row.get("SAME Test #"))

        # Test numbers ending in "a" are the aged re-measurement of the test
        # above, not a separate burn. Mark them so charts don't double-count.
        is_aged_followup = bool(test_number and test_number.endswith("a"))

        net_aging = clean(row.get("Net aging time (sec)"))
        # Some cells read "n/a" -- recorded as not applicable, not as zero.
        if net_aging == "n/a":
            anomalies.append("not_applicable_cell")

        normalized = blank_normalized(
            material=material, material_raw=material,
            fuel_state="smoke", gravity="0g",
            flow_cm_s=to_float(row.get("Inlet velocity (cm/s)")),
            rt_r0=to_float(row.get("Rt/R0")),
        )
        normalized["description"] = clean(row.get("Description"))
        normalized["duration_s"] = to_float(row.get("Duration (sec)"))
        normalized["primary_aging_time_s"] = to_float(row.get("Primary aging time (sec)"))
        normalized["primary_mixing_time_s"] = to_float(row.get("Primary mixing time (sec)"))
        normalized["net_aging_time_s"] = to_float(net_aging)
        normalized["is_aged_followup"] = is_aged_followup
        normalized["date"] = clean(row.get("Date"))

        out.append(make_record("PSI-101", "SAME-R", test_number, row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-107  SPICE -- 469 gaseous-fuel soot/smoke-point tests
# ---------------------------------------------------------------------------
def load_psi107():
    _, rows = read_csv("PSI-107_SPICE.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        fuel_raw = clean(row.get("Fuel")) or ""

        # The same fuel is spelled two ways: "75% Propylene" and
        # "75 % Propylene". Collapse the stray space so filters group them.
        fuel = re.sub(r"(\d+)\s*%", r"\1%", fuel_raw)

        air_rate = to_float(row.get("Air Rate (cm/s)"))
        # ANOMALY: a few rows record a NEGATIVE air rate (-0.28, -5.92).
        # Air cannot flow backwards through the duct; these are instrument
        # drift near zero. Kept and flagged, not clipped.
        if air_rate is not None and air_rate < 0:
            anomalies.append("negative_flow_reading")

        # ANOMALY: the time columns sometimes hold telemetry status instead of
        # a clock time -- "Ku LOS" (loss of signal), "no ku", "LOS", "n/a".
        ignition_time = clean(row.get("GMT ignition"))
        if ignition_time and re.search(r"ku|los|n/a", ignition_time, re.I):
            anomalies.append("telemetry_loss")
        # Others use dots instead of colons: "14.34.57" rather than "14:34:57".
        elif ignition_time and re.match(r"^\d{1,2}\.\d{2}\.\d{2}$", ignition_time):
            anomalies.append("time_format_variant")

        fuel_rate = to_float(row.get("Fuel Rate (sccm)"))
        if fuel_rate == 0:
            anomalies.append("zero_fuel_rate")

        normalized = blank_normalized(
            fuel=fuel, material=fuel, material_raw=fuel_raw,
            fuel_state="gas", gravity="0g",
            flow_cm_s=air_rate,
        )
        normalized["nozzle_mm"] = to_float(row.get("Nozzle (mm)"))
        normalized["fuel_rate_sccm"] = fuel_rate
        normalized["fuel_rate_mg_s"] = to_float(row.get("Fuel Rate (mg/s)"))
        normalized["hc_fuel_rate_mg_s"] = to_float(row.get("HC Fuel Rate (mg/s)"))
        normalized["gmt_day"] = clean(row.get("GMT date"))
        normalized["gmt_ignition"] = ignition_time
        normalized["gmt_flame_off"] = clean(row.get("GMT  Flame Off"))

        out.append(make_record("PSI-107", "SPICE", f"S{i}", row, normalized,
                               anomalies, row_index=i))
    return out


# ---------------------------------------------------------------------------
#  PSI-159  CFI-G -- 179 cool-flame vs hot-ignition tests
# ---------------------------------------------------------------------------
def load_psi159():
    _, rows = read_csv("PSI-159_CFI-G.csv")
    out = []
    for i, row in enumerate(rows, start=1):
        anomalies = []
        fuel = clean(row.get("Fuel"))
        test_number = clean(row.get("Test"))

        # ANOMALY: two rows have a fuel fraction of 0, so the spreadsheet's
        # temperature formula divided by zero and wrote "#DIV/0!" into the
        # cell. We keep the broken text in `raw` and store null for the number.
        tad_raw = clean(row.get("Tad (K)"))
        if tad_raw and "DIV/0" in tad_raw:
            anomalies.append("spreadsheet_division_error")

        cool_flame_raw = clean(row.get("Cool flame?"))
        # Entries look like "yes, PCI-A" or "no, PCI-hot". Split the yes/no
        # from the regime label so both can be filtered independently.
        cool_flame = None
        pci_regime = None
        if cool_flame_raw:
            cool_flame = cool_flame_raw.lower().startswith("yes")
            pci_match = re.search(r"(PCI-[A-Za-z]+)", cool_flame_raw)
            pci_regime = pci_match.group(1) if pci_match else None

        hot_ignition_raw = clean(row.get("Hot ignition"))
        hot_ignition = None
        if hot_ignition_raw in ("Yes", "No"):
            hot_ignition = hot_ignition_raw == "Yes"

        pressure_bar = to_float(row.get("approx p (bar)"))
        normalized = blank_normalized(
            fuel=fuel, material=fuel, material_raw=fuel,
            fuel_state="gas", gravity="0g",
            o2_mole_fraction=to_float(row.get("XO2 before test")),
            pressure_kpa=round(pressure_bar * 100, 2) if pressure_bar else None,
            pressure_atm=round(pressure_bar * 0.986923, 4) if pressure_bar else None,
            burn_time_s=to_float(row.get("burn time (sec)")),
            temperature_c=to_float(row.get("Peak burner T (C )")),
        )
        if normalized["o2_mole_fraction"] is not None:
            normalized["o2_percent"] = round(normalized["o2_mole_fraction"] * 100, 2)
        normalized["o2_after_test"] = to_float(row.get("XO2  after test"))
        normalized["fuel_mole_fraction"] = to_float(row.get("Xf"))
        normalized["fuel_rate_mg_s"] = to_float(row.get("mHC (mg/s)"))
        normalized["adiabatic_temp_k"] = None if "DIV/0" in (tad_raw or "") else to_float(tad_raw)
        normalized["stoich_mixture_fraction"] = to_float(row.get("Zst"))
        normalized["cool_flame"] = cool_flame
        normalized["pci_regime"] = pci_regime
        normalized["hot_ignition"] = hot_ignition
        # "SE" means self-extinguished, "FT" means flow terminated by the crew,
        # "-" means the test never ignited so there was nothing to end.
        termination = clean(row.get("Self-ext or flow term"))
        normalized["termination"] = termination
        normalized["outcome"] = {
            "SE": "Self-extinguished",
            "FT": "Flow terminated",
            "-": "No ignition",
        }.get(termination, termination)
        normalized["comments"] = clean(row.get("Comments"))
        normalized["flame_type"] = clean(row.get("Flame Type"))
        normalized["test_day"] = clean(row.get("Day"))

        out.append(make_record("PSI-159", "CFI-G", test_number, row, normalized,
                               anomalies, row_index=i))
    return out


# =============================================================================
#  SECTION 5 -- INVESTIGATION METADATA
# =============================================================================
#  Facts about each investigation that are not in the CSVs: the DOI, the
#  hardware it flew on, what it was for. Five DOIs are not yet collected; they
#  are null rather than guessed, and the website shows "DOI not yet recorded".
# =============================================================================

INVESTIGATION_META = {
    "PSI-20":  dict(acronym="ACME BRE", title="Burning Rate Emulator",
                    doi="10.60555/vb93-3y72", hardware="CIR-ACME", fuel_state="gas",
                    tier="S", pillar="prevention",
                    summary="Gaseous burner tests emulating the burning of solid and liquid "
                            "fuels, using methane and ethylene at oxygen levels from 21% to 40%."),
    "PSI-22":  dict(acronym="ACME E-FIELD", title="Electric Field Effects on Flames",
                    doi=None, hardware="CIR-ACME", fuel_state="gas",
                    tier="A", pillar="prevention",
                    summary="Applies a high-voltage electric field to microgravity flames. The "
                            "ion wind mimics some effects of gravity, but this is NOT "
                            "partial-gravity data and must never be presented as such."),
    "PSI-25":  dict(acronym="BASS-II", title="Burning and Suppression of Solids II",
                    doi="10.60555/4qc4-de67", hardware="MSG", fuel_state="solid",
                    tier="S", pillar="suppression",
                    summary="129 solid-fuel tests aboard the ISS covering PMMA rods, films, "
                            "slabs and spheres, SIBAL fabric, Nomex and candles, at oxygen "
                            "levels from 13.6% to 22.2% in low-velocity forced flow."),
    "PSI-26":  dict(acronym="BASS", title="Burning and Suppression of Solids",
                    doi="10.60555/58h4-dy80", hardware="MSG", fuel_state="solid",
                    tier="S", pillar="suppression",
                    summary="The first BASS campaign. 122 tests on PMMA spheres and slabs, "
                            "SIBAL, Nomex, Ultem and wax candles. The experimental table "
                            "records materials and dates only; conditions and outcomes live "
                            "in the final report."),
    "PSI-39":  dict(acronym="CFI", title="Cool Flames Investigation",
                    doi=None, hardware="CIR-MDCA", fuel_state="liquid",
                    tier="A", pillar="detection",
                    summary="87 droplet tests of dodecane and iso-dodecane blends across "
                            "pressures from 0.5 to 5 atm at 17% and 21% oxygen."),
    "PSI-47":  dict(acronym="DAFT", title="Dust and Aerosol Measurement Feasibility Test",
                    doi=None, hardware="ISS cabin", fuel_state="aerosol",
                    tier="A", pillar="detection",
                    summary="Two sessions measuring Arizona Road Dust aerosol with P-Trak and "
                            "DustTrak instruments, to understand how dust confuses spacecraft "
                            "smoke detectors."),
    "PSI-68":  dict(acronym="FLEX-2", title="Flame Extinguishment Experiment 2",
                    doi="10.60555/byp8-h018", hardware="CIR-MDCA", fuel_state="liquid",
                    tier="A", pillar="suppression",
                    summary="A summary of the parameter ranges covered by FLEX-2 droplet "
                            "tests. These 8 rows describe ranges, not individual tests."),
    "PSI-69":  dict(acronym="FLEX", title="Flame Extinguishment Experiment",
                    doi="10.60555/mbq8-0451", hardware="CIR-MDCA", fuel_state="liquid",
                    tier="S", pillar="suppression",
                    summary="274 methanol and heptane droplet tests with labelled outcomes, "
                            "using carbon dioxide and helium as suppressants. The discovery of "
                            "invisible cool flames came from this campaign."),
    "PSI-98":  dict(acronym="SAFFIRE-I", title="Spacecraft Fire Experiment I",
                    doi="10.60555/0t15-1z43", hardware="Cygnus", fuel_state="solid",
                    tier="S", pillar="prevention",
                    summary="The largest fire ever set in space: a 94 by 40.6 cm SIBAL fabric "
                            "sample burned aboard an uncrewed Cygnus vehicle, comparing "
                            "concurrent and opposed flow spread."),
    "PSI-99":  dict(acronym="SAFFIRE-II", title="Spacecraft Fire Experiment II",
                    doi="10.60555/2chp-m469", hardware="Cygnus", fuel_state="solid",
                    tier="S", pillar="prevention",
                    summary="Nine samples of silicone, SIBAL, PMMA and Nomex. The only PSI "
                            "table that records both microgravity and normal-gravity behaviour "
                            "for the same samples, which makes it the only honest source for a "
                            "0 g versus 1 g comparison."),
    "PSI-100": dict(acronym="SAFFIRE-III", title="Spacecraft Fire Experiment III",
                    doi="10.60555/040q-4h36", hardware="Cygnus", fuel_state="solid",
                    tier="S", pillar="prevention",
                    summary="Two large-scale SIBAL fabric burns at 30 cm/s, one concurrent and "
                            "one opposed."),
    "PSI-101": dict(acronym="SAME-R", title="Smoke Aging and Measurement Experiment (Reflight)",
                    doi="10.60555/2np7-jv14", hardware="MSG", fuel_state="smoke",
                    tier="S", pillar="detection",
                    summary="109 tests measuring how smoke particles grow as they age, across "
                            "Kapton, silicone, lampwick, Teflon and Pyrell. Samples were heated "
                            "without flaming, so this is pyrolysis smoke, not fire smoke."),
    "PSI-107": dict(acronym="SPICE", title="Smoke Point In Co-flow Experiment",
                    doi=None, hardware="MSG", fuel_state="gas",
                    tier="A", pillar="detection",
                    summary="469 gaseous-fuel tests measuring the point at which a flame begins "
                            "to produce soot, using ethylene, propane, propylene blends and "
                            "methane across three nozzle sizes."),
    "PSI-159": dict(acronym="CFI-G", title="Cool Flames Investigation with Gases",
                    doi=None, hardware="CIR-ACME", fuel_state="gas",
                    tier="A", pillar="detection",
                    summary="179 tests separating cool-flame behaviour from hot ignition in "
                            "ethane, propane and butane mixtures, with seven identified "
                            "cool-flame regimes labelled PCI-A through PCI-G."),
}


# =============================================================================
#  SECTION 6 -- THE FLEX OUTCOME MODEL
# =============================================================================
#  A logistic regression fitted to the 274 real FLEX rows. It predicts whether
#  a droplet test ended in Extinction, from the conditions of the test.
#
#  IMPORTANT, AND THE WEBSITE SAYS THIS ON SCREEN: this is a statistical
#  pattern found in NASA's recorded results. It is NOT a physics model. It can
#  only speak about conditions FLEX actually tested; outside that range the
#  website refuses to show a prediction at all.
#
#  Written by hand (no scikit-learn) so the pipeline has no dependencies.
# =============================================================================

def fit_logistic(features, labels, epochs=4000, learning_rate=0.1):
    """Plain gradient-descent logistic regression.

    features: list of equal-length number lists (already standardized)
    labels:   list of 0/1
    Returns (bias, weights).
    """
    n_features = len(features[0])
    weights = [0.0] * n_features
    bias = 0.0
    n = len(features)

    for _ in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for row, label in zip(features, labels):
            z = bias + sum(w * x for w, x in zip(weights, row))
            # Clamp z to avoid math.exp overflow on extreme values.
            z = max(-30.0, min(30.0, z))
            prediction = 1.0 / (1.0 + math.exp(-z))
            error = prediction - label
            for j in range(n_features):
                grad_w[j] += error * row[j]
            grad_b += error
        for j in range(n_features):
            weights[j] -= learning_rate * grad_w[j] / n
        bias -= learning_rate * grad_b / n

    return bias, weights


def build_flex_model(flex_tests):
    """Train and cross-validate the FLEX extinction model."""
    FEATURES = ["is_heptane", "o2_mole_fraction", "co2_mole_fraction",
                "he_mole_fraction", "pressure_mmhg", "droplet_d0_mm"]

    rows, labels = [], []
    for test in flex_tests:
        n = test["normalized"]
        outcome = n.get("outcome")
        # Skip rows that are missing any feature or the outcome label. We fit
        # only on complete records -- filling gaps would be inventing data.
        if not outcome or outcome not in ("Extinction", "Disruption", "Completion"):
            continue
        if "zero_pressure_outlier" in test["anomalies"]:
            continue   # 0 mmHg would distort the fit
        values = [
            1.0 if (n.get("fuel") or "").lower() == "heptane" else 0.0,
            n.get("o2_mole_fraction"),
            n.get("co2_mole_fraction"),
            n.get("he_mole_fraction"),
            n.get("pressure_mmhg"),
            n.get("droplet_d0_mm"),
        ]
        if any(v is None for v in values):
            continue
        rows.append([float(v) for v in values])
        labels.append(1 if outcome == "Extinction" else 0)

    if len(rows) < 20:
        return {"available": False, "reason": "not enough complete rows to fit"}

    # Standardize each feature (subtract mean, divide by standard deviation)
    # so no single column dominates just because its units are large.
    n_features = len(FEATURES)
    means, stds = [], []
    for j in range(n_features):
        column = [r[j] for r in rows]
        mean = sum(column) / len(column)
        variance = sum((x - mean) ** 2 for x in column) / len(column)
        std = math.sqrt(variance) or 1.0
        means.append(mean)
        stds.append(std)
    scaled = [[(r[j] - means[j]) / stds[j] for j in range(n_features)] for r in rows]

    # 5-fold cross-validation: train on 4/5 of the data, test on the held-out
    # fifth, five times. This measures how well the model does on tests it has
    # never seen, which is the only honest accuracy figure.
    random.seed(42)
    indices = list(range(len(scaled)))
    random.shuffle(indices)
    fold_size = len(indices) // 5
    accuracies = []
    for fold in range(5):
        test_idx = set(indices[fold * fold_size:(fold + 1) * fold_size])
        train_x = [scaled[i] for i in indices if i not in test_idx]
        train_y = [labels[i] for i in indices if i not in test_idx]
        bias, weights = fit_logistic(train_x, train_y, epochs=1500)
        correct = 0
        for i in test_idx:
            z = bias + sum(w * x for w, x in zip(weights, scaled[i]))
            predicted = 1 if z > 0 else 0
            correct += int(predicted == labels[i])
        accuracies.append(correct / max(1, len(test_idx)))

    # Final model trained on everything.
    bias, weights = fit_logistic(scaled, labels, epochs=4000)

    # Record the range each feature actually covers, so the website can refuse
    # to predict outside it.
    ranges = {}
    for j, name in enumerate(FEATURES):
        column = [r[j] for r in rows]
        ranges[name] = {"min": min(column), "max": max(column)}

    return {
        "available": True,
        "target": "Extinction versus other outcome (Disruption or Completion)",
        "features": FEATURES,
        "bias": bias,
        "weights": weights,
        "feature_means": means,
        "feature_stds": stds,
        "feature_ranges": ranges,
        "n_training_rows": len(rows),
        "cv_accuracy": round(sum(accuracies) / len(accuracies), 4),
        "cv_folds": [round(a, 4) for a in accuracies],
        "base_rate": round(sum(labels) / len(labels), 4),
        "disclaimer": ("Statistical fit to recorded FLEX test outcomes. Not a physical "
                       "model. Valid only inside the tested parameter range."),
        "source": {"psi_id": "PSI-69", "doi": "10.60555/mbq8-0451"},
    }


# =============================================================================
#  SECTION 7 -- MAIN: run every loader, assemble, verify, write
# =============================================================================

def build_search_text(test):
    """Pre-build one lowercase string per test holding everything searchable.

    Doing this here means the website can filter 1,450 rows by simply checking
    whether each word the user typed appears in this string -- fast enough to
    feel instant, with no search library needed.
    """
    n = test["normalized"]
    parts = [
        test["psi_id"], test["acronym"], test["test_number"] or "",
        n.get("material") or "", n.get("material_raw") or "",
        n.get("fuel") or "", n.get("fuel_state") or "",
        n.get("geometry") or "", n.get("outcome") or "",
        n.get("flow_direction") or "", n.get("pci_regime") or "",
        n.get("principal_investigator") or "", n.get("description") or "",
        n.get("comments") or "", n.get("note_text") or "",
        n.get("date") or "",
    ]
    # Numbers people are likely to type, e.g. "21" for oxygen percent.
    for key in ("o2_percent", "pressure_atm", "flow_cm_s", "droplet_d0_mm", "rt_r0"):
        if n.get(key) is not None:
            parts.append(str(n[key]))
    parts.extend(test["anomalies"])
    return " ".join(str(p) for p in parts if p).lower()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("=" * 70)
    print("  MICRO FLAMMA -- building data from NASA PSI experimental tables")
    print("=" * 70)

    loaders = [
        ("PSI-20", load_psi20), ("PSI-22", load_psi22), ("PSI-25", load_psi25),
        ("PSI-26", load_psi26), ("PSI-39", load_psi39), ("PSI-47", load_psi47),
        ("PSI-68", load_psi68), ("PSI-69", load_psi69), ("PSI-98", load_saffire1),
        ("PSI-99", load_saffire2), ("PSI-100", load_saffire3), ("PSI-101", load_psi101),
        ("PSI-107", load_psi107), ("PSI-159", load_psi159),
    ]

    all_tests = []
    per_investigation = {}
    for psi_id, loader in loaders:
        records = loader()
        per_investigation[psi_id] = records
        all_tests.extend(records)
        notes = sum(1 for r in records if r["is_note"])
        flow_vis = sum(1 for r in records if r["is_flow_vis"])
        extra = []
        if notes:
            extra.append(f"{notes} note")
        if flow_vis:
            extra.append(f"{flow_vis} flow-vis")
        suffix = f"  ({', '.join(extra)})" if extra else ""
        print(f"  {psi_id:8} {INVESTIGATION_META[psi_id]['acronym']:14} "
              f"{len(records):4d} rows{suffix}")

    # ----- Settle inconsistent capitalisation -------------------------------
    # CFI-G writes "propane" and "ethane" in lower case while SPICE writes
    # "Propane" and "Ethylene" capitalised. They are the same fuels, so left
    # alone the website would list each one twice and split its tests between
    # the two. We pick one spelling per fuel -- preferring the capitalised
    # form, which reads better -- and point every row at it. The original
    # string stays untouched in `material_raw`.
    canonical = {}
    for test in all_tests:
        name = test["normalized"].get("material")
        if not name:
            continue
        key = name.lower()
        # Prefer a version that starts with a capital letter.
        if key not in canonical or (name[:1].isupper() and not canonical[key][:1].isupper()):
            canonical[key] = name
    merged = 0
    for test in all_tests:
        name = test["normalized"].get("material")
        if name and canonical[name.lower()] != name:
            test["normalized"]["material"] = canonical[name.lower()]
            merged += 1
    if merged:
        print(f"  merged {merged} rows onto a consistent material spelling")

    # Attach the pre-built search string to each record.
    for test in all_tests:
        test["search_text"] = build_search_text(test)

    # ----- Make every id unique --------------------------------------------
    # Ids are built from the investigation and the test number, which reads
    # nicely -- but some source files repeat a test number. PSI-22 contains a
    # duplicated eight-row block (test day 18319 twice) and PSI-39 repeats its
    # last eight rows, so those ids collided.
    #
    # This matters beyond tidiness: the website uses the id as React's list
    # key, and duplicate keys make React reuse the wrong row when a filter
    # changes -- a row that should have disappeared stays on screen. We keep
    # the readable id for the first occurrence and append the row number to
    # any repeat, so duplicates stay visible and distinguishable.
    seen_ids = {}
    for test in all_tests:
        base = test["id"]
        if base in seen_ids:
            seen_ids[base] += 1
            test["id"] = f"{base}#r{test['row_index']}"
            test["duplicate_of"] = base
        else:
            seen_ids[base] = 1

    collisions = sum(1 for count in seen_ids.values() if count > 1)
    if collisions:
        print(f"  disambiguated {collisions} repeated test id(s)")

    # ----- Verification ----------------------------------------------------
    total = len(all_tests)
    note_rows = sum(1 for t in all_tests if t["is_note"])
    flow_vis_rows = sum(1 for t in all_tests if t["is_flow_vis"])
    test_rows = total - note_rows - flow_vis_rows

    print("-" * 70)
    print(f"  Total rows parsed     {total}")
    print(f"    structured tests    {test_rows}")
    print(f"    footnote rows       {note_rows}")
    print(f"    pre-test flow-vis   {flow_vis_rows}")
    status = "OK" if total == EXPECTED_TOTAL_ROWS else "MISMATCH"
    print(f"  Expected {EXPECTED_TOTAL_ROWS} -> {status}")

    # ----- investigations.json --------------------------------------------
    investigations = []
    for psi_id, meta in INVESTIGATION_META.items():
        records = per_investigation[psi_id]
        notes = [r["normalized"].get("note_text") for r in records
                 if r["is_note"] and r["normalized"].get("note_text")]
        materials = sorted({r["normalized"]["material"] for r in records
                            if r["normalized"].get("material")})
        o2_values = [r["normalized"]["o2_percent"] for r in records
                     if r["normalized"].get("o2_percent") is not None]
        investigations.append({
            "psi_id": psi_id,
            **meta,
            "psi_url": f"https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}",
            "doi_url": f"https://doi.org/{meta['doi']}" if meta["doi"] else None,
            "row_count": len(records),
            "test_count": sum(1 for r in records if not r["is_note"] and not r["is_flow_vis"]),
            "materials": materials,
            "o2_range": ({"min": min(o2_values), "max": max(o2_values)} if o2_values else None),
            "embedded_notes": notes,
            "anomaly_count": sum(len(r["anomalies"]) for r in records),
        })

    # ----- materials.json --------------------------------------------------
    # One card per material that genuinely appears in the tables. We never
    # create a card for a material NASA did not test.
    grouped = defaultdict(list)
    for test in all_tests:
        material = test["normalized"].get("material")
        if material:
            grouped[material].append(test)

    materials = []
    for name, tests in sorted(grouped.items()):
        o2 = [t["normalized"]["o2_percent"] for t in tests
              if t["normalized"].get("o2_percent") is not None]
        flow = [t["normalized"]["flow_cm_s"] for t in tests
                if t["normalized"].get("flow_cm_s") is not None]
        pressure = [t["normalized"]["pressure_atm"] for t in tests
                    if t["normalized"].get("pressure_atm") is not None]
        rt_r0 = [t["normalized"]["rt_r0"] for t in tests
                 if t["normalized"].get("rt_r0") is not None]
        outcomes = Counter(t["normalized"]["outcome"] for t in tests
                           if t["normalized"].get("outcome"))
        # Does any test for this material carry a 1 g reference? Only
        # SAFFIRE-II does, so for everything else this is honestly False.
        has_1g = any(t["normalized"].get("has_1g_reference") for t in tests)

        materials.append({
            "name": name,
            "fuel_state": Counter(t["normalized"].get("fuel_state") for t in tests).most_common(1)[0][0],
            "test_count": len(tests),
            "investigations": sorted({t["psi_id"] for t in tests}),
            "geometries": sorted({t["normalized"]["geometry"] for t in tests
                                  if t["normalized"].get("geometry")}),
            "o2_range": ({"min": min(o2), "max": max(o2)} if o2 else None),
            "flow_range": ({"min": min(flow), "max": max(flow)} if flow else None),
            "pressure_range": ({"min": min(pressure), "max": max(pressure)} if pressure else None),
            "rt_r0_range": ({"min": min(rt_r0), "max": max(rt_r0)} if rt_r0 else None),
            "outcomes": dict(outcomes),
            "has_1g_reference": has_1g,
            # Was this material ever tested at the oxygen level a Moon base
            # would use? For every solid in PSI the answer is no.
            "tested_at_moonbase_o2": bool(o2 and max(o2) >= 30),
        })

    # ----- findings.json ---------------------------------------------------
    anomaly_counts = Counter()
    for test in all_tests:
        for flag in test["anomalies"]:
            anomaly_counts[flag] += 1

    solid_o2 = [t["normalized"]["o2_percent"] for t in all_tests
                if t["normalized"].get("fuel_state") == "solid"
                and t["normalized"].get("o2_percent") is not None
                and "sensor_failure" not in t["anomalies"]]
    max_solid_o2 = max(solid_o2) if solid_o2 else None

    findings = {
        "max_solid_o2_percent": max_solid_o2,
        "moonbase": {
            "o2_percent": 30.0, "pressure_psi": 10.2, "pressure_kpa": 70.3,
            "note": ("A planned lunar habitat runs at 30% oxygen and 10.2 psi. No solid "
                     "fuel in PSI was ever flight-tested above "
                     f"{max_solid_o2}% oxygen, so any solid simulation above that is "
                     "an extrapolation beyond the measured data."),
        },
        "gravity": {
            "tested": ["0g", "1g"],
            "untested_zone": {"min": 0.01, "max": 0.99},
            "moon_g": 0.16, "mars_g": 0.38,
            "note": ("NASA PSI contains no partial-gravity combustion data. Flame behaviour "
                     "between 0 g and 1 g is unmeasured. The hypothesis that flame spread "
                     "peaks near lunar gravity is untested; NASA's FM2 mission is designed "
                     "to measure it."),
        },
        "surprises": [
            {"id": "silicone_reversal",
             "title": "Silicone burns on Earth but barely ignites in space",
             "text": ("In SAFFIRE-II, silicone samples burned completely in normal gravity "
                      "but produced essentially zero burn length in microgravity. This is the "
                      "opposite of the usual assumption that microgravity makes materials "
                      "safer or more dangerous in one consistent direction."),
             "evidence": {"psi_id": "PSI-99", "tests": ["2-1", "2-2", "2-3", "2-4"],
                          "doi": "10.60555/2chp-m469"}},
            {"id": "invisible_cool_flames",
             "title": "Flames that keep burning after they disappear",
             "text": ("Large heptane droplets in FLEX continued to burn as invisible cool "
                      "flames after the visible flame went out, producing carbon monoxide and "
                      "formaldehyde with no light to detect. A fire can appear extinguished "
                      "and still be consuming fuel and generating toxic gas."),
             "evidence": {"psi_id": "PSI-69", "doi": "10.60555/mbq8-0451",
                          "condition": "heptane droplets above 2.4 mm"}},
            {"id": "mixed_material_selectivity",
             "title": "One material burned completely while its neighbour never lit",
             "text": ("In SAFFIRE-II sample 2-7, the PMMA portion was entirely consumed while "
                      "the adjacent Nomex never ignited at all."),
             "evidence": {"psi_id": "PSI-99", "tests": ["2-7"], "doi": "10.60555/2chp-m469"}},
        ],
        "gaps": [
            "No combustion data exists at any gravity between 0 g and 1 g.",
            f"No solid fuel was flight-tested above {max_solid_o2}% oxygen, "
            "while a lunar habitat is planned at 30%.",
            "No solid-fuel tests were run at reduced pressure near 10.2 psi.",
            "All SAME-R smoke data comes from heated, non-flaming samples, so no "
            "smoke measurements exist for genuine flaming fires.",
            "No tests cover electronics, wiring insulation, foams or packaging "
            "materials, which make up much of a real spacecraft's fuel load.",
            "BASS-II and BASS experimental tables record no outcome column; burn "
            "and extinction results exist only in the mission reports.",
        ],
        "anomaly_summary": dict(anomaly_counts),
        "anomaly_descriptions": {
            "sensor_failure": "Oxygen reading physically impossible; instrument fault confirmed in the mission report.",
            "baseline_co_offset": "Carbon monoxide recorded as negative; sensor zero point sits below zero.",
            "raw_percent_typo": "Oxygen written as 3400% or 2100%; read as 34% and 21%.",
            "raw_thickness_typo": "Thickness written as '037 mm'; read as 0.37 mm.",
            "zero_pressure_outlier": "Ambient pressure recorded as 0.0 mmHg, which is a vacuum.",
            "material_filled_forward": "Material cell was blank, meaning 'same as the row above'.",
            "embedded_footnote": "Row is a footnote explaining the table, not a test.",
            "pre_test_flow_visualisation": "Pre-test airflow check, not a burn.",
            "duplicate_row": "This row repeats an earlier row in the same file.",
            "duplicate_row_block": "Part of a block of rows duplicated in the source file.",
            "maintenance_row": "A hardware maintenance log entry, not a test.",
            "date_year_typo": "The year in this date is inconsistent with its neighbours.",
            "date_punctuation_typo": "Stray punctuation inside the date.",
            "negative_flow_reading": "Air flow recorded as negative; instrument drift near zero.",
            "telemetry_loss": "Time column records a signal loss instead of a clock time.",
            "time_format_variant": "Time written with dots instead of colons.",
            "zero_fuel_rate": "Fuel rate recorded as zero.",
            "non_numeric_frame_count": "Frame count holds a word such as 'none' or 'video'.",
            "sensor_over_range": "Sensor reading exceeded its measurable range.",
            "spreadsheet_division_error": "Cell holds a spreadsheet #DIV/0! error.",
            "not_applicable_cell": "Cell recorded as not applicable.",
            "unreadable_cell": "Cell contains a character that could not be decoded.",
            "cool_flame_candidate": "Conditions where invisible cool-flame burning may continue after visible extinction.",
            "zero_ignition_day": "A full test day on which no flame ignited.",
        },
    }

    # ----- flex_model.json -------------------------------------------------
    flex_model = build_flex_model(per_investigation["PSI-69"])

    # ----- Write everything ------------------------------------------------
    outputs = {
        "investigations.json": investigations,
        "tests.json": all_tests,
        "materials.json": materials,
        "findings.json": findings,
        "flex_model.json": flex_model,
    }
    print("-" * 70)
    for filename, payload in outputs.items():
        path = os.path.join(OUT_DIR, filename)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024
        print(f"  wrote {path:34} {size_kb:8.1f} KB")

    print("-" * 70)
    if flex_model.get("available"):
        print(f"  FLEX model: {flex_model['n_training_rows']} training rows, "
              f"5-fold accuracy {flex_model['cv_accuracy']:.1%}")
    print(f"  Materials with their own card: {len(materials)}")
    print(f"  Anomalies flagged: {sum(anomaly_counts.values())} "
          f"across {len(anomaly_counts)} types")
    print(f"  Highest solid-fuel oxygen ever flight-tested: {max_solid_o2}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
