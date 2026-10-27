import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Eye, Link2, RefreshCw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { useDebounced } from '../hooks/useDebounced'
import { useItems } from '../hooks/useItems'
import { deleteCars, fetchStorageUsage } from '../lib/cars'
import { SITE_URL, STORAGE_LIMIT_MB } from '../lib/env'
import { expandInputs, itemFromCarFile } from '../lib/files'
import { IncompleteUploadError, saveCar } from '../lib/saveCar'
import { resolveUniqueSlug } from '../lib/slug'
import type { Car, CarFile } from '../lib/types'
import { addDays, errorMessage, formatBytes, randomId } from '../lib/utils'
import { ExpiryCreate, ExpiryEdit } from './ExpiryPicker'
import FileGrid from './FileGrid'
import Markdown from './Markdown'
import { ConfirmDialog } from './Modal'
import ShareBox from './ShareBox'
import { Spinner } from './Spinner'
import UploadZone from './UploadZone'

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Keep the title under 120 characters'),
  description: z.string().max(5000, 'Keep the description under 5000 characters'),
  isPublished: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  mode: 'create' | 'edit'
  car?: Car
  initialFiles?: CarFile[]
}

export default function CarForm({ mode, car, initialFiles }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const fallbackId = useRef(randomId())
  const carId = useRef(car?.id ?? crypto.randomUUID())
  const existsRef = useRef(mode === 'edit')
  const slugRef = useRef<string | undefined>(car?.slug)

  const initialItems = useMemo(() => (initialFiles ?? []).map(itemFromCarFile), []) // eslint-disable-line react-hooks/exhaustive-deps
  const fm = useItems(initialItems, car?.cover_file_id ?? null)

  const [expiryDays, setExpiryDays] = useState<number | null>(30)
  const [expiresAt, setExpiresAt] = useState<string | null>(car?.expires_at ?? null)
  const [keepOriginal, setKeepOriginal] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stage, setStage] = useState('')
  const [doneSlug, setDoneSlug] = useState<string | null>(null)
  const [previewMd, setPreviewMd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: car?.title ?? '', description: car?.description ?? '', isPublished: car?.is_published ?? true },
  })
  const title = watch('title')
  const description = watch('description')
  const debouncedTitle = useDebounced(title, 400)

  const slugQ = useQuery({
    queryKey: ['slug-preview', debouncedTitle.trim(), car?.id ?? 'new'],
    queryFn: () => resolveUniqueSlug(debouncedTitle, fallbackId.current, carId.current),
    enabled: debouncedTitle.trim().length > 0,
    staleTime: 15_000,
  })
  const liveSlug = slugQ.data

  const usageQ = useQuery({ queryKey: ['storage-usage'], queryFn: fetchStorageUsage })
  const pendingBytes = fm.items.filter((i) => i.source === 'new' && !i.path).reduce((s, i) => s + i.size, 0)
  const limitBytes = STORAGE_LIMIT_MB * 1024 * 1024
  const nearLimit = usageQ.data !== undefined && usageQ.data + pendingBytes > limitBytes * 0.9
  const bigFiles = fm.items.filter((i) => i.size > 50 * 1024 * 1024).length

  const uploadable = fm.items.filter((i) => i.source === 'new')
  const totalUp = uploadable.reduce((s, i) => s + i.size, 0) || 1
  const overall = saving ? uploadable.reduce((s, i) => s + i.size * (i.path ? 1 : i.progress), 0) / totalUp : 0
  const failed = fm.items.filter((i) => i.status === 'error').length

  useEffect(() => {
    if (!saving) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saving])

  const onFiles = async (files: File[]) => {
    setExtracting(true)
    try {
      const added = await expandInputs(files)
      if (added.length === 0) toast.warning('No usable files found (hidden and system files are skipped).')
      else {
        fm.add(added)
        toast.success(`Added ${added.length} file${added.length === 1 ? '' : 's'}`)
      }
    } catch (e) {
      toast.error('Could not read that ZIP: ' + errorMessage(e))
    } finally {
      setExtracting(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    if (mode === 'create' && fm.items.length === 0) {
      toast.error('Add at least one file or ZIP first')
      return
    }
    setSaving(true)
    setStage('Starting…')
    try {
      const res = await saveCar({
        carId: carId.current,
        exists: existsRef.current,
        userId: user.id,
        title: values.title.trim(),
        description: values.description.trim(),
        expiresAt: mode === 'create' ? (expiryDays === null ? null : addDays(expiryDays)) : expiresAt,
        isPublished: mode === 'create' ? true : values.isPublished,
        items: fm.items,
        coverId: fm.effectiveCoverId,
        removed: fm.removed,
        keepOriginal,
        fallbackId: fallbackId.current,
        currentSlug: slugRef.current,
        onItem: fm.patch,
        onStage: setStage,
      })
      existsRef.current = true
      slugRef.current = res.slug
      fm.clearRemoved()
      setDoneSlug(res.slug)
      qc.invalidateQueries({ queryKey: ['cars'] })
      qc.invalidateQueries({ queryKey: ['expiring'] })
      qc.invalidateQueries({ queryKey: ['storage-usage'] })
      qc.invalidateQueries({ queryKey: ['car', carId.current] })
      toast.success(mode === 'create' ? 'Published! Your link is ready.' : 'Changes saved')
    } catch (e) {
      if (e instanceof IncompleteUploadError) {
        existsRef.current = true
        slugRef.current = e.slug
        toast.error(`${e.message}. Press "Retry failed uploads".`)
      } else {
        toast.error(errorMessage(e))
      }
    } finally {
      setSaving(false)
      setStage('')
    }
  })

  const doDelete = async () => {
    if (!car) return
    setDeleting(true)
    try {
      await deleteCars([car.id])
      qc.invalidateQueries({ queryKey: ['cars'] })
      qc.invalidateQueries({ queryKey: ['storage-usage'] })
      toast.success('Car deleted')
      navigate('/admin')
    } catch (e) {
      toast.error(errorMessage(e))
      setDeleting(false)
    }
  }

  // ---------- success screen (create) ----------
  if (mode === 'create' && doneSlug) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400 sm:h-9 sm:w-9" aria-hidden />
          <div>
            <h1 className="text-xl font-extrabold text-zinc-100 sm:text-2xl">Your car is live</h1>
            <p className="text-sm text-zinc-400">Anyone with this link can view it. No login needed.</p>
          </div>
        </div>
        <ShareBox slug={doneSlug} title={title} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/admin/new" reloadDocument className="btn-primary w-full sm:w-auto">Add another car</Link>
          <Link to="/admin" className="btn-ghost w-full sm:w-auto">Go to dashboard</Link>
        </div>
      </div>
    )
  }

  const linkSlug = liveSlug ?? car?.slug
  const slugChanged = mode === 'edit' && liveSlug && liveSlug !== (slugRef.current ?? car?.slug)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-zinc-100 sm:text-2xl">{mode === 'create' ? 'New car' : 'Edit car'}</h1>
        {mode === 'edit' && car && (
          <div className="flex flex-wrap gap-2">
            <a href={`/${slugRef.current ?? car.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost"><Eye className="h-4 w-4" /> View page</a>
            <button type="button" className="btn-ghost !text-red-400" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        )}
      </div>

      {mode === 'edit' && (doneSlug || car?.slug) && <ShareBox slug={doneSlug ?? slugRef.current ?? car!.slug} title={title || car!.title} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------- files ---------- */}
        <section className="min-w-0 space-y-4" aria-label="Files">
          <UploadZone onFiles={onFiles} busy={extracting || saving} compact={fm.items.length > 0} />

          {(nearLimit || bigFiles > 0) && (
            <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                {nearLimit && <p>This upload ({formatBytes(pendingBytes)}) will push storage close to the {formatBytes(limitBytes)} limit. Delete old cars first or turn compression on.</p>}
                {bigFiles > 0 && <p>{bigFiles} file{bigFiles === 1 ? ' is' : 's are'} over 50 MB. The free Supabase plan may reject files that large.</p>}
              </div>
            </div>
          )}

          {fm.items.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400">
                <span>{fm.items.length} file{fm.items.length === 1 ? '' : 's'} · {formatBytes(fm.items.reduce((s, i) => s + i.size, 0))}. Drag the handle to reorder.</span>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-[#f2b84b]" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} disabled={saving} />
                  Keep original quality
                </label>
              </div>
              <FileGrid items={fm.items} coverId={fm.effectiveCoverId} disabled={saving} onReorder={fm.reorder} onRemove={fm.remove} onRename={(id, name) => fm.patch(id, { name })} onCover={fm.setCoverId} />
            </>
          ) : (
            <p className="text-center text-sm text-zinc-500">{mode === 'create' ? 'Nothing added yet. Files appear here before you publish.' : 'This car has no files.'}</p>
          )}
        </section>

        {/* ---------- details ---------- */}
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20 lg:-mx-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:px-1">
          <div className="card space-y-5 p-4">
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" className="input" placeholder="Honda City 2020 Black" autoComplete="off" aria-invalid={!!errors.title} {...register('title')} />
              {errors.title && <p className="err">{errors.title.message}</p>}
              {title.trim() && (
                <p className="hint flex items-start gap-1.5 break-all" aria-live="polite">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{linkSlug ? `${SITE_URL}/${linkSlug}` : 'Checking link…'}{slugChanged && ' (the old link will keep working)'}</span>
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label className="text-sm font-semibold text-zinc-200" htmlFor="description">Description <span className="font-normal text-zinc-500">(optional, Markdown ok)</span></label>
                <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setPreviewMd((v) => !v)}>{previewMd ? 'Edit' : 'Preview'}</button>
              </div>
              {previewMd ? (
                <div className="min-h-[140px] overflow-x-auto rounded-lg border border-ink-600 bg-ink-900 p-3 text-sm">{description.trim() ? <Markdown text={description} /> : <span className="text-zinc-500">Nothing to preview</span>}</div>
              ) : (
                <textarea id="description" rows={6} className="input resize-y" placeholder={'Price, mileage, condition…\n\n**Tip:** use Markdown for bold and lists.'} {...register('description')} />
              )}
              {errors.description && <p className="err">{errors.description.message}</p>}
            </div>

            {mode === 'create' ? <ExpiryCreate days={expiryDays} onChange={setExpiryDays} /> : <ExpiryEdit expiresAt={expiresAt} onChange={setExpiresAt} />}

            {mode === 'edit' && (
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#f2b84b]" {...register('isPublished')} />
                <span className="text-sm"><span className="font-semibold text-zinc-200">Published</span><br /><span className="text-zinc-500">Untick to hide this car. The link then shows "not available".</span></span>
              </label>
            )}
          </div>

          {saving && (
            <div className="card p-4" aria-live="polite">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-zinc-200"><Spinner className="h-4 w-4 text-accent" /> {stage}</span>
                {uploadable.length > 0 && <span className="font-semibold text-accent">{Math.round(overall * 100)}%</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${overall * 100}%` }} />
              </div>
              <p className="hint">Keep this tab open until it finishes.</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full !py-3 text-base" disabled={saving || extracting}>
            {saving ? <Spinner className="h-5 w-5" /> : failed > 0 ? <RefreshCw className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Working…' : failed > 0 ? 'Retry failed uploads' : mode === 'create' ? 'Publish & get link' : 'Save changes'}
          </button>
        </aside>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this car?" danger busy={deleting} confirmLabel="Delete forever" onConfirm={doDelete} onCancel={() => setConfirmDelete(false)}
        message={<>This permanently deletes <strong className="text-zinc-200">{car?.title}</strong>, all its files and its link. This cannot be undone.</>} />
    </form>
  )
}
