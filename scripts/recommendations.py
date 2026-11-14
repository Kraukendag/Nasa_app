# =============================================================================
#  RECOMMENDATIONS FOR A LUNAR HABITAT
# =============================================================================
#  What the evidence suggests for a habitat planned at about 30% oxygen,
#  10.2 psi (70 kPa) and 0.16 g. Each recommendation lists:
#    * the evidence behind it -- numbers computed from the PSI rows (passed in
#      as `s`, see compute_stats in build_data.py) or quoted from a cited NTRS
#      document (keys from literature.py);
#    * how strong that evidence is, in plain words;
#    * the open research questions it leaves (ids from research_questions.py).
#
#  These are DRAFTED from the data for the team to review. They are research
#  suggestions, not safety requirements; the page says so.
# =============================================================================

# The team's top research questions, shown first on the Questions page.
# PROVISIONAL: proposed from the high-priority questions that bear most
# directly on a lunar habitat; the team should confirm or change them.
TEAM_PICKS = ["Q01", "Q09", "Q07", "Q02", "Q13", "Q15", "Q17", "Q27", "Q23", "Q35"]


def build_recommendations(s):
    return [
        {
            "id": "R1",
            "title": "Do not approve habitat materials on the Earth upward-burning test alone",
            "action": "Add a microgravity or low-flow test for any material that will fill a habitat, because the "
                      "normal-gravity screening test can misjudge it in both directions.",
            "evidence": [
                {"text": f"PMMA kept burning in microgravity at {s['pmma_min_o2']:g}% O2 (BASS-II test "
                         f"{s['pmma_min_test']}); attempts at {s['pmma_fail_range']} failed.", "psi": "PSI-25", "lit": None},
                {"text": "For a cellulose fuel the Earth oxygen limit is 16.5% O2, yet with spacecraft-like "
                         "ventilation (5-20 cm/s) flames survived at 14% O2.", "psi": None, "lit": "OLSON2004"},
                {"text": "The other direction: all four SAFFIRE-II silicone samples left about 0 cm burned in "
                         "microgravity, while two burned completely at 1 g.", "psi": "PSI-99", "lit": None},
            ],
            "strength": "Strong for PMMA (dozens of BASS-II tests). Weak for silicone: four samples, all near the "
                        "oxygen limit.",
            "questions": ["Q07", "Q12", "Q27"],
        },
        {
            "id": "R2",
            "title": "Test materials at the habitat's own atmosphere before choosing 30% oxygen",
            "action": "Run flammability tests at about 30% O2 and 70 kPa, and use the Saffire V-VI results, "
                      "before fixing the habitat atmosphere.",
            "evidence": [
                {"text": f"No solid fuel in the PSI tables was tested above {s['max_solid_o2']:g}% O2, and no "
                         "solid-fuel table records pressure.", "psi": None, "lit": None},
                {"text": "Saffire V and VI burned samples at 26.2-31.0% O2 and 54-71 kPa in Cygnus, close to "
                         "habitat conditions.", "psi": None, "lit": "SAFFIRE_VI_ICES2024"},
            ],
            "strength": "The gap itself is certain (it is a count of what was never tested). What happens inside "
                        "it is not yet known from PSI.",
            "questions": ["Q09", "Q10", "Q13", "Q41"],
        },
        {
            "id": "R3",
            "title": "Do not assume lunar gravity is safer than orbit",
            "action": "Screen habitat materials at lunar gravity, and treat 0.16 g as a possible worst case until "
                      "FM2 and similar experiments report.",
            "evidence": [
                {"text": "LUCI (Blue Origin, 2025): at simulated lunar gravity SIBAL's flame spread more slowly "
                         "(tip 1.1 vs 2.8 mm/s at 1 g) but burned about 45 s longer before going out.",
                 "psi": None, "lit": "LUCI"},
                {"text": "Related work suggests the oxygen concentration needed for flammability reaches a minimum "
                         "near lunar gravity.", "psi": None, "lit": "LPSC2026"},
                {"text": "PSI contains no test between 0 g and 1 g.", "psi": None, "lit": None},
            ],
            "strength": "Early: one sounding-rocket flight with two samples, plus a hypothesis that FM2 (late "
                        "2026) is designed to test.",
            "questions": ["Q01", "Q02", "Q03", "Q04"],
        },
        {
            "id": "R4",
            "title": "Shut off ventilation to fight a fire, and confirm it is fully out before turning it back on",
            "action": "Make it possible to stop air movement quickly in each module, and before ventilation is "
                      "restored, check that no near-invisible flamelets survive; do not treat slow air as safe.",
            "evidence": [
                {"text": f"In BASS-II, {s['low_flow']} flames went out as the crew turned the airflow down and "
                         f"{s['flow_stopped']} when they stopped it.", "psi": "PSI-25", "lit": None},
                {"text": f"Raising the airflow blew {s['blowoff']} flames off.", "psi": "PSI-25", "lit": None},
                {"text": "With flow on the order of spacecraft ventilation (5-20 cm/s), flames survived at 14% O2, "
                         "below the Earth limit of 16.5%.", "psi": None, "lit": "OLSON2004"},
                {"text": f"BASS-II noted flamelets in orbit: tests {s['flamelet_tests']}. In T5 a small, dim "
                         "flamelet seemed to burn the full sample length at very low airflow.", "psi": "PSI-25", "lit": None},
                {"text": "In NASA Glenn ground tests simulating microgravity, flamelets that survived low airflow "
                         "quickly grew into a large fire when ventilation increased.", "psi": None, "lit": "FLAMELETS2005"},
            ],
            "strength": "Turning the flow down was the experiment's procedure, so these counts show that stopping "
                        "the air puts flames out, not how often a real fire would be stopped. The flare-up on "
                        "restart was seen in ground tests that simulate microgravity, not yet in orbit.",
            "questions": ["Q17", "Q21", "Q34", "Q44"],
        },
        {
            "id": "R5",
            "title": "Qualify smoke detectors with real flaming smoke and lunar dust",
            "action": "Test habitat detectors against smoke from flaming materials and against lunar dust, not "
                      "only heated-sample smoke.",
            "evidence": [
                {"text": f"All {s['samer_n']} SAME-R smoke measurements come from heated, non-flaming samples.",
                 "psi": "PSI-101", "lit": None},
                {"text": "On Mir (15 October 1994) a jumpsuit used to smother a small fire kept burning unnoticed "
                         "and burned through; NASA notes it could have grown undetected into a large fire.",
                 "psi": None, "lit": "FLAMELETS2005"},
                {"text": f"DAFT measured dust aerosols in the ISS cabin ({s['daft_n']} sessions), the particles "
                         "that cause false alarms.", "psi": "PSI-47", "lit": None},
                {"text": f"Carbon monoxide readings reached {s['co_max']:g} ppm in BASS-II test {s['co_max_test']}, "
                         f"and the CO sensor went over its range in {s['co_over_range']} tests, so gas sensing can "
                         "add a second signal.", "psi": "PSI-25", "lit": None},
            ],
            "strength": "The gap is certain; how detectors would perform is not measured in PSI.",
            "questions": ["Q35", "Q36", "Q38"],
        },
    ]
