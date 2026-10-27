import { useQuery } from '@tanstack/react-query'
import { zip } from 'fflate'
import { Download, FileText, Link2, MessageCircle, Share2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import Gallery from '../components/Gallery'
import Logo from '../components/Logo'
import Markdown from '../components/Markdown'
import { Skeleton, Spinner } from '../components/Spinner'
import { useAuth } from '../hooks/useAuth'
import { publicUrl, supabase } from '../lib/supabase'
import type { PublicCarResult } from '../lib/types'
import { carUrl, copyText, downloadFile, errorMessage, fmtDate, formatBytes, saveBlob, whatsappLink } from '../lib/utils'
import { NotFoundView } from './NotFound'

const LightboxView = lazy(() => import('../components/LightboxView'))

export default function PublicCar() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { isAdmin, loading: authLoading } = useAuth()
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [zipping, setZipping] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['public-car', slug],
    enabled: !!slug,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_car', { p_slug: slug })
      if (error) throw error
      return data as PublicCarResult
    },
  })
  const data = q.data

  // Old links keep working: the RPC tells us the new slug.
  useEffect(() => {
    if (data?.status === 'redirect' && data.redirect_slug) navigate(`/${data.redirect_slug}`, { replace: true })
  }, [data, navigate])

  // Count a view once per browser session; admin views are ignored (here and inside the RPC).
  useEffect(() => {
    if (data?.status !== 'ok' || authLoading || isAdmin) return
    const key = `viewed:${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* private mode: count anyway */ }
    supabase.rpc('increment_view', { p_slug: slug }).then(() => undefined)
  }, [data?.status, authLoading, isAdmin, slug])

  const files = useMemo(() => (data?.files ?? []).map((f) => ({ ...f, url: publicUrl(f.path), thumbUrl: publicUrl(f.thumb_path || f.path) })), [data])
  const images = files.filter((f) => f.is_image)
  const videos = files.filter((f) => !f.is_image && f.mime.startsWith('video/'))
  const docs = files.filter((f) => !f.is_image && !f.mime.startsWith('video/'))

  if (q.isLoading || data?.status === 'redirect') return <PageSkeleton />
  if (q.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
        <Logo />
        <h1 className="text-2xl font-extrabold text-zinc-100">Something went wrong</h1>
        <p className="text-zinc-400">We could not load this page. Check your connection and try again.</p>
        <button className="btn-primary" onClick={() => q.refetch()}>Try again</button>
      </div>
    )
  }
  if (!data || data.status === 'not_found') return <NotFoundView title="Car not found" message="This link does not exist. Check that it was copied completely." />
  if (data.status === 'hidden') return <NotFoundView title="This car is not available" message="The owner has hidden this listing." />
  if (data.status === 'expired') return <NotFoundView title="This listing has expired" message="This car is no longer shared. Ask the seller for a new link." />

  const car = data.car!
  const url = carUrl(car.slug)
  const cover = images.find((i) => i.id === car.cover_file_id) ?? images[0]
  const metaDesc = (car.description || `View photos of ${car.title}`).replace(/[#*_`>~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)

  const share = async () => {
    try {
      await navigator.share({ title: car.title, text: car.title, url })
    } catch { /* cancelled */ }
  }
  const copy = async () => ((await copyText(url)) ? toast.success('Link copied') : toast.error('Could not copy the link'))

  const downloadAll = async () => {
    setZipping('Preparing…')
    try {
      const entries: Record<string, Uint8Array> = {}
      const used = new Set<string>()
      let done = 0
      let next = 0
      const worker = async () => {
        while (next < files.length) {
          const f = files[next++]
          const res = await fetch(f.url)
          if (!res.ok) throw new Error(`Could not fetch ${f.name}`)
          let name = f.name
          for (let n = 2; used.has(name.toLowerCase()); n++) {
            const dot = f.name.lastIndexOf('.')
            name = dot > 0 ? `${f.name.slice(0, dot)} (${n})${f.name.slice(dot)}` : `${f.name} (${n})`
          }
          used.add(name.toLowerCase())
          entries[name] = new Uint8Array(await res.arrayBuffer())
          setZipping(`Preparing ${++done} of ${files.length}…`)
        }
      }
      await Promise.all([worker(), worker(), worker()])
      const out = await new Promise<Uint8Array>((resolve, reject) => zip(entries, { level: 0 }, (e, d) => (e ? reject(e) : resolve(d))))
      saveBlob(new Blob([out as unknown as BlobPart], { type: 'application/zip' }), `${car.slug}.zip`)
    } catch (e) {
      toast.error('Download failed: ' + errorMessage(e))
    } finally {
      setZipping(null)
    }
  }

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{`${car.title} | Car Preview`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={car.title} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={url} />
        {cover && <meta property="og:image" content={cover.thumbUrl} />}
        <meta name="twitter:card" content={cover ? 'summary_large_image' : 'summary'} />
      </Helmet>

      <header className="border-b border-ink-800">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3"><Logo /></div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-x-10 gap-y-8 px-4 py-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:py-10">
        <section className="lg:col-start-1 lg:row-start-1" aria-label="Photos">
          {images.length > 0 ? (
            <Gallery images={images.map((i) => ({ url: i.url, thumb: i.thumbUrl, name: i.name }))} onOpen={setLightbox} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-ink-900 text-zinc-600">No photos</div>
          )}
        </section>

        <section className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-3xl lg:text-4xl">{car.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">Posted {fmtDate(car.created_at)}{car.expires_at && ` · available until ${fmtDate(car.expires_at)}`}</p>
          {car.description && <Markdown text={car.description} className="mt-5 text-[15px] text-zinc-300" />}

          <div className="mt-6 space-y-3">
            {files.length > 0 && (
              <button className="btn-primary w-full !py-3 text-base" onClick={downloadAll} disabled={!!zipping}>
                {zipping ? <Spinner className="h-5 w-5" /> : <Download className="h-5 w-5" />} {zipping ?? `Download all (${files.length})`}
              </button>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-2">
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button className="btn-ghost justify-center" onClick={share}><Share2 className="h-4 w-4" /> Share</button>
              )}
              <button className="btn-ghost justify-center" onClick={copy}><Link2 className="h-4 w-4" /> Copy link</button>
              <a className="btn-ghost justify-center" href={whatsappLink(url, car.title)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
          </div>
        </section>

        {(videos.length > 0 || docs.length > 0) && (
          <section className="space-y-6 lg:col-start-1 lg:row-start-2" aria-label="More files">
            {videos.map((v) => (
              <figure key={v.id} className="space-y-2">
                <video src={v.url} controls preload="metadata" playsInline className="aspect-video w-full rounded-2xl bg-black" />
                <figcaption className="flex items-center justify-between gap-3 text-sm text-zinc-400">
                  <span className="truncate">{v.name}</span>
                  <button className="font-semibold text-accent hover:underline" onClick={() => downloadFile(v.url, v.name)}>Download</button>
                </figcaption>
              </figure>
            ))}
            {docs.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {docs.map((d) => (
                  <li key={d.id} className="card flex items-center gap-3 p-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-accent"><FileText className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-100" title={d.name}>{d.name}</p>
                      <p className="text-xs text-zinc-500">{formatBytes(d.size)}</p>
                    </div>
                    <button className="btn-icon" aria-label={`Download ${d.name}`} onClick={() => downloadFile(d.url, d.name)}><Download className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {lightbox !== null && (
        <Suspense fallback={null}>
          <LightboxView images={images.map((i) => ({ src: i.url, alt: i.name }))} index={lightbox} onClose={() => setLightbox(null)} />
        </Suspense>
      )}
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" role="status" aria-label="Loading car">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3"><Skeleton className="aspect-[3/2] rounded-2xl" /><div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-20" />)}</div></div>
        <div className="space-y-4"><Skeleton className="h-10 w-4/5" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-24" /><Skeleton className="h-12" /></div>
      </div>
    </div>
  )
}
