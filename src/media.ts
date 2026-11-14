// =============================================================================
//  REAL NASA IMAGERY
// =============================================================================
//  Photographs and videos of the real flames, from the NASA Image and Video
//  Library (images.nasa.gov) and NASA's Scientific Visualization Studio. They sit next to the 3D illustration so anyone
//  can compare the drawing with the real thing.
//
//  * Photos are bundled in public/media (small versions, ~15 KB each) so the
//    site still works offline. Videos are linked, not bundled.
//  * Every caption is NASA's own description, shortened; the NASA ID links to
//    the original. NASA imagery is generally not subject to copyright; no NASA
//    logo is used.
//  * Only imagery whose NASA description names the experiment is listed. No
//    FLEX droplet or SPICE flame imagery was found in the library, so those
//    show none rather than a look-alike.
// =============================================================================

export interface MediaItem {
  nasaId: string
  kind: 'image' | 'video'
  /** Bundled file (images) under public/media. */
  file?: string
  date: string
  title: string
  /** NASA's description, shortened. */
  caption: string
  /** The PSI investigations this imagery is from. */
  psi: string[]
  /** True when the imagery is from a related experiment, not a PSI table. */
  related?: boolean
  /** Sample shapes this related imagery is shown for. */
  shapes?: string[]
  /** Where the item lives, when not the NASA Image and Video Library. */
  pageUrl?: string
  /** Materials NASA's caption or file name names (empty = not stated). */
  materials?: string[]
}

// SoFIE imagery: NASA Scientific Visualization Studio, "NASA Studies Fire in
// Microgravity" (svs.gsfc.nasa.gov/31394, released 6 May 2026, credit NASA).
// SoFIE is not one of the 14 PSI investigations, so it is shown for flat
// solid samples and labelled as a related experiment.
const SVS = 'https://svs.gsfc.nasa.gov/31394/'
const FLAT = ['fabric', 'sheet', 'film', 'slab', 'composite sheet']

