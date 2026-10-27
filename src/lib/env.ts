export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '') as string
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || window.location.origin).replace(/\/+$/, '')
export const STORAGE_LIMIT_MB = Number(import.meta.env.VITE_STORAGE_LIMIT_MB) || 1024
export const BUCKET = 'car-files'
export const MAX_FILE_MB = 50 // Supabase free-tier per-file limit
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
