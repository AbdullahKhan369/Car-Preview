import type { VercelRequest, VercelResponse } from '@vercel/node'
import { serviceClient } from '../_lib/supabase'
import { rateLimit, requireAdmin, errMsg } from '../_lib/http'
import { runCleanup } from '../_lib/cleanup'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!rateLimit(req, res, 'run-cleanup', 6)) return
  try {
    const sb = serviceClient()
    const caller = await requireAdmin(req, res, sb)
    if (!caller) return
    const result = await runCleanup(sb)
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) })
  }
}
