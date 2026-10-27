import { useQuery } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { STORAGE_LIMIT_MB } from '../lib/env'
import { fetchStorageUsage } from '../lib/cars'
import { formatBytes } from '../lib/utils'

export default function StorageMeter() {
  const { data: used, isLoading, isError } = useQuery({ queryKey: ['storage-usage'], queryFn: fetchStorageUsage, refetchInterval: 60_000 })
  const limit = STORAGE_LIMIT_MB * 1024 * 1024
  const pct = used ? Math.min(100, (used / limit) * 100) : 0
  const danger = pct > 85
  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-2 font-semibold text-zinc-200">
          <HardDrive className="h-4 w-4 text-zinc-500" aria-hidden /> Storage
        </span>
        <span className={danger ? 'font-semibold text-red-400' : 'text-zinc-400'}>
          {isLoading ? 'Checking…' : isError ? 'Unavailable' : `${formatBytes(used ?? 0)} of ${formatBytes(limit)} used`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
        <div className={`h-full rounded-full transition-all ${danger ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${Math.max(pct, used ? 1 : 0)}%` }} />
      </div>
      {danger && <p className="mt-2 text-xs text-red-400">Storage is almost full. Delete old cars or shorten the auto-delete time.</p>}
    </div>
  )
}
