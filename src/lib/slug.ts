import { supabase } from './supabase'
import { baseSlug, RESERVED_SLUGS } from './utils'

/** Returns a slug that is unique across cars + slug_history (ignoring the car being edited). */
export async function resolveUniqueSlug(title: string, fallbackId: string, excludeCarId?: string): Promise<string> {
  const base = baseSlug(title, fallbackId)
  const [cars, hist] = await Promise.all([
    supabase.from('cars').select('id,slug').ilike('slug', `${base}%`).limit(1000),
    supabase.from('slug_history').select('old_slug,car_id').ilike('old_slug', `${base}%`).limit(1000),
  ])
  if (cars.error) throw cars.error
  if (hist.error) throw hist.error
  const taken = new Set<string>(RESERVED_SLUGS)
  for (const c of cars.data ?? []) if (c.id !== excludeCarId) taken.add(c.slug)
  for (const h of hist.data ?? []) if (h.car_id !== excludeCarId) taken.add(h.old_slug)
  if (!taken.has(base)) return base
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}
