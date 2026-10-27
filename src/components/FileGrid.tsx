import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, Check, File as FileIcon, FileText, Film, GripVertical, Pencil, Star, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { MAX_FILE_MB } from '../lib/env'
import type { Item } from '../lib/types'
import { formatBytes } from '../lib/utils'

interface Props {
  items: Item[]
  coverId: string | null
  disabled?: boolean
  onReorder: (activeId: string, overId: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onCover: (id: string) => void
}

export default function FileGrid({ items, coverId, disabled, onReorder, onRemove, onRename, onCover }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <Tile key={item.id} item={item} isCover={item.id === coverId} disabled={disabled} onRemove={onRemove} onRename={onRename} onCover={onCover} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Tile({ item, isCover, disabled, onRemove, onRename, onCover }: { item: Item; isCover: boolean; disabled?: boolean } & Pick<Props, 'onRemove' | 'onRename' | 'onCover'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.name)
  const tooBig = item.size > MAX_FILE_MB * 1024 * 1024
  const commit = () => {
    const n = draft.trim()
    if (n && n !== item.name) onRename(item.id, n)
    else setDraft(item.name)
    setEditing(false)
  }
  const Icon = item.mime.startsWith('video/') ? Film : item.mime.includes('pdf') || item.mime.includes('word') || item.mime.startsWith('text/') ? FileText : FileIcon
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
      className={`card group relative overflow-hidden ${isDragging ? 'opacity-80 ring-2 ring-accent' : ''} ${item.status === 'error' ? 'border-red-500/60' : ''}`}
    >
      <div className="relative aspect-square bg-ink-900">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600"><Icon className="h-10 w-10" aria-hidden /></div>
        )}

        {!disabled && (
          <button className="absolute left-1.5 top-1.5 flex h-8 w-8 sm:h-7 sm:w-7 touch-none cursor-grab items-center justify-center rounded-md bg-black/60 text-zinc-200 backdrop-blur active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Drag to reorder ${item.name}`} {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {!disabled && (
          <button className="absolute right-1.5 top-1.5 flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-black/60 text-zinc-200 backdrop-blur hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {item.isImage && (
          <button
            className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isCover ? 'bg-accent text-ink-950' : 'bg-black/60 text-zinc-200 hover:bg-black/80'}`}
            onClick={() => onCover(item.id)}
            disabled={disabled}
            aria-pressed={isCover}
            aria-label={isCover ? 'Cover image' : `Make ${item.name} the cover`}
          >
            <Star className="h-3.5 w-3.5" fill={isCover ? 'currentColor' : 'none'} /> {isCover ? 'Cover' : 'Set cover'}
          </button>
        )}

        {item.status === 'uploading' && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60" role="progressbar" aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${item.progress * 100}%` }} />
          </div>
        )}
        {item.status === 'done' && item.source === 'new' && (
          <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white" title="Uploaded"><Check className="h-4 w-4" /></span>
        )}
        {item.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/75 p-2 text-center text-xs text-red-300" title={item.error}>
            <AlertTriangle className="h-5 w-5" /> Upload failed
            <span className="line-clamp-2 text-red-200/80">{item.error}</span>
          </div>
        )}
      </div>

      <div className="p-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input autoFocus className="input min-w-0 !px-2 !py-1 text-base sm:text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(item.name); setEditing(false) } }} aria-label="File name" />
            <button className="btn-icon !h-8 !w-8 shrink-0 sm:!h-7 sm:!w-7" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Save name"><Check className="h-3.5 w-3.5" /></button>
            <button className="btn-icon !h-8 !w-8 shrink-0 sm:!h-7 sm:!w-7" onMouseDown={(e) => e.preventDefault()} onClick={() => { setDraft(item.name); setEditing(false) }} aria-label="Cancel rename"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-200" title={item.name}>{item.name}</p>
            {!disabled && <button className="btn-icon !h-8 !w-8 shrink-0 sm:!h-6 sm:!w-6" onClick={() => { setDraft(item.name); setEditing(true) }} aria-label={`Rename ${item.name}`}><Pencil className="h-3 w-3" /></button>}
          </div>
        )}
        <p className={`mt-0.5 text-xs ${tooBig ? 'font-semibold text-amber-400' : 'text-zinc-500'}`}>
          {formatBytes(item.size)}{tooBig ? ` · over ${MAX_FILE_MB} MB, may fail` : ''}
        </p>
      </div>
    </li>
  )
}
