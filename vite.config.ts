import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite bundles the app into plain static files (HTML + JS + CSS).
// `base: './'` makes those files work from any folder, so the built site
// can be opened locally or hosted anywhere without a server config.
export default defineConfig({
  plugins: [react()],
  base: './',
  // A new id on every build. Data files are requested with it (?v=...), so a
  // browser or offline cache can never hand new code an old data file.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
