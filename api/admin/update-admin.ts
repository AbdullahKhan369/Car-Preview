import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { serviceClient } from '../_lib/supabase'
import { rateLimit, requireAdmin, errMsg } from '../_lib/http'

const schema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!rateLimit(req, res, 'update-admin', 15)) return
  try {
    const sb = serviceClient()
    const caller = await requireAdmin(req, res, sb)
    if (!caller) return

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { userId, password } = parsed.data

    const { data: target } = await sb.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
    if (!target) return res.status(404).json({ error: 'That user is not an admin' })

    const { error } = await sb.auth.admin.updateUserById(userId, { password })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) })
  }
}
