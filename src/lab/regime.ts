// =============================================================================
//  FLAME BEHAVIOUR ("REGIME") FOR THE 3D SPECIMEN
// =============================================================================
//  Decides HOW the flame in the Lab behaves for the chosen sample and
//  conditions, and records the NASA evidence for that behaviour. The rule of
//  the house: a behaviour is shown only where NASA saw it. Each one carries
//  the test or document behind it, and the Lab prints them under the 3D view
//  ("Why this flame looks like this").
//
//  Behaviours by shape
//    sheet / fabric / film / slab
//      front       a flame front across the width, lit at the top, spreading
//      fingering   thin fuels at very low airflow in microgravity: the front
//                  breaks into flamelets that eat branching char channels
//                  (BASS-II T4, T5; NASA Glenn NTRS 20050217475)
//    rod
//      cap         stagnation flow: a cap on the tip "like a candle flame at
//                  the end of a fat wick" (NASA TM-2004-213114)
//      quench      at very low flow the flame shrinks to a hemispherical blue
//                  flame and oscillates before going out (BASS-II report p. 64)
//      blowoff     a hole opens in the flame sheet at the tip (same page)
//    sphere, candle   a shell around the sample
//    droplet     shrinking shell; extinction at the recorded diameter;
//                disruption; cool-flame territory for large heptane drops
//    gas burner  sphere (CFI-G), disk (ACME), jet (SPICE); cool flame where
//                CFI-G records one
// =============================================================================

import type { State } from './dimensions'
import type { Ending, SampleShape } from '../components/Specimen'

export type Behaviour = 'front' | 'fingering' | 'cap' | 'shell' | 'plume' | 'droplet' | 'burner'
export interface Evidence { text: string; cite: string }
export interface Regime {
  behaviour: Behaviour
  ending: Ending
  /** End-of-run extras that NASA observed for this situation. */
  quench: boolean          // rod/cap: shrink to blue hemisphere, oscillate, out
  holeBlowoff: boolean     // rod/cap: hole opens at the tip, then blow-off
  canReignite: boolean     // fingering: flamelets re-form a front when air returns
  coolFlameAfter: boolean  // droplet/gas: faint cool flame after the hot flame
  disruption: boolean      // droplet breaks apart
  label: string
  evidence: Evidence[]
}

const THIN = new Set<SampleShape>(['fabric', 'film', 'sheet', 'composite sheet'])
const FLAT = new Set<SampleShape>(['fabric', 'film', 'sheet', 'composite sheet', 'slab'])

/** NASA's own lowest airflows with flamelets: BASS-II T4/T5 ended at an
 *  airflow display of 1 (1.01 cm/s); the NASA Glenn ground test saw about 13
 *  flamelets at 2 cm/s. Flamelets are drawn only at or below this. */
export const FLAMELET_MAX_FLOW = 2.1

