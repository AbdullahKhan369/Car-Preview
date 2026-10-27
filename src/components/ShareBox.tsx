import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'sonner'
import { carUrl, copyText, whatsappLink } from '../lib/utils'

export default function ShareBox({ slug, title }: { slug: string; title: string }) {
  const url = carUrl(slug)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } else toast.error('Could not copy. Select the link and copy it manually.')
  }
  return (
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center rounded-lg bg-white p-2" aria-label="QR code for the link">
        <QRCodeSVG value={url} size={112} />
      </div>
      <div className="min-w-0 flex-1">
        <label className="label" htmlFor="share-url">Public link</label>
        <input id="share-url" readOnly value={url} className="input font-mono text-base sm:text-xs" onFocus={(e) => e.currentTarget.select()} />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button className="btn-primary col-span-2 sm:col-span-1" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a className="btn-ghost justify-center" href={whatsappLink(url, title)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a className="btn-ghost justify-center" href={`/${slug}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Open
          </a>
        </div>
      </div>
    </div>
  )
}
