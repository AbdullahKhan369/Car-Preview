import { Car } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ to = '/', size = 'md' }: { to?: string; size?: 'md' | 'lg' }) {
  const big = size === 'lg'
  return (
    <Link to={to} className="inline-flex min-w-0 items-center gap-2 sm:gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-accent text-ink-950 ${big ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-8 w-8'}`}>
        <Car className={big ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-5 w-5'} aria-hidden />
      </span>
      <span className={`truncate font-extrabold tracking-tight text-zinc-100 ${big ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>Car Preview</span>
    </Link>
  )
}
