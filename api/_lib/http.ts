import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'

const hits = new Map<string, { n: number; reset: number }>()

/** Light, best-effort rate limit (per serverless instance). Returns false if the request was rejected. */
export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  bucket: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const fwd = req.headers['x-forwarded-for']
  const ip = String(Array.isArray(fwd) ? fwd[0] : fwd || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
  const key = `${bucket}:${ip}`
  const now = Date.now()
  if (hits.size > 2000) {
    hits.forEach((v, k) => {
      if (v.reset < now) hits.delete(k)
    })
  }
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    return true
  }
  h.n += 1
  if (h.n > limit) {
    res.setHeader('Retry-After', String(Math.ceil((h.reset - now) / 1000)))
    res.status(429).json({ error: 'Too many requests. Please slow down.' })
    return false
  }
  return true
}

export interface Caller {
  id: string
  email: string
}

/**
 * Verifies the caller's JWT with Supabase Auth AND checks they exist in the `admins` table.
 * Sends the 401/403 response itself and returns null when the caller is not allowed.
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
  sb: SupabaseClient,
): Promise<Caller | null> {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ error: 'Missing access token' })
    return null
  }
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return null
  }
  const { data: row, error: adminErr } = await sb
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (adminErr) {
    res.status(500).json({ error: 'Could not verify admin status' })
    return null
  }
  if (!row) {
    res.status(403).json({ error: 'Not an admin' })
    return null
  }
  return { id: data.user.id, email: data.user.email || '' }
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
