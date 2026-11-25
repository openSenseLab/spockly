/**
 * Short links for shared journals.
 *
 * A published journal (texts, results, blocks; never raw data or files) is stored
 * as a gzip file under a random 10-character id. Whoever creates it gets a secret
 * token to update or delete it later. No database, no dependencies: plain files.
 *
 *   POST   /api/journals        body: published journal  → 201 { id, token }
 *   GET    /api/journals/:id                              → 200 journal JSON
 *   PUT    /api/journals/:id    Authorization: Bearer …   → 200 { id }
 *   DELETE /api/journals/:id    Authorization: Bearer …   → 204
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

export type ApiOptions = {
  /** Folder for the stored journals. */
  dataDir: string
  /** Largest accepted journal (uncompressed JSON). */
  maxBytes?: number
  /** New links per client IP and hour. */
  createsPerHour?: number
}

type Meta = { tokenHash: string; createdAt: string; updatedAt: string; bytes: number }

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const ID_PATTERN = /^[A-Za-z0-9]{10}$/

const newId = () => {
  const bytes = randomBytes(10)
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

const sameHash = (a: string, b: string) => {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const readBody = (req: IncomingMessage, limit: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new HttpError(413, 'journal too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

/** Only accept what the viewer can render: a published journal (version 2). */
const parseJournal = (body: Buffer) => {
  let journal: unknown
  try {
    journal = JSON.parse(body.toString('utf8'))
  } catch {
    throw new HttpError(400, 'invalid JSON')
  }
  const record = journal as { v?: unknown; cells?: unknown; title?: unknown }
  if (record?.v !== 2 || !Array.isArray(record.cells) || typeof record.title !== 'string') {
    throw new HttpError(400, 'not a published spockly journal')
  }
  return body
}

const send = (res: ServerResponse, status: number, body?: unknown) => {
  res.statusCode = status
  res.setHeader('Cache-Control', 'no-store')
  if (body === undefined) {
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** Connect-style middleware: handles /api/journals…, passes everything else on. */
export const createApi = ({ dataDir, maxBytes = 20 * 1024 * 1024, createsPerHour = 60 }: ApiOptions) => {
  const recent = new Map<string, number[]>()
  const files = (id: string) => ({ journal: join(dataDir, `${id}.json.gz`), meta: join(dataDir, `${id}.meta.json`) })

  const readMeta = async (id: string): Promise<Meta> => {
    try {
      return JSON.parse(await readFile(files(id).meta, 'utf8')) as Meta
    } catch {
      throw new HttpError(404, 'journal not found')
    }
  }

  const authorize = async (req: IncomingMessage, id: string) => {
    const meta = await readMeta(id)
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token || !sameHash(hash(token), meta.tokenHash)) throw new HttpError(403, 'wrong token')
    return meta
  }

  const limitCreates = (req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()
    const times = (recent.get(ip) ?? []).filter((time) => now - time < 3600_000)
    if (times.length >= createsPerHour) throw new HttpError(429, 'too many new links, try again later')
    recent.set(ip, [...times, now])
  }

  const store = async (id: string, body: Buffer, meta: Meta) => {
    await mkdir(dataDir, { recursive: true })
    await writeFile(files(id).journal, gzipSync(body))
    await writeFile(files(id).meta, JSON.stringify(meta))
  }

  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const match = url.pathname.match(/^\/api\/journals(?:\/([^/]+))?\/?$/)
    if (!match) {
      if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' })
      return next?.()
    }
    const id = match[1]

    try {
      if (!id && req.method === 'POST') {
        limitCreates(req)
        const body = parseJournal(await readBody(req, maxBytes))
        let newJournalId = newId()
        while (await stat(files(newJournalId).meta).then(() => true, () => false)) newJournalId = newId()
        const token = randomBytes(24).toString('base64url')
        const now = new Date().toISOString()
        await store(newJournalId, body, { tokenHash: hash(token), createdAt: now, updatedAt: now, bytes: body.length })
        return send(res, 201, { id: newJournalId, token })
      }

      if (!id || !ID_PATTERN.test(id)) return send(res, 404, { error: 'not found' })

      if (req.method === 'GET') {
        await readMeta(id)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Content-Encoding', 'gzip')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(await readFile(files(id).journal))
        return
      }
      if (req.method === 'PUT') {
        const meta = await authorize(req, id)
        const body = parseJournal(await readBody(req, maxBytes))
        await store(id, body, { ...meta, updatedAt: new Date().toISOString(), bytes: body.length })
        return send(res, 200, { id })
      }
      if (req.method === 'DELETE') {
        await authorize(req, id)
        await rm(files(id).journal, { force: true })
        await rm(files(id).meta, { force: true })
        return send(res, 204)
      }
      return send(res, 405, { error: 'method not allowed' })
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message })
      console.error('spockly api:', error)
      return send(res, 500, { error: 'server error' })
    }
  }
}
