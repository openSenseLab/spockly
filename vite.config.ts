import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { createApi } from './server/api.ts'

/** The short-link API runs inside the dev and preview servers too, so one command is enough. */
const shareApi = (): Plugin => {
  const api = createApi({ dataDir: 'data/shared' })
  return {
    name: 'spockly-share-api',
    configureServer: (server) => void server.middlewares.use((req, res, next) => void api(req, res, next)),
    configurePreviewServer: (server) => void server.middlewares.use((req, res, next) => void api(req, res, next)),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), shareApi()],
})
