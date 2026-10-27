import { useCallback, useMemo, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { Item } from '../lib/types'

/** State for the file grid: order, cover, renames, removals (existing + newly picked files). */
export function useItems(initial: Item[], initialCoverId: string | null) {
  const [items, setItems] = useState<Item[]>(initial)
  const [removed, setRemoved] = useState<Item[]>([])
  const [coverId, setCoverId] = useState<string | null>(initialCoverId)

  const add = useCallback((more: Item[]) => setItems((cur) => [...cur, ...more]), [])

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)))
  }, [])

  const remove = useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id)
      if (!it) return
      if (it.source === 'existing' || it.path) setRemoved((r) => [...r, it]) // already in storage -> delete on save
      if (it.source === 'new' && it.previewUrl) URL.revokeObjectURL(it.previewUrl)
      setItems((cur) => cur.filter((i) => i.id !== id))
      setCoverId((c) => (c === id ? null : c))
    },
    [items],
  )

  const reorder = useCallback((activeId: string, overId: string) => {
    setItems((cur) => {
      const from = cur.findIndex((i) => i.id === activeId)
      const to = cur.findIndex((i) => i.id === overId)
      return from < 0 || to < 0 ? cur : arrayMove(cur, from, to)
    })
  }, [])

  const clearRemoved = useCallback(() => setRemoved([]), [])

  const effectiveCoverId = useMemo(() => {
    const chosen = items.find((i) => i.id === coverId && i.isImage)
    return chosen ? chosen.id : items.find((i) => i.isImage)?.id ?? null
  }, [items, coverId])

  return { items, removed, coverId, effectiveCoverId, setCoverId, add, patch, remove, reorder, clearRemoved }
}
