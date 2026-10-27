import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET } from './supabase'

export interface CleanupResult {
  checked: number
  deleted: number
  bytesFreed: number
  failed: { id: string; title: string; error: string }[]
}

async function listAll(sb: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const o of data) if (o.id) out.push(`${prefix}/${o.name}`) // folders have id === null
    if (data.length < 1000) break
    offset += 1000
  }
  return out
}

/**
 * Deletes cars whose expires_at is in the past (never touches expires_at IS NULL).
 * Idempotent: a car is only removed from the DB after its files are gone, so a partial
 * failure is simply retried on the next run.
 */
export async function runCleanup(sb: SupabaseClient, batch = 25): Promise<CleanupResult> {
  const result: CleanupResult = { checked: 0, deleted: 0, bytesFreed: 0, failed: [] }
  const nowIso = new Date().toISOString()

  const { data: cars, error } = await sb
    .from('cars')
    .select('id,title,slug,total_bytes')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(batch)
  if (error) throw error
  result.checked = cars?.length ?? 0

  for (const car of cars ?? []) {
    try {
      // Re-check right before deleting (an admin may have just extended it).
      const { data: still } = await sb
        .from('cars')
        .select('id')
        .eq('id', car.id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .maybeSingle()
      if (!still) continue

      const { data: files, error: fErr } = await sb
        .from('car_files')
        .select('path,thumb_path,size')
        .eq('car_id', car.id)
      if (fErr) throw fErr

      const paths = new Set<string>()
      let bytes = 0
      for (const f of files ?? []) {
        if (f.path) paths.add(f.path)
        if (f.thumb_path) paths.add(f.thumb_path)
        bytes += Number(f.size) || 0
      }
      // Also sweep the whole prefix cars/<id>/ so orphaned uploads are removed too.
      for (const prefix of [`cars/${car.id}`, `cars/${car.id}/thumbs`]) {
        for (const p of await listAll(sb, prefix)) paths.add(p)
      }

      const all = Array.from(paths)
      for (let i = 0; i < all.length; i += 100) {
        const { error: rErr } = await sb.storage.from(BUCKET).remove(all.slice(i, i + 100))
        if (rErr) throw rErr
      }

      // Files are gone -> now remove DB rows (car_files + slug_history cascade).
      const { error: dErr } = await sb.from('cars').delete().eq('id', car.id)
      if (dErr) throw dErr

      await sb.from('deletion_log').insert({
        title: car.title,
        slug: car.slug,
        file_count: files?.length ?? 0,
        bytes_freed: bytes || Number(car.total_bytes) || 0,
      })
      result.deleted += 1
      result.bytesFreed += bytes || Number(car.total_bytes) || 0
    } catch (e) {
      result.failed.push({
        id: car.id,
        title: car.title,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  return result
}
