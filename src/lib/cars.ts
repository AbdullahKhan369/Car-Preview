import { BUCKET } from './env'
import { supabase } from './supabase'
import { addDays, DAY_MS } from './utils'
import type { Car } from './types'

export async function fetchStorageUsage(): Promise<number> {
  const { data, error } = await supabase.rpc('storage_usage')
  if (error) throw error
  return Number(data) || 0
}

/** Delete cars + all their files (originals + thumbnails) + rows + slug history. */
export async function deleteCars(ids: string[]): Promise<void> {
  for (const id of ids) {
    const { data: car, error: cErr } = await supabase.from('cars').select('id,title,slug').eq('id', id).maybeSingle()
    if (cErr) throw cErr
    if (!car) continue
    const { data: files, error: fErr } = await supabase.from('car_files').select('path,thumb_path,size').eq('car_id', id)
    if (fErr) throw fErr
    const paths = (files ?? []).flatMap((f) => [f.path, f.thumb_path]).filter((x): x is string => !!x)
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (error) throw error
    }
    const { error } = await supabase.from('cars').delete().eq('id', id) // cascades car_files + slug_history
    if (error) throw error
    await supabase.from('deletion_log').insert({
      title: car.title, slug: car.slug, file_count: files?.length ?? 0,
      bytes_freed: (files ?? []).reduce((s, f) => s + Number(f.size || 0), 0),
    })
  }
}

export async function setPublished(id: string, isPublished: boolean) {
  const { error } = await supabase.from('cars').update({ is_published: isPublished }).eq('id', id)
  if (error) throw error
}

export async function setExpiry(id: string, expiresAt: string | null) {
  const { error } = await supabase.from('cars').update({ expires_at: expiresAt }).eq('id', id)
  if (error) throw error
}

/** Extend from the current expiry (or from now if already past). */
export async function extendExpiry(car: Pick<Car, 'id' | 'expires_at'>, days: number) {
  const base = car.expires_at && new Date(car.expires_at).getTime() > Date.now() ? new Date(car.expires_at) : new Date()
  await setExpiry(car.id, addDays(days, base))
}

export const threeDaysFromNow = () => new Date(Date.now() + 3 * DAY_MS).toISOString()
