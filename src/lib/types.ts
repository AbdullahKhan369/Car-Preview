export interface Car {
  id: string
  title: string
  slug: string
  description: string | null
  cover_file_id: string | null
  is_published: boolean
  expires_at: string | null
  view_count: number
  total_bytes: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface CarFile {
  id: string
  car_id?: string
  path: string
  thumb_path: string | null
  name: string
  mime: string
  size: number
  sort_order: number
  is_image: boolean
}

export interface AdminRow {
  user_id: string
  email: string
  created_at: string
}

export type CarRow = Car & {
  file_count: { count: number }[] | null
  cover: { path: string; thumb_path: string | null } | null
}

export interface PublicCarResult {
  status: 'ok' | 'hidden' | 'expired' | 'not_found' | 'redirect'
  redirect_slug?: string
  car?: Pick<Car, 'id' | 'title' | 'slug' | 'description' | 'cover_file_id' | 'expires_at' | 'created_at'>
  files?: CarFile[]
}

/** One file in the upload / edit grid (either already stored, or newly picked). */
export interface Item {
  id: string
  source: 'existing' | 'new'
  name: string
  mime: string
  size: number
  isImage: boolean
  previewUrl: string | null
  file?: File
  path?: string
  thumbPath?: string | null
  status: 'idle' | 'uploading' | 'done' | 'error'
  progress: number // 0..1
  error?: string
}
