/** Tailwind config.
 *  The colours come straight from the MICRO FLAMMA logo so the whole site
 *  feels like one object: navy from the orbital arrows, red from the
 *  wordmark, blue and orange from the flame, amber from the stars. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    '#070B12',   // page background, darker than the panels
        deep:    '#0B1120',   // panel background
        navy:    '#132033',   // raised surfaces
        edge:    '#1E2D44',   // hairline borders
        flame:   '#ED1C24',   // logo red - alerts, the ignite action
        ember:   '#FF8A5B',   // logo orange - warm flame, 1g
        cryo:    '#29ABE2',   // logo blue - cool flame, 0g
        star:    '#FBB03B',   // logo amber - highlights, warnings
        mute:    '#7D8DA6',   // secondary text
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
