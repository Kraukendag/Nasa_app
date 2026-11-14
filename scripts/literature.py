# =============================================================================
#  MICRO FLAMMA  ·  literature.py
# =============================================================================
#  Results from OUTSIDE the 14 PSI tables, each checked against the original
#  NASA document (fetched from NTRS) before being written here. Every entry
#  gives the document, its NTRS id and the page or slide the value is on.
#
#  These are kept apart from the PSI test rows on purpose: the site always
#  shows them as "literature, not PSI", with their citation, and never feeds
#  them into the Lab's matching or the FLEX model.
# =============================================================================

SOURCES = {
    "LUCI": {
        "title": "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket",
        "authors": "Ferkul et al.", "venue": "ASGSR 2025 Annual Meeting (presentation)",
        "ntrs": "20250010653",
        "url": "https://ntrs.nasa.gov/citations/20250010653",
    },
    "SAFFIRE_VI_ICES2024": {
        "title": "Preliminary Results from the Saffire VI Experiment",
        "authors": "Urban, Ruff, Ferkul et al.", "venue": "53rd ICES, July 2024 (presentation)",
        "ntrs": "20240007488",
        "url": "https://ntrs.nasa.gov/citations/20240007488",
    },
    "FEIER2001": {
        "title": "Upward Flame Spread Over Thin Solids in Partial Gravity",
        "authors": "Feier, Shih, Sacksteder, T'ien", "venue": "AIAA 2001-0466",
        "ntrs": "20010059376",
        "url": "https://ntrs.nasa.gov/citations/20010059376",
    },
    "OLSON2004": {
        "title": "Most Probable Fire Scenarios in Spacecraft and Extraterrestrial Habitats - Why NASA's Current Test 1 Might Not Always Be Conservative",
        "authors": "S.L. Olson", "venue": "NASA/TM-2004-213114",
        "ntrs": "20040084156",
        "url": "https://ntrs.nasa.gov/citations/20040084156",
    },
    "LPSC2026": {
        "title": "Material Flammability at Lunar and Martian Gravity",
        "authors": "Ferkul, Kralik, Liao", "venue": "Lunar and Planetary Science Conference 2026",
        "ntrs": "20260000646",
        "url": "https://ntrs.nasa.gov/citations/20260000646",
    },
    "BASS2_TM": {
        "title": "Burning and Suppression of Solids-II (BASS-II) Summary Report",
        "authors": "Olson, Ferkul, Bhattacharjee, Miller, Fernandez-Pello, Link, T'ien, Wichman",
        "venue": "NASA/TM-20210011385, Oct 2021",
        "ntrs": "20210011385",
        "url": "https://ntrs.nasa.gov/citations/20210011385",
    },
    # NASA Glenn "Research and Technology 2004"; NTRS marks it public use
    # permitted with no third-party material, so its figure is bundled.
    "FLAMELETS2005": {
        "title": "New Species of Fire Discovered: Fingering Flamelets Form a Dynamic Population",
        "authors": "Olson, Miller, Wichman",
        "venue": "NASA Glenn Research and Technology 2004 (June 2005)",
        "ntrs": "20050217475",
        "url": "https://ntrs.nasa.gov/citations/20050217475",
    },
}

# Measured values at gravity levels PSI does not cover, or with conditions
# PSI does not cover. `g` is the gravity level in Earth g.
POINTS = [
    # ---- LUCI: Blue Origin New Shepard, 4 Feb 2025, 11 RPM, air, normal pressure
    {"source": "LUCI", "g": 0.16, "material": "SIBAL", "quantity": "Flame base spread rate",
     "value": 0.9, "unit": "mm/s", "compare_1g": 1.5, "where": "slide 'Combined Results: SIBAL'"},
    {"source": "LUCI", "g": 0.16, "material": "SIBAL", "quantity": "Flame tip spread rate",
     "value": 1.1, "unit": "mm/s", "compare_1g": 2.8, "where": "slide 'Combined Results: SIBAL'"},
    {"source": "LUCI", "g": 0.16, "material": "PMMA", "quantity": "Flame tip spread rate (4 mm rod)",
     "value": 0.15, "unit": "cm/s", "compare_1g": 0.40, "where": "slide 'Combined Results: PMMA'"},
]

LUCI_NOTES = [
    "Flown on Blue Origin New Shepard on 4 February 2025; vehicle spin at 11 RPM gave simulated lunar gravity at a 1.22 m radius.",
    "Two samples burned in air at normal pressure: SIBAL fabric (5 cm x 30 cm) and a 4 mm diameter PMMA rod.",
    "The 1 g SIBAL flame went out about 45 seconds sooner than the lunar-g flame.",
    "The PMMA rod spread about 6 cm before extinction at lunar g; steady spread was not reached.",
    "Burns lasted more than two and a half minutes; LPSC 2026 notes the Coriolis force adds uncertainty.",
]

