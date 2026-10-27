import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'

export interface GalleryImage { url: string; thumb: string; name: string }

/** Swipeable (scroll-snap) main image + thumbnail strip. Tap/click opens the lightbox. */
export default function Gallery({ images, onOpen }: { images: GalleryImage[]; onOpen: (index: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)

  const go = (i: number) => {
    const el = scroller.current
    if (!el) return
    const n = Math.max(0, Math.min(images.length - 1, i))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== idx) setIdx(i)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="no-scrollbar flex aspect-[4/3] max-h-[75vh] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl bg-ink-900 lg:aspect-[3/2]"
          role="region"
          aria-label="Photo gallery"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') go(idx + 1); if (e.key === 'ArrowLeft') go(idx - 1) }}
        >
          {images.map((im, i) => (
            <button key={im.url} className="relative h-full w-full shrink-0 snap-center focus-visible:outline-none" onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1} of ${images.length} full screen`}>
              <img src={im.url} alt={im.name} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-contain" draggable={false} />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 disabled:opacity-30 md:flex" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous photo"><ChevronLeft /></button>
            <button className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 disabled:opacity-30 md:flex" onClick={() => go(idx + 1)} disabled={idx === images.length - 1} aria-label="Next photo"><ChevronRight /></button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{idx + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photo thumbnails">
          {images.map((im, i) => (
            <button key={im.url} role="tab" aria-selected={i === idx} aria-label={`Photo ${i + 1}`} onClick={() => go(i)} className={`h-14 w-[4.5rem] shrink-0 overflow-hidden sm:h-16 sm:w-20 rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${i === idx ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={im.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