export const MEDIA: MediaItem[] = [
  { nasaId: 'SVS 31394 · SoFIE GEL', kind: 'image', file: 'svs31394-sofie-gel-pmma.jpg', date: '2026-05-06', psi: [], related: true, shapes: FLAT,
    pageUrl: `${SVS}#media_group_380279`, title: 'Solid Fuel Ignition and Extinction (SoFIE) Growth and Extinction Limits (GEL)',
    caption: 'This image is from the Solid Fuel Ignition and Extinction (SoFIE) Growth and Extinction Limits (GEL) experiment aboard the space station. (NASA’s file name: opposed flow, air, 0.5 mm PMMA.)', materials: ['PMMA'] },
  { nasaId: 'SVS 31394 · SoFIE fabric', kind: 'image', file: 'svs31394-sofie-fabric-0.2s.jpg', date: '2026-05-06', psi: [], related: true, shapes: FLAT,
    pageUrl: `${SVS}#media_group_380278`, title: 'SoFIE: thin fabric sheet in a quiescent chamber',
    caption: 'A thin fabric sheet burning in a quiescent chamber in microgravity. The burning sample generates its own flow as fuel is vaporized, drawing fresh oxygen into the flame; the flame brightens periodically as oxygen is drawn in. Images are 0.2 s apart.' },
  { nasaId: 'jsc2023e013681', kind: 'image', file: 'jsc2023e013681.jpg', date: '2023-03-09', psi: [], related: true, shapes: FLAT,
    pageUrl: `${SVS}#media_group_380285`, title: 'SoFIE Growth and Extinction Limits (GEL)',
    caption: 'A sequence of snapshots taken about 3 seconds apart during the Solid Fuel Ignition and Extinction (SoFIE) Growth and Extinction Limits (GEL) experiment aboard the space station.' },
  { nasaId: 'SVS 31394 · SoFIE', kind: 'image', file: 'svs31394-sofie3.jpg', date: '2026-05-06', psi: [], related: true, shapes: FLAT,
    pageUrl: `${SVS}#media_group_380280`, title: 'Solid Fuel Ignition and Extinction (SoFIE)',
    caption: 'This image is from the Solid Fuel Ignition and Extinction (SoFIE) experiment aboard the space station.' },
  { nasaId: 'iss040e086481', kind: 'image', file: 'iss040e086481.jpg', date: '2014-08-02', psi: ['PSI-25'],
    title: 'BASS-II Experiment',
    caption: 'Image taken on card 8 during BASS-II flame test session with reduced O2 partial pressure. Session conducted on GMT 213.' },
  { nasaId: 'iss040e088023', kind: 'image', file: 'iss040e088023.jpg', date: '2014-08-02', psi: ['PSI-25'],
    title: 'BASS-II Experiment',
    caption: 'Image taken on card 15 during BASS-II flame test session with reduced O2 partial pressure. Session conducted on GMT 214.' },
  { nasaId: 'iss040e023287', kind: 'image', file: 'iss040e023287.jpg', date: '2014-06-27', psi: ['PSI-25'],
    title: 'BASS-II Experiment',
    caption: 'Close-up image photographed during a run of the Burning and Suppression of Solids (BASS) experiment; runs conducted by NASA astronaut Reid Wiseman, Expedition 40.' },
  { nasaId: 'iss040e073120', kind: 'image', file: 'iss040e073120.jpg', date: '2014-07-23', psi: ['PSI-25'],
    title: 'BASS-II Experiment',
    caption: 'Close-up image photographed during a run of the Burning and Suppression of Solids (BASS) experiment, Expedition 40.' },
  { nasaId: 'iss035e015900', kind: 'image', file: 'iss035e015900.jpg', date: '2013-04-10', psi: ['PSI-26'],
    title: 'BASS Experiment Imagery',
    caption: 'One of a series of close-up images photographed during a run of the BASS experiment; runs conducted by NASA astronaut Chris Cassidy, Expedition 35.' },
  { nasaId: 'sts050-232-011', kind: 'image', file: 'sts050-232-011.jpg', date: '1992-07-09', psi: [], related: true,
    title: 'Candle Flames in Microgravity Experiment',
    caption: 'Close-up view inside the glovebox showing a candle flame, Space Shuttle Columbia (STS-50). A separate experiment, not a PSI table: shown for the candle samples.' },
  { nasaId: 'GRC-2021-CN-00008', kind: 'video', date: '2021-01-12', psi: ['PSI-98', 'PSI-99', 'PSI-100'], related: true,
    title: 'Saffire-V Experiment, January 2021', materials: ['PMMA'],
    caption: 'A ribbed PMMA (Plexiglas) sample burning in Saffire-V inside a Cygnus spacecraft. Saffire-V is a later flight of the series whose first three flights are PSI-98 to PSI-100.' },
  { nasaId: 'Saf-VI S8C3+C4 1-sided PMMA_unmapped_jpeg-20x no text', kind: 'video', date: '2024-01-09', psi: ['PSI-98', 'PSI-99', 'PSI-100'], related: true,
    title: 'Saffire-VI inside Northrop Grumman’s Cygnus spacecraft', materials: ['PMMA'],
    caption: 'NASA ignited the final set of Saffire-VI fires inside Cygnus at the end of the NG-19 resupply mission. NASA’s file name identifies the sample as one-sided PMMA.' },
  { nasaId: 'jsc2021m000185_Cool_Flames_Created_Aboard_International_Space_Station', kind: 'video', date: '2021-07-14', psi: ['PSI-159'],
    title: 'Hot Flame Aboard the International Space Station',
    caption: 'A hot flame from the Cool Flames Investigation with Gases. After the flame appears to go out, a cool flame forms, too faint to see in real time.' },
]

export const mediaUrl = (m: MediaItem) => m.pageUrl ?? `https://images.nasa.gov/details/${encodeURIComponent(m.nasaId)}`

/** Imagery related to the chosen material: NASA names the material, or the
 *  imagery is from one of the matching investigations and NASA names none.
 *  Related experiments (SoFIE, candle) only when NASA names the material or
 *  it is the candle shape. */
export function mediaFor(psi: string[], shape: string, material?: string): MediaItem[] {
  return MEDIA.filter((m) => {
    if (m.materials?.length) return !!material && m.materials.includes(material)
    if (m.nasaId === 'sts050-232-011') return shape === 'candle'
    if (m.related && !m.psi.some((p) => psi.includes(p))) return false
    return m.psi.some((p) => psi.includes(p))
  })
}
