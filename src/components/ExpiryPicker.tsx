import { useState } from 'react'
import { addDays, DAY_MS, expiryInfo, fmtDate } from '../lib/utils'
import ExpiryBadge from './ExpiryBadge'

const CHIPS = [7, 15, 30, 60, 90]

/** Create mode: "delete after N days" (null = never). */
export function ExpiryCreate({ days, onChange }: { days: number | null; onChange: (d: number | null) => void }) {
  const [custom, setCustom] = useState(false)
  return (
    <fieldset>
      <legend className="label">Auto-delete after</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`chip ${days === null ? 'chip-on' : ''}`} aria-pressed={days === null} onClick={() => { setCustom(false); onChange(null) }}>Never</button>
        {CHIPS.map((d) => (
          <button key={d} type="button" className={`chip ${days === d && !custom ? 'chip-on' : ''}`} aria-pressed={days === d && !custom} onClick={() => { setCustom(false); onChange(d) }}>{d} days</button>
        ))}
        <button type="button" className={`chip ${custom ? 'chip-on' : ''}`} aria-pressed={custom} onClick={() => { setCustom(true); if (days === null) onChange(30) }}>Custom</button>
      </div>
      {custom && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={3650} className="input !w-28" value={days ?? ''} onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (n >= 1 && n <= 3650) onChange(n) }} aria-label="Number of days" />
          <span className="text-sm text-zinc-400">days</span>
        </div>
      )}
      <p className="hint" aria-live="polite">
        {days === null ? 'This car will never be deleted automatically.' : `This car will be deleted on ${fmtDate(addDays(days))}`}
      </p>
    </fieldset>
  )
}

/** Edit mode: extend, set a date, or set to never. */
export function ExpiryEdit({ expiresAt, onChange }: { expiresAt: string | null; onChange: (v: string | null) => void }) {
  const info = expiryInfo(expiresAt)
  const extend = (d: number) => {
    const base = expiresAt && new Date(expiresAt).getTime() > Date.now() ? new Date(expiresAt) : new Date()
    onChange(new Date(base.getTime() + d * DAY_MS).toISOString())
  }
  const dateValue = expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : ''
  return (
    <fieldset>
      <legend className="label">Auto-delete</legend>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <ExpiryBadge expiresAt={expiresAt} />
        <span className="text-zinc-500">{expiresAt ? `Deleted on ${fmtDate(expiresAt)}` : 'Never deleted automatically'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[7, 15, 30].map((d) => (
          <button key={d} type="button" className="chip" onClick={() => extend(d)}>Extend +{d} days</button>
        ))}
        <button type="button" className={`chip ${info.tone === 'never' ? 'chip-on' : ''}`} onClick={() => onChange(null)}>Never</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="exp-date" className="text-sm text-zinc-400">Custom date</label>
        <input id="exp-date" type="date" className="input !w-auto min-w-0 max-w-full" value={dateValue} min={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && onChange(new Date(`${e.target.value}T23:59:59`).toISOString())} />
      </div>
    </fieldset>
  )
}
