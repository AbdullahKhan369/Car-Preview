import { Clock } from 'lucide-react'
import { expiryInfo, ExpiryTone } from '../lib/utils'

const TONE: Record<ExpiryTone, string> = {
  never: 'bg-ink-700 text-zinc-400',
  ok: 'bg-ink-700 text-zinc-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  expired: 'bg-red-500/20 text-red-300',
}

export default function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const { label, tone } = expiryInfo(expiresAt)
  return (
    <span className={`badge shrink-0 whitespace-nowrap ${TONE[tone]}`}>
      <Clock className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
