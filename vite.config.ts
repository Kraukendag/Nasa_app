import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite bundles the app into plain static files (HTML + JS + CSS).
// `base: './'` makes those files work from any folder, so the built site
// can be opened locally or hosted anywhere without a server config.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
})
