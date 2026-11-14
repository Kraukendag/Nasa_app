/** Tailwind config — "lab report" style.
 *  Light paper background, near-black ink, ONE accent colour (burnt orange,
 *  used for selection, links and hazard), and a dark "viewport" colour used
 *  only for the 3D instrument windows. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAFAF7',     // page background
        card: '#FFFFFF',      // panels and tables
        rule: '#E3E1DA',      // hairlines
        ink: '#16181D',       // primary text
        ink2: '#3D424C',      // secondary text
        mute: '#646B78',      // tertiary text (4.6:1 on paper)
        accent: '#B5400F',    // the single accent colour
        wash: '#F3F1EA',      // subtle fills
        viewport: '#0B0F17',  // 3D windows only
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
