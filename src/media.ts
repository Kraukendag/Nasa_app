// =============================================================================
//  REAL NASA IMAGERY
// =============================================================================
//  Photographs and videos of the real flames, from the NASA Image and Video
//  Library (images.nasa.gov). They sit next to the 3D illustration so anyone
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
}

export const MEDIA: MediaItem[] = [
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
    title: 'Saffire-V Experiment, January 2021',
    caption: 'A ribbed PMMA (Plexiglas) sample burning in Saffire-V inside a Cygnus spacecraft. Saffire-V is a later flight of the series whose first three flights are PSI-98 to PSI-100.' },
  { nasaId: 'Saf-VI S8C3+C4 1-sided PMMA_unmapped_jpeg-20x no text', kind: 'video', date: '2024-01-09', psi: ['PSI-98', 'PSI-99', 'PSI-100'], related: true,
    title: 'Saffire-VI inside Northrop Grumman’s Cygnus spacecraft',
    caption: 'NASA ignited the final set of Saffire-VI fires inside Cygnus at the end of the NG-19 resupply mission. NASA’s file name identifies the sample as one-sided PMMA.' },
  { nasaId: 'jsc2021m000185_Cool_Flames_Created_Aboard_International_Space_Station', kind: 'video', date: '2021-07-14', psi: ['PSI-159'],
    title: 'Hot Flame Aboard the International Space Station',
    caption: 'A hot flame from the Cool Flames Investigation with Gases. After the flame appears to go out, a cool flame forms, too faint to see in real time.' },
]

export const mediaUrl = (m: MediaItem) => `https://images.nasa.gov/details/${encodeURIComponent(m.nasaId)}`

/** Imagery for the investigations behind the current Lab selection. */
export function mediaFor(psi: string[], shape: string): MediaItem[] {
  return MEDIA.filter((m) => m.psi.some((p) => psi.includes(p)) || (shape === 'candle' && m.nasaId === 'sts050-232-011'))
}
