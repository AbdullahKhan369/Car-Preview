import { Loader2 } from 'lucide-react'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden />
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-accent" role="status" aria-label="Loading">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink-700/70 ${className}`} aria-hidden />
}
