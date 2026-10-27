import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { Spinner } from './Spinner'

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="card relative max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-lg font-bold text-zinc-100">{title}</h2>
          <button className="btn-icon -mr-2 -mt-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog(props: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel } = props
  return (
    <Modal open={open} onClose={busy ? () => undefined : onCancel} title={title}>
      <div className="text-sm text-zinc-400">{message}</div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-ghost w-full sm:w-auto" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className={`${danger ? 'btn-danger' : 'btn-primary'} w-full sm:w-auto`} onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
