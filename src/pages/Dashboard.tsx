import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, FileStack, ImageOff, MessageCircle, Pencil, Plus, Search, Trash2, Trash } from 'lucide-react'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import ExpiryBadge from '../components/ExpiryBadge'
import { ConfirmDialog } from '../components/Modal'
import { Skeleton, Spinner } from '../components/Spinner'
import StorageMeter from '../components/StorageMeter'
import { useDebounced } from '../hooks/useDebounced'
import { runCleanupNow } from '../lib/api'
import { deleteCars, extendExpiry, setPublished, threeDaysFromNow } from '../lib/cars'
import { publicUrl, supabase } from '../lib/supabase'
import type { Car, CarRow } from '../lib/types'
import { carUrl, copyText, errorMessage, fmtDate, formatBytes, whatsappLink } from '../lib/utils'

const PAGE_SIZE = 12
type Sort = 'newest' | 'oldest' | 'views' | 'expiring'
const SELECT = '*, file_count:car_files!car_files_car_id_fkey(count), cover:car_files!cars_cover_file_fk(path,thumb_path)'

export default function Dashboard() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<{ ids: string[]; label: string } | null>(null)
  const [confirmCleanup, setConfirmCleanup] = useState(false)
  const q = useDebounced(search.trim(), 350)

  const list = useQuery({
    queryKey: ['cars', q, sort, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let req = supabase.from('cars').select(SELECT, { count: 'exact' })
      if (q) req = req.ilike('title', `%${q.replace(/[%_,()]/g, ' ')}%`)
      if (sort === 'newest') req = req.order('created_at', { ascending: false })
      if (sort === 'oldest') req = req.order('created_at', { ascending: true })
      if (sort === 'views') req = req.order('view_count', { ascending: false })
      if (sort === 'expiring') req = req.order('expires_at', { ascending: true, nullsFirst: false })
      const { data, error, count } = await req.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return { rows: (data ?? []) as unknown as CarRow[], total: count ?? 0 }
    },
  })

  const expiring = useQuery({
    queryKey: ['expiring'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cars').select('id,title,expires_at').not('expires_at', 'is', null)
        .gt('expires_at', new Date().toISOString()).lt('expires_at', threeDaysFromNow()).order('expires_at')
      if (error) throw error
      return (data ?? []) as Pick<Car, 'id' | 'title' | 'expires_at'>[]
    },
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cars'] })
    qc.invalidateQueries({ queryKey: ['expiring'] })
    qc.invalidateQueries({ queryKey: ['storage-usage'] })
  }

  const del = useMutation({
    mutationFn: (ids: string[]) => deleteCars(ids),
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} car${ids.length === 1 ? '' : 's'}`)
      setSelected(new Set())
      setConfirm(null)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const toggle = useMutation({
    mutationFn: (c: Car) => setPublished(c.id, !c.is_published),
    onSuccess: (_d, c) => { toast.success(c.is_published ? 'Car hidden' : 'Car is live again'); refresh() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const extend = useMutation({
    mutationFn: (v: { car: Pick<Car, 'id' | 'expires_at'>; days: number }) => extendExpiry(v.car, v.days),
    onSuccess: (_d, v) => { toast.success(`Extended by ${v.days} days`); refresh() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const cleanup = useMutation({
    mutationFn: runCleanupNow,
    onSuccess: (r) => {
      setConfirmCleanup(false)
      toast.success(r.deleted ? `Deleted ${r.deleted} expired car${r.deleted === 1 ? '' : 's'}, freed ${formatBytes(r.bytesFreed)}` : 'Nothing has expired')
      if (r.failed.length) toast.error(`${r.failed.length} could not be deleted. They will be retried.`)
      refresh()
    },
    onError: (e) => { setConfirmCleanup(false); toast.error(errorMessage(e)) },
  })

  const rows = list.data?.rows ?? []
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const flip = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const copy = async (slug: string) => ((await copyText(carUrl(slug))) ? toast.success('Link copied') : toast.error('Could not copy'))

  return (
    <div className="space-y-6">
      <Helmet><title>Cars | Car Preview</title></Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-zinc-100 sm:text-2xl">Cars</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => setConfirmCleanup(true)}><Trash className="h-4 w-4" /> Run cleanup now</button>
          <Link to="/admin/new" className="btn-primary"><Plus className="h-4 w-4" /> New car</Link>
        </div>
      </div>

      <StorageMeter />

      {(expiring.data?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4" role="status">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200"><AlertTriangle className="h-4 w-4" /> {expiring.data!.length} car{expiring.data!.length === 1 ? '' : 's'} will be deleted within 3 days</p>
          <ul className="space-y-2">
            {expiring.data!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link to={`/admin/cars/${c.id}`} className="min-w-0 max-w-full flex-1 truncate font-semibold text-zinc-100 hover:underline">{c.title}</Link>
                <ExpiryBadge expiresAt={c.expires_at} />
                {[7, 15, 30].map((d) => <button key={d} className="chip" disabled={extend.isPending} onClick={() => extend.mutate({ car: c, days: d })}>+{d} days</button>)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input className="input !pl-9" placeholder="Search by title" aria-label="Search by title" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <select className="input !w-auto min-w-0 flex-1 sm:flex-none" aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(0) }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="views">Most viewed</option>
          <option value="expiring">Expiring soonest</option>
        </select>
        {rows.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" className="h-4 w-4 accent-[#f2b84b]" checked={allOnPage} onChange={() => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n })} />
            Select page
          </label>
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-28 z-20 flex flex-wrap items-center justify-between gap-3 sm:top-16 rounded-xl border border-ink-500 bg-ink-800 p-3 shadow-xl">
          <span className="text-sm font-semibold text-zinc-200">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn-danger" onClick={() => setConfirm({ ids: [...selected], label: `${selected.size} selected car${selected.size === 1 ? '' : 's'}` })}><Trash2 className="h-4 w-4" /> Delete selected</button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : list.isError ? (
        <p className="text-red-400">Could not load cars: {errorMessage(list.error)}</p>
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-4 py-12 text-center sm:py-16">
          <FileStack className="h-10 w-10 text-zinc-600" aria-hidden />
          <p className="text-zinc-300">{q ? `No cars match "${q}".` : 'No cars yet.'}</p>
          {!q && <Link to="/admin/new" className="btn-primary">Upload your first car</Link>}
        </div>
      ) : (
        <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {rows.map((c) => {
            const thumb = c.cover ? publicUrl(c.cover.thumb_path || c.cover.path) : null
            const files = c.file_count?.[0]?.count ?? 0
            return (
              <li key={c.id} className={`card overflow-hidden ${selected.has(c.id) ? 'ring-2 ring-accent' : ''}`}>
                <div className="relative aspect-[16/10] bg-ink-900">
                  {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-700"><ImageOff className="h-10 w-10" aria-hidden /></div>}
                  <label className="absolute left-2 top-2 flex h-8 w-8 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-md bg-black/60 backdrop-blur">
                    <input type="checkbox" className="h-4 w-4 accent-[#f2b84b]" checked={selected.has(c.id)} onChange={() => flip(c.id)} aria-label={`Select ${c.title}`} />
                  </label>
                  <span className={`badge absolute right-2 top-2 backdrop-blur ${c.is_published ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/30 text-zinc-300'}`}>{c.is_published ? 'Published' : 'Hidden'}</span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <Link to={`/admin/cars/${c.id}`} className="line-clamp-1 text-base font-bold text-zinc-100 hover:underline">{c.title}</Link>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">/{c.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span>{fmtDate(c.created_at)}</span><span>{files} file{files === 1 ? '' : 's'}</span><span>{formatBytes(c.total_bytes)}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden />{c.view_count}</span>
                  </div>
                  <ExpiryBadge expiresAt={c.expires_at} />
                  <div className="flex items-center gap-1 border-t border-ink-700 pt-3">
                    <button className="btn-icon" title="Copy link" aria-label="Copy link" onClick={() => copy(c.slug)}><Copy className="h-4 w-4" /></button>
                    <a className="btn-icon" title="Share on WhatsApp" aria-label="Share on WhatsApp" href={whatsappLink(carUrl(c.slug), c.title)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
                    <Link className="btn-icon" title="Edit" aria-label="Edit" to={`/admin/cars/${c.id}`}><Pencil className="h-4 w-4" /></Link>
                    <button className="btn-icon" title={c.is_published ? 'Hide' : 'Unhide'} aria-label={c.is_published ? 'Hide' : 'Unhide'} disabled={toggle.isPending} onClick={() => toggle.mutate(c)}>{c.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <button className="btn-icon ml-auto hover:!text-red-400" title="Delete" aria-label="Delete" onClick={() => setConfirm({ ids: [c.id], label: `"${c.title}"` })}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Pagination">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
          <span className="text-sm text-zinc-400">Page {page + 1} of {pages}</span>
          <button className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
        </nav>
      )}

      <ConfirmDialog open={!!confirm} danger busy={del.isPending} title="Delete permanently?" confirmLabel="Delete" onCancel={() => setConfirm(null)} onConfirm={() => confirm && del.mutate(confirm.ids)}
        message={<>This deletes {confirm?.label} with all photos, files and links. This cannot be undone.</>} />
      <ConfirmDialog open={confirmCleanup} busy={cleanup.isPending} title="Run cleanup now?" confirmLabel="Delete expired cars" danger onCancel={() => setConfirmCleanup(false)} onConfirm={() => cleanup.mutate()}
        message="Cars past their auto-delete date are removed now, instead of waiting for the daily job. Cars set to Never are never touched." />
      {cleanup.isPending && <span className="sr-only"><Spinner /></span>}
    </div>
  )
}
