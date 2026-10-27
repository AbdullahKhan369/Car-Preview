import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true, breaks: true }) as string, { USE_PROFILES: { html: true } }),
    [text],
  )
  return <div className={`md max-w-full break-words [overflow-wrap:anywhere] [&_img]:h-auto [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
