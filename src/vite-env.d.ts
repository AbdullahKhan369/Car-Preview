/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SITE_URL?: string
  readonly VITE_STORAGE_LIMIT_MB?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
