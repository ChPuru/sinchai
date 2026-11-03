import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Exp 5: the React app calls the Express API with relative URLs (/api/...). The proxy below forwards them to
// sinchai-server, so in development there is no CORS and the browser only ever talks to one origin.
const api = { '/api': { target: 'http://localhost:3000', changeOrigin: true } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
})
