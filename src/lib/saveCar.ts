import { BUCKET } from './env'
import { supabase } from './supabase'
import { resolveUniqueSlug } from './slug'
import { runPool, uploadItem } from './upload'
import type { Item } from './types'

export class IncompleteUploadError extends Error {
  slug: string
  constructor(message: string, slug: string) {
    super(message)
    this.slug = slug
  }
}

export interface SaveParams {
  carId: string
  exists: boolean // car row already created (edit mode, or a retry after a partial upload)
  userId: string
  title: string
  description: string
  expiresAt: string | null
  isPublished: boolean
  items: Item[] // in display order
  coverId: string | null
  removed: Item[]
  keepOriginal: boolean
  fallbackId: string
  currentSlug?: string
  onItem: (id: string, patch: Partial<Item>) => void
  onStage: (msg: string) => void
}

/**
 * Single code path for create + edit:
 * slug -> car row -> remove deleted files -> upload new files (4 in parallel, retries)
 * -> upsert car_files (order, names) -> cover / totals / published flag.
 * New cars stay hidden until every file is uploaded, so visitors never see half a car.
 */
export async function saveCar(p: SaveParams): Promise<{ slug: string }> {
  p.onStage('Preparing link…')
  let slug = await resolveUniqueSlug(p.title, p.fallbackId, p.carId)

  if (!p.exists) {
    let res = await supabase.from('cars').insert({
      id: p.carId, title: p.title, slug, description: p.description || null,
      expires_at: p.expiresAt, is_published: false, created_by: p.userId,
    })
    if (res.error?.code === '23505') {
      slug = await resolveUniqueSlug(p.title, p.fallbackId, p.carId) // lost a race - pick again
      res = await supabase.from('cars').insert({
        id: p.carId, title: p.title, slug, description: p.description || null,
        expires_at: p.expiresAt, is_published: false, created_by: p.userId,
      })
    }
    if (res.error) throw res.error
  } else {
    p.onStage('Saving details…')
    const { error } = await supabase
      .from('cars')
      .update({ title: p.title, slug, description: p.description || null, expires_at: p.expiresAt })
      .eq('id', p.carId)
    if (error) throw error
    if (p.currentSlug && p.currentSlug !== slug) {
      // keep the old link alive (redirects to the new one)
      const h = await supabase.from('slug_history').upsert({ old_slug: p.currentSlug, car_id: p.carId }, { onConflict: 'old_slug' })
      if (h.error) throw h.error
      await supabase.from('slug_history').delete().eq('old_slug', slug).eq('car_id', p.carId)
    }
  }

  // 1) removals
  if (p.removed.length) {
    p.onStage('Removing files…')
    const paths = p.removed.flatMap((i) => [i.path, i.thumbPath]).filter((x): x is string => !!x)
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (error) throw error
    }
    const { error } = await supabase.from('car_files').delete().in('id', p.removed.map((i) => i.id))
    if (error) throw error
  }

  // 2) uploads
  const todo = p.items.filter((i) => i.source === 'new' && !i.path)
  const results = new Map<string, { path: string; thumbPath: string | null; size: number; mime: string }>()
  let failures = 0
  if (todo.length) {
    p.onStage(`Uploading ${todo.length} file${todo.length === 1 ? '' : 's'}…`)
    await runPool(todo, 4, async (item) => {
      p.onItem(item.id, { status: 'uploading', progress: 0, error: undefined })
      try {
        let last = 0
        const r = await uploadItem(p.carId, item, p.keepOriginal, (f) => {
          const now = Date.now()
          if (f < 1 && now - last < 150) return // throttle re-renders
          last = now
          p.onItem(item.id, { progress: f })
        })
        results.set(item.id, r)
        p.onItem(item.id, { status: 'done', progress: 1, path: r.path, thumbPath: r.thumbPath, size: r.size, mime: r.mime })
      } catch (e) {
        failures++
        p.onItem(item.id, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
      }
    })
  }
  if (failures > 0) {
    throw new IncompleteUploadError(`${failures} file${failures === 1 ? '' : 's'} failed to upload`, slug)
  }

  // 3) file rows (order + names)
  p.onStage('Finishing up…')
  const final = p.items.map((i) => ({ ...i, ...(results.get(i.id) ?? {}) }))
  const rows = final.map((i, idx) => ({
    id: i.id, car_id: p.carId, path: i.path as string, thumb_path: i.thumbPath ?? null,
    name: i.name, mime: i.mime, size: i.size, sort_order: idx, is_image: i.isImage,
  }))
  if (rows.length) {
    const { error } = await supabase.from('car_files').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  // 4) cover, totals, publish
  const cover = rows.find((r) => r.id === p.coverId && r.is_image) ?? rows.find((r) => r.is_image) ?? null
  const { error } = await supabase
    .from('cars')
    .update({
      total_bytes: rows.reduce((s, r) => s + Number(r.size), 0),
      cover_file_id: cover?.id ?? null,
      is_published: p.isPublished,
    })
    .eq('id', p.carId)
  if (error) throw error
  return { slug }
}
