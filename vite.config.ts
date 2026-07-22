import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Basis-Pfad für GitHub Pages (https://<user>.github.io/CampingNotizen/).
// Lokal (dev/preview) bleibt "/". Über die Env-Variable VITE_BASE
// (im Deploy-Workflow gesetzt) wird der Repo-Pfad verwendet.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