export function decideRegime(p: {
  state: State; shape: SampleShape; gravity: '0g' | '1g' | 'none'; flow: number | null; lowestFlow: number | null
  direction: string | null; ending: Ending; topClass: string | null; flameletTests: string[]; matchingCount: number
  coolFlameRecorded: number; coolFlameTerritory: number; burner: string
  /** The one PSI test the 3D view draws (its id), and whether NASA's notes record flamelets for it. */
  drawnTest?: string | null; drawnFlamelet?: boolean
}): Regime {
  const who = p.drawnTest ? `Drawn test ${p.drawnTest} ended` : 'Most matching tests ended'
  const r: Regime = {
    behaviour: 'front', ending: p.ending, quench: false, holeBlowoff: false, canReignite: false,
    coolFlameAfter: false, disruption: false, label: '', evidence: [],
  }
  const add = (text: string, cite: string) => r.evidence.push({ text, cite })

  if (p.gravity === '1g') {
    r.behaviour = p.state === 'liquid' ? 'droplet' : p.state === 'gas' ? 'burner' : 'plume'
    r.label = 'Buoyant flame (1 g)'
    add('With gravity, hot gas rises and the flame stretches into a tall, flickering, sooty plume.', 'Illustration of normal-gravity burning')
    return r
  }

  if (p.state === 'liquid') {
    r.behaviour = 'droplet'
    r.label = 'Droplet flame'
    add('A thin spherical flame surrounds the droplet and shrinks with it; the droplet diameter is the recorded starting value.', 'PSI-69 FLEX / PSI-39 CFI table')
    if (p.topClass === 'Disruption') { r.disruption = true; add(`${who} in disruption: the droplet broke apart.`, 'PSI-69 FLEX outcome column') }
    if (p.topClass === 'Extinction') add(`${who} in extinction: the flame went out while fuel remained, at the recorded extinction diameter.`, 'PSI-69 FLEX outcome column')
    if (p.coolFlameTerritory > 0) {
      r.coolFlameAfter = true
      add(`${p.coolFlameTerritory} matching heptane tests are in cool-flame territory (above 2.4 mm), where FLEX researchers reported burning continuing invisibly after visible extinction. Drawn as a faint glow; the table records visible extinction only.`, 'PSI-69 FLEX science flag')
    }
    return r
  }

  if (p.state === 'gas') {
    r.behaviour = 'burner'
    r.label = p.burner === 'sphere' ? 'Spherical flame around a porous burner' : p.burner === 'disk' ? 'Flat burner flame' : 'Gas-jet flame'
    add(p.burner === 'sphere' ? 'CFI-G burns gas issuing from a porous sphere, giving a near-spherical flame.' : p.burner === 'disk' ? 'ACME burns gas on a flat porous burner.' : 'SPICE burns gas from a nozzle into co-flowing air.',
      'Investigation hardware descriptions, NASA PSI')
    if (p.coolFlameRecorded > 0) {
      r.coolFlameAfter = true
      add(`${p.coolFlameRecorded} matching tests record a cool flame. NASA's CFI-G video shows a hot flame that seems to go out, then a cool flame too faint to see in real time.`, 'PSI-159 CFI-G table; NASA video jsc2021m000185')
    }
    return r
  }

  // ---- solids --------------------------------------------------------------
  if (p.shape === 'rod') {
    r.behaviour = 'cap'
    r.label = 'Cap flame on the rod tip'
    add('Rods burned in microgravity do not spread along the rod; the flame sits on the tip "like a candle flame at the end of a fat wick".', 'Olson, NASA/TM-2004-213114, p. 123')
    if (p.topClass === 'extinguished_low_flow' || p.topClass === 'self_extinguished') {
      r.quench = true
      add('Ending: at very low flow "the flame shrinks to a hemispherical blue flame and oscillates with increasing amplitude just before going out".', 'BASS-II Summary Report, NASA/TM-20210011385, p. 64')
    }
    if (p.topClass === 'blowoff') {
      r.holeBlowoff = true
      add('Ending: "Blowoff extinction is initiated by the formation of a hole in the flame sheet in the stagnation region of the flame."', 'BASS-II Summary Report, NASA/TM-20210011385, p. 64')
    }
    return r
  }

  if (FLAT.has(p.shape)) {
    const flow = p.flow ?? p.lowestFlow
    const starved = THIN.has(p.shape) && flow != null && flow <= FLAMELET_MAX_FLOW
    // NASA's notes decide it only when most of the matching tests say so;
    // otherwise they are mentioned, and low airflow is the trigger.
    // With one drawn test, only that test's own notes count.
    const noted = p.drawnTest ? !!p.drawnFlamelet : p.flameletTests.length > 0 && p.flameletTests.length * 2 >= p.matchingCount
    if (starved || noted) {
      r.behaviour = 'fingering'
      r.canReignite = true
      r.label = 'Starved flame breaking into flamelets'
      if (noted) add(p.drawnTest ? `NASA's notes for drawn test ${p.drawnTest} record the flame turning into flamelets.` : `NASA's notes for matching test${p.flameletTests.length > 1 ? 's' : ''} ${p.flameletTests.join(' and ')} record the flame turning into flamelets.`, 'BASS-II Summary Report, App. A, p. 113')
      add(`At very low airflow (${flow != null ? `${flow} cm/s` : 'low'}; flamelets drawn at or below ${FLAMELET_MAX_FLOW} cm/s, where NASA saw them) the front breaks into flamelets that survive by drawing oxygen from the sides, branch and die, leaving char fingers.`,
        'NASA Glenn, NTRS 20050217475 (ground experiment simulating microgravity)')
      add('If the airflow is turned back up, the flamelets flare up and re-form a full flame front.', 'NASA Glenn, NTRS 20050217475')
      return r
    }
    if (p.flameletTests.length > 0 && THIN.has(p.shape))
      add(`${p.flameletTests.length} of the ${p.matchingCount} matching tests (${p.flameletTests.join(', ')}) record the flame turning into flamelets at very low airflow. Choose an airflow of ${FLAMELET_MAX_FLOW} cm/s or less to see that behaviour.`, 'BASS-II Summary Report, App. A, p. 113')
    r.behaviour = 'front'
    r.label = p.direction === 'concurrent' ? 'Flame front pushed ahead by concurrent flow'
      : p.direction === 'opposed' ? 'Short flame front facing the oncoming air' : 'Flame front across the sample'
    add(p.direction === 'opposed' ? 'Opposed flow: the flame spreads upwind, as microgravity flames preferentially do.' :
      p.direction === 'concurrent' ? 'Concurrent flow carries the flame ahead of the burning zone over fresh fuel.' : 'The flow direction is not recorded for these tests.',
      p.direction ? 'Olson, NASA/TM-2004-213114, p. 123' : 'Test table')
    return r
  }

  r.behaviour = 'shell'
  r.label = p.shape === 'candle' ? 'Round, dim candle flame' : 'Flame shell around the sample'
  add('Without buoyancy the flame wraps the sample as a dim, rounded shell.', 'Illustration; BASS records no ending for these samples')
  return r
}
