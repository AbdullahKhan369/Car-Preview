import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { serviceClient } from '../_lib/supabase'
import { rateLimit, requireAdmin, errMsg } from '../_lib/http'

const schema = z.object({ userId: z.string().uuid() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!rateLimit(req, res, 'delete-admin', 15)) return
  try {
    const sb = serviceClient()
    const caller = await requireAdmin(req, res, sb)
    if (!caller) return

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { userId } = parsed.data

    if (userId === caller.id) {
      return res.status(400).json({ error: 'You cannot remove yourself. Ask another admin to do it.' })
    }
    const { count, error: cErr } = await sb.from('admins').select('user_id', { count: 'exact', head: true })
    if (cErr) return res.status(500).json({ error: cErr.message })
    if ((count ?? 0) <= 1) return res.status(400).json({ error: 'Cannot remove the last remaining admin' })

    const { error: dErr } = await sb.from('admins').delete().eq('user_id', userId)
    if (dErr) return res.status(500).json({ error: dErr.message })
    const { error } = await sb.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) })
  }
}
