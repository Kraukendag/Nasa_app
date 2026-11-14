# =============================================================================
#  MICRO FLAMMA  ·  research_questions.py
# =============================================================================
#  Open research questions: places where knowledge is missing. Written by the
#  team, not generated from a template. Each states why it matters for a
#  mission, what is already known (numbers filled in from the data by
#  build_data.py, so they cannot drift), what is missing, what could answer
#  it, and what would need to be measured.
#
#  `refs` lists PSI investigations (PSI-xx) and literature keys (see
#  literature.py). Priority: "high" = blocks a lunar-habitat safety decision.
# =============================================================================


def build_research_questions(s):
    """s: dict of computed statistics (see build_data.py)."""
    Q = []

    def q(theme, question, why, known, gap, answer_by, measure, refs, priority="medium"):
        Q.append({"id": f"Q{len(Q) + 1:02d}", "theme": theme, "question": question, "why": why,
                  "known": known, "gap": gap, "answer_by": answer_by, "measure": measure,
                  "refs": refs, "priority": priority})

    # ---------------------------------------------------------------- GRAVITY
    G = "Partial gravity"
    q(G, "Does the minimum oxygen concentration that supports flame spread fall below both its 0 g and 1 g values at lunar gravity?",
      "Lunar habitats will be screened with 1 g tests. If lunar gravity is the most flammable condition, 1 g screening is not conservative.",
      "LPSC 2026 cites evidence that the limiting oxygen concentration reaches a minimum near lunar gravity. PSI contains no test between 0 g and 1 g.",
      "No long-duration measurement of the oxygen limit at 0.16 g for any material.",
      "FM2 (planned late 2026, four samples in real lunar gravity); repeat spinning-rocket flights.",
      "Extinction oxygen concentration for SIBAL and PMMA at 0.16 g, with the same samples tested at 0 g and 1 g.",
      ["LPSC2026"], "high")
    q(G, "Why did SIBAL spread more slowly at lunar gravity than at 1 g in LUCI, yet keep burning about 45 seconds longer?",
      "Slower spread but longer burning could mean a longer window for a fire to reach other materials.",
      "LUCI measured SIBAL flame-tip spread of 1.1 mm/s at simulated lunar gravity against 2.8 mm/s at 1 g; the 1 g flame went out about 45 s sooner.",
      "One flight, one sample per material, and a rotating platform with Coriolis effects.",
      "Further New Shepard flights; FM2.",
      "Spread rate, flame length and local oxygen over the whole burn, repeated on several samples.",
      ["LUCI", "LPSC2026"], "high")
    q(G, "At lunar gravity, does a flame spread faster against the airflow or with it, as it does in 0 g?",
      "Habitats have ventilation and gravity at once. Which spread direction dominates decides where detectors and fuel-free zones belong.",
      "Olson (2004) reports that 0 g flames preferentially spread upwind. Partial-gravity experiments so far studied buoyancy-driven spread (Feier 2001, upward; LPSC 2026 cites downward), not forced flow plus partial gravity.",
      "No measurement combining forced ventilation with partial gravity.",
      "A ventilated flow duct on a lunar lander or a long-arm centrifuge.",
      "Concurrent and opposed spread rates at 0.16 g for 0-20 cm/s forced flow.",
      ["OLSON2004", "FEIER2001"], "high")
    q(G, "At what gravity level does buoyancy alone supply enough oxygen to keep a flame alive without ventilation?",
      "If ventilation fails in a lunar habitat, will an existing fire starve or keep going?",
      f"In 0 g, {s['flow_stopped']} BASS-II flames went out when the crew stopped the airflow. In 1 g buoyancy always feeds the flame.",
      "The gravity level where quiescent burning becomes self-sustaining is unknown.",
      "FM2 burns samples in quiescent air at lunar gravity.",
      "Whether a flame survives in still air, and for how long, at 0.16 g and 0.38 g.",
      ["PSI-25", "LPSC2026"], "high")
    q(G, "Are Mars habitats (0.38 g) more or less flammable than lunar ones?",
      "Mars missions will need their own material screening rules.",
      "On the KC-135 (Feier 2001), upward spread speed over thin cellulose at 0.2-0.4 atm was roughly proportional to gravity across 0.10, 0.16 and 0.38 g.",
      "Thick materials, habitat atmospheres and burns longer than about 25 s at 0.38 g.",
      "Long-duration centrifuge tests; future Mars-gravity flights.",
      "Spread rate and oxygen limit at 0.38 g for cabin materials at habitat pressure.",
      ["FEIER2001", "LPSC2026"])
    q(G, "How long must a partial-gravity burn last for a thick material to reach steady spread?",
      "Short tests can mistake a flame that is still growing, or still dying, for a steady one.",
      "LPSC 2026 lists about 5 s in drop towers, 25 s on aircraft and 150 s on a spinning rocket. LUCI's PMMA rod never reached steady spread before going out about 6 cm along.",
      "No partial-gravity platform has run long enough for thick fuels.",
      "FM2 (real lunar gravity, long duration).",
      "Spread rate over time until it levels off, for 1-10 mm thick samples.",
      ["LPSC2026", "LUCI"])
    q(G, "Can the 1 g Test 1 result be corrected to predict flammability at lunar gravity?",
      "A correction factor would let existing Test 1 databases serve lunar missions.",
      "BASS-II set out to bridge Test 1 and real microgravity flammability. Olson (2004) argues Test 1 may not always be conservative.",
      "No paired Test 1 / lunar-gravity data set exists to fit a correction.",
      "FM2 samples chosen with known Test 1 results.",
      "Test 1 pass/fail and burn length alongside lunar-gravity spread for the same materials.",
      ["PSI-25", "OLSON2004", "LPSC2026"], "high")
    q(G, "Do droplet extinction and cool flames behave differently at partial gravity?",
      "Liquid spills (fuels, solvents, lubricants) are a habitat hazard alongside solids.",
      f"FLEX ({s['flex_n']} droplet tests) and CFI-G ({s['cfig_n']} gas tests) are all 0 g.",
      "No droplet or cool-flame measurement between 0 g and 1 g.",
      "A droplet module on a partial-gravity platform.",
      "Extinction diameter and burn time of methanol and heptane droplets at 0.16 g.",
      ["PSI-69", "PSI-159"])

    # ------------------------------------------------------------ ATMOSPHERE
    A = "Habitat atmosphere"
    q(A, "Do the microgravity extinction limits measured for PMMA and SIBAL still hold at about 30% oxygen and 70 kPa?",
      "This is the atmosphere planned for a lunar habitat.",
      f"No solid in the PSI tables was tested above {s['max_solid_o2']:g}% oxygen. Saffire VI (outside PSI) burned SIBAL at 31.0% O2 / 54.1 kPa and PMMA at 28.8-30.3% O2 / about 55 kPa, at large scale and one flow speed.",
      "No mapping of extinction limits (oxygen vs airflow) at habitat conditions.",
      "A BASS-type flow duct test at 30% O2 and 70 kPa; SoFIE on ISS.",
      "Extinction airflow at each oxygen level, for PMMA rods, slabs and SIBAL.",
      ["PSI-25", "SAFFIRE_VI_ICES2024"], "high")
    q(A, "Is oxygen partial pressure or oxygen fraction the better predictor of flammability at reduced pressure in microgravity?",
      "Habitats raise the oxygen fraction while lowering pressure; which of the two controls risk decides the safe operating envelope.",
      f"No solid-fuel table in PSI records pressure. FLEX droplets cover {s['flex_kpa_min']:.0f}-{s['flex_kpa_max']:.0f} kPa.",
      "Solids at matched partial pressure but different total pressure.",
      "A flow-duct test series varying pressure at fixed oxygen partial pressure.",
      "Spread rate and extinction limit for the same material at 3 pressures, same O2 partial pressure.",
      ["PSI-69", "PSI-25"], "high")
    q(A, "How does solid flame spread change with pressure when the oxygen fraction is held fixed?",
      "Separates the effect of pressure from the effect of oxygen, which current flight data mixes.",
      "Saffire IV-VI went from 100 kPa / 22% O2 to 54 kPa / 31% O2, changing both at once.",
      "No flight series varies pressure alone.",
      "Future Saffire-class or glovebox experiments.",
      "Spread rate at 100, 70 and 55 kPa at 30% O2.",
      ["SAFFIRE_VI_ICES2024"])
    q(A, "What is the lowest oxygen level at which PMMA sustains a flame in microgravity, across the full range of airflow?",
      "Defines how far oxygen must drop before a cabin fire cannot survive.",
      f"In BASS-II a PMMA rod sustained a flame at {s['pmma_min_o2']}% O2 (test {s['pmma_min_test']}); attempts at {s['pmma_fail_range']} failed. Olson (2004): cellulose burns at 14% O2 with spacecraft-like flow, against 16.5% on Earth.",
      "The limit has not been mapped against airflow for flat PMMA, only for rods at a few flows.",
      "SoFIE on ISS.",
      "Extinction oxygen level vs airflow (1-30 cm/s) for PMMA slabs and rods.",
      ["PSI-25", "OLSON2004"], "high")
    q(A, "Does Nomex stay non-flammable in a 30% oxygen, 70 kPa habitat atmosphere?",
      "Nomex is used for crew clothing and covers; its safety margin at habitat oxygen is unknown.",
      f"Nomex never sustained a flame in microgravity: {s['nomex_fail']} failed BASS-II attempts at 21-22.2% O2, and it did not ignite next to burning PMMA in SAFFIRE-II sample 2-7.",
      "No Nomex test above 22.2% oxygen.",
      "Saffire-class or SoFIE tests at habitat atmosphere.",
      "Ignition and spread of Nomex at 26-31% O2 and 55-70 kPa.",
      ["PSI-25", "PSI-99"], "high")
    q(A, "How do diluents other than nitrogen change solid flammability?",
      "Diluent choice for habitat air affects both flammability and suppression.",
      f"FLEX tested CO2 ({s['flex_co2_n']} tests) and helium ({s['flex_he_n']} tests) only with droplets.",
      "No solid-fuel test with CO2 or helium diluents.",
      "Flow-duct tests with mixed diluents.",
      "Extinction oxygen level for PMMA in N2, He and CO2 backgrounds.",
      ["PSI-69"])
    q(A, "Which materials burn in a suit atmosphere of 100% oxygen at 4.3 psi, at lunar gravity?",
      "Suit and suitport materials face the most oxygen-rich environment on a mission.",
      "No investigation in PSI, and none in the literature reviewed here, covers it.",
      "Complete absence of data.",
      "Ground tests in reduced gravity aircraft; FM2-class lunar tests.",
      "Ignition and spread of suit fabrics at 100% O2, 30 kPa, 0.16 g.",
      [], "high")
    q(A, "How quickly does a fire in a sealed module deplete oxygen enough to put itself out?",
      "Determines whether isolating a module is a viable fire response.",
      f"BASS-II recorded oxygen before and after each burn: median drop {s['o2_drop_median']:.1f} points, largest {s['o2_drop_max']:.1f}. LUCI's 1 g chamber fell from 21% to 14.5% O2.",
      "Small chambers only; no module-scale depletion curve.",
      "Saffire-class tests with far-field oxygen sensing.",
      "Oxygen concentration over time in a closed volume during a large fire.",
      ["PSI-25", "LUCI"])

    # ------------------------------------------------------------------ FLOW
    F = "Ventilation and airflow"
    q(F, "What ventilation speed minimises fire risk in a habitat module?",
      "Too little flow and smoke pools; too much and a fire is fed. Designers need the safe band.",
      f"BASS-II flames went out at low flow in {s['low_flow']} tests and blew off at high flow in {s['blowoff']}. Olson (2004) gives spacecraft ventilation as 5-20 cm/s.",
      "The band where fires are least likely has not been defined for thick materials at habitat oxygen.",
      "SoFIE; a dedicated ventilation-limit series.",
      "Extinction flow at low and high speed for cabin materials at 21% and 30% O2.",
      ["PSI-25", "OLSON2004"], "high")
    q(F, "How does the low-flow quenching limit change with sample thickness?",
      "Thick materials dominate the real fuel load of a cabin.",
      "In BASS-II's notes, thick PMMA slabs went out at 5-18 cm/s, while SIBAL fabric went out below about 3 cm/s; material and flow direction also differ.",
      "No single-material thickness series at fixed flow direction.",
      "BASS-type tests on PMMA of 0.1, 1, 3 and 10 mm in one flow direction.",
      "Quenching airflow vs thickness.",
      ["PSI-25"])
    q(F, "When does a downstream (concurrent) flame become viable under microgravity ventilation?",
      "Downstream flames grow fastest; knowing their threshold sets a ventilation ceiling.",
      "Olson (2004) estimates a partial downstream flame needs at least about 10 cm/s; below that only an upstream flame survives.",
      "Threshold not measured for thick fuels or at habitat oxygen.",
      "Flow-duct tests with flow-speed steps.",
      "Presence and size of downstream flame vs airflow.",
      ["OLSON2004"])
    q(F, "Why did the opposed-flow SAFFIRE-I burn last 70 s while the concurrent one lasted 420 s?",
      "Flow direction may change fire duration by a factor of six at large scale.",
      f"SAFFIRE-I: sample S1 (concurrent, 20 cm/s) burned {s['saffire1_s1']} s; S2 (opposed, 20 cm/s) burned {s['saffire1_s2']} s.",
      "The table does not record why S2 ended or how far it spread.",
      "Saffire IV-VI video and reports; repeat tests.",
      "Spread distance and extinction cause for opposed large-scale burns.",
      ["PSI-98"])
    q(F, "What happens to an established flame when ventilation is switched off and back on?",
      "Fans cycle and fail; a flame that revives when flow returns is a hidden hazard.",
      f"BASS-II flames went out in all {s['flow_stopped']} tests where the crew stopped the flow; none was restarted.",
      "Re-ignition after flow restoration is unmeasured.",
      "Flow-duct tests with timed flow interruptions.",
      "Time to extinction after flow stops; re-ignition when it resumes.",
      ["PSI-25"])
    q(F, "Is a flame on the end of an object (stagnation flow) more stable than one spreading along it?",
      "Pipe ends, cable ends and corners face oncoming flow.",
      f"BASS-II ran {s['stagnation_n']} stagnation-flow tests on PMMA rods. Olson (2004): rods on Mir burned like a candle at the end of a fat wick instead of spreading.",
      "Stagnation and parallel-flow limits not compared on one material.",
      "Paired BASS-type tests.",
      "Extinction oxygen and flow for the same rod in stagnation and parallel flow.",
      ["PSI-25", "OLSON2004"])

    # ------------------------------------------------------------- MATERIALS
    M = "Untested materials"
    q(M, "How do wire bundles and cable insulation burn in microgravity?",
      "Electrical faults are the most likely ignition source in a spacecraft.",
      "No wire or cable sample appears in any of the 14 PSI tables.",
      "Complete absence of data in this dataset.",
      "Saffire-class tests with cable bundles; dedicated wire-insulation experiments.",
      "Ignition by overload, spread along insulation, smoke yield.",
      [], "high")
    q(M, "How do foams and packaging materials burn in microgravity?",
      "Cargo bags and foams make up a large share of the combustible mass in a module.",
      "No foam or packaging sample appears in the PSI tables.",
      "Complete absence of data in this dataset.",
      "Saffire-class tests.",
      "Spread rate, heat release and smoke for common foams.",
      [], "high")
    q(M, "How do circuit boards and electronics enclosures burn?",
      "Electronics combine an ignition source with polymer fuel.",
      "No electronics sample appears in the PSI tables.",
      "Complete absence of data in this dataset.",
      "Dedicated electronics flammability tests.",
      "Ignition from overheated components; spread over boards.",
      [], "high")
    q(M, "Why did Nomex fail to ignite while the PMMA attached to it burned completely?",
      "Real assemblies mix materials; one burning material may or may not ignite its neighbour.",
      "SAFFIRE-II sample 2-7: the PMMA portion was completely consumed, but the Nomex was not ignited (table Note 2).",
      "One sample; the heat transfer between the two was not measured.",
      "Composite-sample flow-duct tests.",
      "Heat flux at the junction; ignition of the second material.",
      ["PSI-99"])
    q(M, "Is silicone's reversal (burns at 1 g, barely in microgravity) real away from its oxygen limit?",
      "If silicone is safer in space only near the limit, the advantage may vanish at habitat oxygen.",
      "Four SAFFIRE-II silicone samples, all at 21.5-22.1% O2 (near the limit), left about 0 cm burned in microgravity; two burned completely and one 7.6 cm at 1 g.",
      "Only four samples, all near the oxygen limit.",
      "Silicone tests at 26-31% O2.",
      "Microgravity burn length vs oxygen for silicone sheets of several thicknesses.",
      ["PSI-99"], "high")
    q(M, "Do thick materials reach steady flame spread in microgravity within available test times?",
      "Thick materials dominate the fuel load but are slow to reach steady burning.",
      "The thickest PMMA slab in BASS-II was 5 mm; Saffire VI burned 1 cm two-sided PMMA (outside PSI).",
      "Steady-state data for thick materials is sparse.",
      "Long-duration ISS tests.",
      "Spread rate over time for 5-20 mm samples.",
      ["PSI-25", "SAFFIRE_VI_ICES2024"])
    q(M, "Does lunar dust on a surface change how it ignites or burns?",
      "Dust will coat everything in a lunar habitat.",
      f"DAFT sampled Arizona Road Dust aerosol in {s['daft_n']} sessions; no combustion test included dust.",
      "No flammability test with dust-covered samples.",
      "Ground tests with lunar simulant; FM2-class tests.",
      "Ignition delay and spread rate of dusted vs clean samples.",
      ["PSI-47"])

    # ------------------------------------------------ IGNITION AND EXTINCTION
    I = "Ignition and extinction"
    q(I, "Why did so many diluted-butane ignition attempts fail in CFI-G?",
      "Ignition failures mark the edge of flammability, the most informative region.",
      f"{s['butane_fail']} of {s['butane_total']} Butane (30%) attempts never ignited.",
      "The CFI-G table does not separate igniter problems from true non-flammability.",
      "Repeat tests with recorded igniter energy.",
      "Igniter power and duration for each attempt; flammable or not.",
      ["PSI-159"])
    q(I, "What ignition energy does a solid need at habitat oxygen levels?",
      "Sets how hot a fault must get to start a fire.",
      f"SAFFIRE igniters ran at {s['saffire_w']} W; BASS-II used several igniter types.",
      "No measured minimum ignition energy for solids in microgravity.",
      "Igniter-energy steps on flow-duct samples.",
      "Minimum ignition energy vs oxygen and airflow.",
      ["PSI-98", "PSI-99", "PSI-25"])
    q(I, "Why do flames self-extinguish at steady airflow in microgravity?",
      "A flame that dies on its own without intervention changes how a crew should respond.",
      f"{s['self_ext_n']} BASS-II flames went out by themselves at steady flow ({s['self_ext_ids']}). LUCI's report notes gravity stayed constant, so extinction must be caused by other factors.",
      "The cause (oxygen depletion, heat loss, fuel geometry) is not separated.",
      "Tests with local oxygen and temperature probes.",
      "Local oxygen, radiant heat loss and fuel regression at extinction.",
      ["PSI-25", "LUCI"])
    q(I, "At what droplet size does radiation put out a flame?",
      "Large spills burn differently from small droplets.",
      f"FLEX recorded visible-extinction diameters from {s['dext_min']:.2f} to {s['dext_max']:.2f} mm (median {s['dext_median']:.2f} mm).",
      "Radiative extinction has not been isolated from other causes in the table.",
      "Further droplet tests with radiometry.",
      "Radiant loss and extinction diameter for large droplets.",
      ["PSI-69"])
    q(I, "Can a near-limit flame relight when oxygen or airflow recovers?",
      "Determines whether a fire that seems out must still be monitored.",
      "No PSI test records a deliberate relight.",
      "Complete absence of data.",
      "Flow-duct tests with recovery steps.",
      "Relight probability vs time since extinction.",
      [])

    # ------------------------------------------------------------- DETECTION
    D = "Detection"
    q(D, "What does aged smoke from FLAMING materials look like in microgravity?",
      "Smoke detectors are tuned to particle sizes; flaming smoke differs from heated-sample smoke.",
      f"All {s['samer_n']} SAME-R tests heated samples without flaming.",
      "No microgravity smoke data from real flames.",
      "A SAME-type experiment with flaming samples.",
      "Particle size distribution and aging of flaming smoke.",
      ["PSI-101"], "high")
    q(D, "Can smoke detectors tell lunar dust from smoke?",
      "False alarms erode trust; missed fires are worse.",
      f"DAFT measured Arizona Road Dust aerosol; SAME-R smoke particles grew by Rt/R0 = {s['rt_min']}-{s['rt_max']} with aging.",
      "No test exposed a detector to dust and smoke together.",
      "Combined dust-smoke detector tests.",
      "Detector response to dust, smoke and mixtures.",
      ["PSI-47", "PSI-101"], "high")
    q(D, "Which sensor detects an invisible cool flame first?",
      "A cool flame gives off little light, so optical detectors may miss it.",
      f"CFI-G recorded {s['cool_n']} cool flames; FLEX researchers reported heptane droplets burning on invisibly after visible extinction.",
      "No comparison of CO, formaldehyde or infrared sensors on cool flames.",
      "Cool-flame tests instrumented with candidate sensors.",
      "Time to detection for each sensor type.",
      ["PSI-159", "PSI-69"])
    q(D, "How quickly does carbon monoxide build up before a fire is visible?",
      "CO is both a hazard and a detection signal.",
      f"BASS-II measured CO before and after each burn, with final readings up to {s['co_max']:.0f} ppm (test {s['co_max_test']}).",
      "Only start and end values; no time history in the table.",
      "Time-resolved gas sampling in flow-duct tests.",
      "CO over time from ignition.",
      ["PSI-25"])
    q(D, "Does smoke aging time change where detectors should be placed?",
      "Smoke particles grow as they drift; a detector far from a fire sees different smoke.",
      f"SAME-R aged smoke for up to {s['aging_max']:.0f} s.",
      "Link between aging, distance and detector response not established.",
      "Module-scale smoke transport tests.",
      "Particle size at several distances from the source.",
      ["PSI-101"])
    q(D, "Can radiometers give earlier warning than smoke detectors?",
      "Radiant heat may be detectable before smoke reaches a sensor.",
      "BASS-II recorded radiometer data; FM2 will carry radiometers.",
      "No comparison of radiometer and smoke-detector timing.",
      "FM2; flow-duct tests.",
      "Time from ignition to radiometer and smoke alarms.",
      ["PSI-25", "LPSC2026"])

    # ----------------------------------------------------------- SUPPRESSION
    S = "Suppression"
    q(S, "How well does CO2 put out solid fires at reduced pressure and raised oxygen?",
      "CO2 extinguishers are standard on spacecraft; their margin at habitat conditions is unknown.",
      f"FLEX tested CO2 only on droplets ({s['flex_co2_n']} tests). No PSI table tests suppression of solids.",
      "No solid-fire suppression data in microgravity at habitat conditions.",
      "Suppression tests in a flow duct.",
      "CO2 concentration needed to extinguish PMMA and SIBAL at 30% O2, 70 kPa.",
      ["PSI-69"], "high")
    q(S, "Is helium a better suppressant than CO2 at the same concentration?",
      "Suppressant choice affects mass, toxicity and effectiveness.",
      f"Raw FLEX shares of tests ending in extinction: {s['ext_he']:.0f}% with helium, {s['ext_co2']:.0f}% with CO2, {s['ext_none']:.0f}% with neither. These shares mix different oxygen levels and fuels.",
      "No controlled comparison at matched oxygen and pressure.",
      "Paired FLEX-type droplet tests.",
      "Extinction probability vs diluent fraction at fixed oxygen.",
      ["PSI-69"])
    q(S, "Does water mist work in microgravity?",
      "Water is plentiful and non-toxic.",
      "No PSI investigation tested water mist.",
      "Complete absence of data in this dataset.",
      "Dedicated mist experiments.",
      "Extinction time and mist mass needed.",
      [])
    q(S, "Can cutting ventilation be used to put out a fire without filling the cabin with smoke?",
      "Turning off fans starves a microgravity flame but stops smoke removal.",
      f"Stopping the airflow put out {s['flow_stopped']} BASS-II flames; {s['low_flow']} went out as flow was turned down.",
      "Smoke distribution after ventilation shutdown is unmeasured.",
      "Module-scale tests.",
      "Smoke concentration over time after fan shutdown.",
      ["PSI-25"])
    q(S, "How is a module's atmosphere recovered after a fire?",
      "Post-fire cleanup decides whether a module can be re-entered.",
      "Saffire IV-VI listed vehicle impact and post-fire recovery among its objectives (ICES 2024).",
      "Recovery time and scrubber load are not in PSI.",
      "Saffire IV-VI reports.",
      "Contaminant levels over time with scrubbers running.",
      ["SAFFIRE_VI_ICES2024"])

    # ----------------------------------------------------------- COOL FLAMES
    C = "Cool flames"
    q(C, "Why did cool flames appear only in one fuel and pressure in CFI-G?",
      "Knowing where cool flames occur tells designers where to look for them.",
      f"All {s['cool_n']} recorded cool flames were in {s['cool_fuel']} at about {s['cool_kpa']} kPa and {s['cool_o2']} O2.",
      "Other fuels and pressures produced none in this table; the reason is not established.",
      "Extended CFI-G runs.",
      "Cool-flame occurrence across fuels, pressures and oxygen.",
      ["PSI-159"])
    q(C, "Can vapours from heated cabin materials form cool flames?",
      "An overheating material might burn invisibly before visible flame appears.",
      "PSI cool-flame data comes from gas and liquid fuels only.",
      "No cool-flame test with pyrolysis vapours from solids.",
      "Heated-sample tests with cool-flame diagnostics.",
      "Cool-flame onset temperature for common cabin polymers.",
      ["PSI-159", "PSI-101"])
    q(C, "Do large heptane spills create a cool-flame hazard?",
      "Liquid hydrocarbons are carried as fuels and solvents.",
      f"{s['territory_n']} FLEX heptane droplets were larger than 2.4 mm, the size range where invisible burning was reported after visible extinction.",
      "The FLEX table records visible extinction only.",
      "Droplet tests with cool-flame detection.",
      "Duration of invisible burning vs droplet size.",
      ["PSI-69"])

    # ----------------------------------------------------------------- SCALE
    X = "Scale"
    q(X, "How does a fire grow from glovebox scale to module scale?",
      "Small tests are cheap; real fires are large.",
      f"BASS-II samples were {s['bass2_widths']} wide; SAFFIRE-I burned a 94 x 40.6 cm sheet.",
      "Few intermediate scales to connect the two.",
      "Saffire-class tests at intermediate widths.",
      "Spread rate and flame size vs sample width.",
      ["PSI-25", "PSI-98"])
    q(X, "What heat release rate does a realistic module fire produce?",
      "Sets the load on cooling and suppression systems.",
      "Saffire VI reported heat release for SIBAL and PMMA samples (ICES 2024), outside PSI.",
      "No heat release data in the PSI tables.",
      "Saffire IV-VI data release.",
      "Heat release rate over time for mixed-material fires.",
      ["SAFFIRE_VI_ICES2024"])
    q(X, "How long can a large fire burn in a sealed spacecraft?",
      "Determines how much time a crew has.",
      f"The longest burn in SAFFIRE-I lasted {s['saffire1_s1']} s.",
      "Duration vs volume and oxygen not characterised.",
      "Saffire-class tests with far-field sensing.",
      "Burn duration and final oxygen in a closed volume.",
      ["PSI-98"])

    # ---------------------------------------------------------- DATA GAPS
    R = "Records and data"
    q(R, "How did each BASS (PSI-26) test end, and under what conditions?",
      f"BASS has {s['bass_n']} tests whose outcomes would double the solid-fuel evidence.",
      "The BASS table records sample and date only.",
      "No oxygen, airflow or outcome in the experimental table.",
      "Transcription from the BASS final report, as done here for BASS-II.",
      "Oxygen, airflow, direction and outcome per test.",
      ["PSI-26"], "high")
    q(R, "What pressure did each solid-fuel test run at?",
      "Without pressure, reduced-pressure risk cannot be read from existing data.",
      "No solid-fuel table in PSI records chamber pressure.",
      "Pressure missing for all 300+ solid tests.",
      "PSI data curation.",
      "Chamber pressure per test.",
      ["PSI-25", "PSI-26"])
    q(R, "What does the FLEX-2 per-test data show?",
      "FLEX-2 extends droplet work to more fuels and mixtures.",
      "Only an 8-row range summary of FLEX-2 is included here.",
      "Per-test FLEX-2 results are not in this dataset.",
      "PSI FLEX-2 data files.",
      "Per-test conditions and outcomes.",
      ["PSI-68"])

    return Q
