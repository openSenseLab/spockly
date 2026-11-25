/**
 * Production server: serves the built app (dist/) and the short-link API.
 *
 *   npm run build && npm start
 *
 * Environment: PORT (default 8787), SPOCKLY_DATA_DIR (default ./data/shared).
 * Run it behind a reverse proxy with HTTPS (e.g. nginx or Caddy).
 */
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

import { createApi } from './api.ts'

const root = resolve(import.meta.dirname, '..', 'dist')
const port = Number(process.env.PORT ?? 8787)
const api = createApi({ dataDir: resolve(process.env.SPOCKLY_DATA_DIR ?? 'data/shared') })

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

const serveFile = async (path: string, res: import('node:http').ServerResponse, cache: boolean) => {
  res.setHeader('Content-Type', TYPES[extname(path)] ?? 'application/octet-stream')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Built assets have content hashes in their names and never change.
  res.setHeader('Cache-Control', cache ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.end(await readFile(path))
}

createServer(async (req, res) => {
  await api(req, res, async () => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
      const path = normalize(join(root, pathname))
      if (path.startsWith(root) && (await stat(path).then((s) => s.isFile(), () => false))) {
        await serveFile(path, res, pathname.startsWith('/assets/'))
        return
      }
      // Single-page app: every other route (e.g. /s/<id>) gets index.html.
      await serveFile(join(root, 'index.html'), res, false)
    } catch {
      res.statusCode = 500
      res.end('server error')
    }
  })
}).listen(port, () => console.log(`spockly on http://localhost:${port}`))
