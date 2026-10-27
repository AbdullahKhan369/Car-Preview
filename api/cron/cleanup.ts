import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'crypto'
import { serviceClient } from '../_lib/supabase'
import { runCleanup } from '../_lib/cleanup'
import { errMsg } from '../_lib/http'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Vercel Cron calls this daily (see vercel.json) with "Authorization: Bearer <CRON_SECRET>".
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET is not configured' })
  const header = req.headers.authorization || ''
  if (!safeEqual(header, `Bearer ${secret}`)) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const sb = serviceClient()
    const result = await runCleanup(sb, 50)
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) })
  }
}
