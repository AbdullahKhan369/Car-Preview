import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'car-files'

export function supabaseUrl(): string {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  if (!url) throw new Error('Server is missing VITE_SUPABASE_URL')
  return url
}

/** Service-role client. Server only - this key must never reach the browser. */
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Server is missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
