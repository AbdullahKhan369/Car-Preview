import { supabase } from './supabase'
import type { AdminRow } from './types'

async function call<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Your session expired. Please log in again.')
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON response (e.g. running `vite` without `vercel dev`) */
  }
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}). Are the /api functions running?`)
  return json as T
}

export const createAdmin = (email: string, password: string) =>
  call<Pick<AdminRow, 'email'> & { id: string }>('/api/admin/create-admin', { email, password })
export const updateAdminPassword = (userId: string, password: string) =>
  call<{ ok: true }>('/api/admin/update-admin', { userId, password })
export const deleteAdmin = (userId: string) => call<{ ok: true }>('/api/admin/delete-admin', { userId })
export interface CleanupResult {
  checked: number
  deleted: number
  bytesFreed: number
  failed: { id: string; title: string; error: string }[]
}
export const runCleanupNow = () => call<CleanupResult>('/api/admin/run-cleanup', {})
