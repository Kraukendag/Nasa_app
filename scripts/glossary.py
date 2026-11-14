# =============================================================================
#  MICRO FLAMMA  ·  glossary.py
# =============================================================================
#  Plain-language meanings of the terms the site uses, each taken from a NASA
#  document and cited to the page (printed page numbers). The reviewer found
#  SIBAL and "pot" used but never explained.
#
#  `source` is a key from literature.SOURCES; `quote` is NASA's own wording,
#  `plain` is our one-line explanation of it.
# =============================================================================

GLOSSARY = [
    {"term": "PMMA", "plain": "A clear acrylic plastic (Plexiglas). BASS-II burned it as rods, slabs, films and a sphere section.",
     "quote": "PMMA polymethylmethacrylate (acrylic)", "source": "BASS2_TM", "where": "p. 2 (Nomenclature)"},
    {"term": "SIBAL", "plain": "A cotton-fiberglass fabric used as a standard test fuel. The name comes from the earlier project it was made for.",
     "quote": "a composite cotton-fiberglass fabric blend (referred to as the SIBAL (Solid Inflammability Boundary at Low Speed) fabric)",
     "source": "BASS2_TM", "where": "p. 93"},
    {"term": "Nomex", "plain": "A fire-barrier fabric used widely on the ISS.",
     "quote": "it is heavily used aboard the International Space Station (ISS) as a fire barrier", "source": "BASS2_TM", "where": "p. 46"},
    {"term": "Pot (fan pot)", "plain": "The potentiometer setting of the BASS-II fan: the knob that set the airflow. Airflow speeds on this site are converted from the fan's Air display reading with NASA's calibration (velocity = Air display × 1.0066 cm/s).",
     "quote": "Potentiometer (pot).", "source": "BASS2_TM", "where": "p. 103 (Appendix A footnote)"},
    {"term": "Opposed flow", "plain": "Air moving against the direction the flame spreads (the flame spreads upwind).",
     "quote": "Flames in microgravity are known to preferentially spread upwind (ie opposed flow), not downwind (i.e. concurrent flow)",
     "source": "OLSON2004", "where": "p. 123"},
    {"term": "Concurrent flow", "plain": "Air moving in the same direction the flame spreads (the flame spreads downwind), as in Earth's upward-burning Test 1.",
     "quote": "not downwind (i.e. concurrent flow) as in the normal gravity upward flammability screening Test 1",
     "source": "OLSON2004", "where": "p. 123"},
    {"term": "Stagnation flow", "plain": "Air flowing straight at the end of a rod, so the flame sits on the rod's tip like a cap.",
     "quote": "Microgravity Flammability Boundary for Polymethylmethacrylate Rods In Axial Stagnation Flow", "source": "BASS2_TM", "where": "p. 64 (section 6.1 title)"},
    {"term": "Quenching extinction", "plain": "A flame going out because the airflow is too weak to feed it.",
     "quote": "Quenching extinction occurs at very low forced flows, where the flame shrinks to a hemispherical blue flame and oscillates with increasing amplitude just before going out.",
     "source": "BASS2_TM", "where": "p. 64"},
    {"term": "Blowoff", "plain": "A flame going out because the airflow is too strong.",
     "quote": "Blowoff extinction is initiated by the formation of a hole in the flame sheet in the stagnation region of the flame.",
     "source": "BASS2_TM", "where": "p. 64"},
    {"term": "Flamelets", "plain": "Small separate flames that a starved flame front breaks into; each burns its own channel toward the incoming air.",
     "quote": "the flame breaks into numerous “flamelets” that form a Turing-type reaction-diffusion fingering pattern as they spread across the fuel",
     "source": "FLAMELETS2005", "where": "p. 1"},
    {"term": "MSG", "plain": "The Microgravity Science Glovebox, the sealed workspace on the ISS where BASS and BASS-II burned their samples.",
     "quote": "MSG Microgravity Science Glovebox, a facility aboard ISS", "source": "BASS2_TM", "where": "p. 2 (Nomenclature)"},
]
