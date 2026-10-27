import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { serviceClient } from '../_lib/supabase'
import { rateLimit, requireAdmin, errMsg } from '../_lib/http'

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!rateLimit(req, res, 'create-admin', 15)) return
  try {
    const sb = serviceClient()
    const caller = await requireAdmin(req, res, sb)
    if (!caller) return

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { email, password } = parsed.data

    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) return res.status(400).json({ error: error?.message || 'Could not create user' })

    const { error: insErr } = await sb.from('admins').insert({ user_id: data.user.id, email })
    if (insErr) {
      await sb.auth.admin.deleteUser(data.user.id) // roll back the orphan auth user
      return res.status(500).json({ error: 'Could not save admin: ' + insErr.message })
    }
    return res.status(200).json({ id: data.user.id, email })
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) })
  }
}
