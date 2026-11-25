import type { CellOutput, DatasetProfile, Journal, PublishedCell, PublishedJournal } from './types'

const SHARED_TABLE_ROWS = 100
const SHARED_PREVIEW_ROWS = 10
const SHARED_MAP_PREVIEW = 300

const compactProfile = (profile: DatasetProfile): DatasetProfile => ({
  ...profile,
  preview: profile.preview.slice(0, SHARED_PREVIEW_ROWS),
  mapPreview: profile.mapPreview && {
    ...profile.mapPreview,
    features: profile.mapPreview.features.slice(0, SHARED_MAP_PREVIEW),
  },
})

const compactOutput = (output: CellOutput): CellOutput => {
  if (output.type === 'table') return { ...output, rows: output.rows.slice(0, SHARED_TABLE_ROWS) }
  if (output.type === 'inspection') return { ...output, profile: compactProfile(output.profile) }
  return output
}

/** Strip raw data, files and code: a published journal only carries what is needed to read it. */
export const publish = (journal: Journal): PublishedJournal => ({
  v: 2,
  title: journal.title,
  subtitle: journal.subtitle,
  author: journal.author,
  language: journal.language,
  publishedAt: new Date().toISOString(),
  cells: journal.cells.map(
    (cell): PublishedCell =>
      cell.type === 'text'
        ? { type: 'text', markdown: cell.markdown }
        : {
            type: cell.type,
            title: cell.title,
            note: cell.note,
            workspace: cell.workspace,
            outputs: cell.outputs.map(compactOutput),
          },
  ),
})

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const pipe = async (bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer())

/** gzip + base64url so a whole journal fits in the URL fragment (never sent to a server). */
export const encodeJournal = async (published: PublishedJournal) =>
  toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(published)), new CompressionStream('gzip')))

export const decodeJournal = async (payload: string): Promise<PublishedJournal> => {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(payload), new DecompressionStream('gzip')))
  const parsed = JSON.parse(json) as PublishedJournal
  if (parsed.v !== 2 || !Array.isArray(parsed.cells)) throw new Error('Unsupported journal')
  return parsed
}

/** Long link: the whole journal in the URL fragment (fallback without a server). */
export const shareUrl = (payload: string) => `${location.origin}${import.meta.env.BASE_URL}#/view/${payload}`

/** Short link served by the spockly server. */
export const shortUrl = (id: string) => `${location.origin}${import.meta.env.BASE_URL}s/${id}`

const API = `${import.meta.env.BASE_URL}api/journals`

export class ShareError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const request = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new ShareError(response.status, body.error ?? response.statusText)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

const json = (published: PublishedJournal) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(published),
})

/** Store a new shared journal on the server; the token allows later updates. */
export const createShortLink = (published: PublishedJournal) =>
  request<{ id: string; token: string }>(API, { method: 'POST', ...json(published) })

/** Replace the content behind an existing short link (the link stays the same). */
export const updateShortLink = (id: string, token: string, published: PublishedJournal) =>
  request<{ id: string }>(`${API}/${id}`, {
    method: 'PUT',
    ...json(published),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })

export const deleteShortLink = (id: string, token: string) =>
  request<void>(`${API}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })

export const fetchSharedJournal = async (id: string) => {
  const journal = await request<PublishedJournal>(`${API}/${id}`, { method: 'GET' })
  if (journal.v !== 2 || !Array.isArray(journal.cells)) throw new ShareError(400, 'unsupported journal')
  return journal
}

export const downloadFile = (fileName: string, content: string, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName })
  link.click()
  URL.revokeObjectURL(url)
}

export const fileSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'journal'