# Saffire IV-VI test matrix as executed (ICES 2024, slide 11). All 20 cm/s concurrent.
SAFFIRE_IV_VI = [
    {"sample": "IV-1", "material": "SIBAL cloth", "length_cm": 50, "flow_cm_s": 20, "direction": "concurrent", "pressure_kpa": 100.0, "o2_percent": 22.0},
    {"sample": "V-2", "material": "Cotton jersey", "length_cm": 50, "flow_cm_s": 20, "direction": "concurrent", "pressure_kpa": 70.7, "o2_percent": 26.2},
    {"sample": "VI-2", "material": "SIBAL cloth", "length_cm": 50, "flow_cm_s": 20, "direction": "concurrent", "pressure_kpa": 54.1, "o2_percent": 31.0},
    {"sample": "VI-3", "material": "Two-sided PMMA", "length_cm": 18, "flow_cm_s": 20, "direction": "concurrent", "pressure_kpa": 54.6, "o2_percent": 30.3},
    {"sample": "VI-4", "material": "One-sided PMMA", "length_cm": 18, "flow_cm_s": 20, "direction": "concurrent", "pressure_kpa": 55.2, "o2_percent": 28.8},
]

STATEMENTS = [
    {"source": "FEIER2001", "g": [0.1, 0.16, 0.38],
     "text": "On the NASA KC-135 aircraft, thin cellulose samples (1, 2 and 4 cm wide) burned upward in air at 0.2-0.4 atm at 0.10 g, 0.16 g (lunar) and 0.38 g (martian). Steady spread speeds and pyrolysis lengths were approximately proportional to the gravity level.",
     "where": "Abstract"},
    {"source": "OLSON2004",
     "text": "For a cellulose fuel in opposed flow, the limiting oxygen index on Earth is 16.5% O2, but with flow on the order of spacecraft ventilation (5-20 cm/s) flames can be sustained at 14% O2.",
     "where": "p. 123"},
    {"source": "OLSON2004",
     "text": "Plastic cylinders burned aboard Mir did not spread along the rod as intended; the flame stabilized at the front tip of the rod and burned like a candle flame at the end of a fat wick.",
     "where": "p. 123"},
    {"source": "OLSON2004",
     "text": "Flames in microgravity preferentially spread upwind (opposed flow), not downwind as in the normal-gravity upward screening Test 1.",
     "where": "p. 123"},
    {"source": "LPSC2026",
     "text": "Early numerical and experimental evidence suggested lunar gravity could be more hazardous, since flame spread rate as a function of gravity peaks there; related work suggests the oxygen concentration needed for flammability reaches a minimum near lunar gravity.",
     "where": "Introduction"},
    {"source": "LPSC2026",
     "text": "Flammability of Materials on the Moon (FM2), planned for launch in late 2026, will burn four solid fuel samples in quiescent habitable atmospheres in real lunar gravity, with cameras, radiometers and an oxygen sensor.",
     "where": "Combustion on the Moon"},
    {"source": "FLAMELETS2005",
     "text": "Near extinction, in weakly convective environments such as microgravity or in vertically confined spaces, a flame breaks into numerous flamelets that form a fingering pattern as they spread across the fuel. This extends the flammability range to lower opposed flow velocities, lower oxygen concentrations or higher heat loss.",
     "where": "p. 1 (NASA ground experiment in a narrow flow channel)"},
    {"source": "FLAMELETS2005",
     "text": "US spacecraft crews turn off ventilation to help put out a fire, then reactivate it to clear the smoke. Some flamelets can survive, and NASA Glenn experiments demonstrated that flamelets quickly grow into a large fire when ventilation increases.",
     "where": "p. 1"},
    {"source": "LPSC2026",
     "text": "Partial-gravity test times: about 5 s in drop towers, about 25 s aboard aircraft, and about 150 s on a spinning sounding rocket.",
     "where": "Discussion"},
]


# The NASA figure that shows flamelets (bundled in public/media).
FLAMELET_FIGURE = {
    "source": "FLAMELETS2005",
    "file": "ntrs-20050217475-flamelets.jpg",
    "where": "p. 2",
    "caption": ("Top: at the end of the test, the airflow is increased to see if the flamelets can be blown out. "
                "Instead, they flare up and remerge into a full flame front. Bottom: green light reveals the black "
                "char fingers left on the paper once the flame broke into flamelets. Air came from the top; at "
                "2 cm/s past the sample the flamelet population was about 13."),
    "setting": "NASA Glenn ground experiment: a narrow flow channel that suppresses buoyancy, simulating microgravity. Not flight data.",
}


def build_literature():
    return {"sources": SOURCES, "points": POINTS, "luci_notes": LUCI_NOTES,
            "saffire_iv_vi": SAFFIRE_IV_VI, "statements": STATEMENTS,
            "flamelet_figure": FLAMELET_FIGURE,
            "note": "Values checked against the NTRS documents listed. Not PSI data; never used in the Lab's matching or the FLEX model."}
