import { SITE_URL } from './env'

export const RESERVED_SLUGS = [
  'admin', 'api', 'login', 'logout', 'assets', 'static', 'public', 'favicon', 'og', 'robots',
  'sitemap', 'auth', 'app', 'new', 'edit', 'cars', 'dashboard', '404',
]

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, i)
  return `${v >= 100 || i === 0 ? Math.round(v) : Number(v.toFixed(1))} ${units[i]}`
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

export function randomId(n = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const a = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(a, (x) => chars[x % chars.length]).join('')
}

/** Slug base from a title. Urdu / Hindi / other non-Latin titles fall back to a short random id. */
export function baseSlug(title: string, fallbackId: string): string {
  return slugify(title) || `car-${fallbackId}`
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
}
const BROWSER_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'])

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}
export function mimeFromName(name: string): string {
  return MIME_BY_EXT[extOf(name)] || 'application/octet-stream'
}
/** Images the browser can display (HEIC etc. are treated as plain downloadable files). */
export function isDisplayableImage(name: string, mime: string): boolean {
  return BROWSER_IMAGE_EXT.has(extOf(name)) && (mime.startsWith('image/') || mime === 'application/octet-stream')
}

export function isJunkPath(path: string): boolean {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return true
  if (parts.some((p) => p === '__MACOSX' || p.startsWith('.'))) return true
  const last = parts[parts.length - 1].toLowerCase()
  return ['thumbs.db', 'desktop.ini', 'ehthumbs.db', '.ds_store'].includes(last)
}

// ---------- dates / expiry ----------
export const DAY_MS = 86_400_000
export function addDays(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() + days * DAY_MS).toISOString()
}
export function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export type ExpiryTone = 'never' | 'ok' | 'amber' | 'red' | 'expired'
export function expiryInfo(expiresAt: string | null): { label: string; tone: ExpiryTone; days: number | null } {
  if (!expiresAt) return { label: 'Never', tone: 'never', days: null }
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return { label: 'Expired', tone: 'expired', days: 0 }
  const days = Math.ceil(diff / DAY_MS)
  const label = days <= 1 ? 'Expires today' : `Expires in ${days} days`
  return { label, tone: days <= 2 ? 'red' : days <= 7 ? 'amber' : 'ok', days }
}

// ---------- sharing ----------
export const carUrl = (slug: string) => `${SITE_URL}/${slug}`
export const whatsappLink = (url: string, title: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadFile(url: string, name: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Download failed')
    saveBlob(await res.blob(), name)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
