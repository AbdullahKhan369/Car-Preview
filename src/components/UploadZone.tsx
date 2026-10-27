import { UploadCloud } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Spinner } from './Spinner'

export default function UploadZone({ onFiles, busy, compact }: { onFiles: (f: File[]) => void; busy?: boolean; compact?: boolean }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => accepted.length > 0 && onFiles(accepted),
    multiple: true,
    disabled: busy,
  })
  return (
    <div
      {...getRootProps()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${compact ? 'gap-1 px-3 py-5 sm:px-4 sm:py-6' : 'gap-2 px-4 py-10 sm:px-6 sm:py-14'} ${isDragActive ? 'border-accent bg-accent/10' : 'border-ink-500 bg-ink-900 hover:border-zinc-500'} ${busy ? 'cursor-wait opacity-70' : ''}`}
    >
      <input {...getInputProps()} aria-label="Choose files or a ZIP" />
      {busy ? <Spinner className="h-8 w-8 text-accent" /> : <UploadCloud className={`text-accent ${compact ? 'h-7 w-7' : 'h-9 w-9 sm:h-10 sm:w-10'}`} aria-hidden />}
      <p className={`font-bold text-zinc-100 ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
        {busy ? 'Reading files…' : isDragActive ? 'Drop to add' : compact ? 'Add more files or a ZIP' : 'Drop the ZIP here'}
      </p>
      <p className="text-xs text-zinc-500 sm:text-sm">
        {busy ? 'Extracting the ZIP in your browser' : 'or click to browse. Photos, videos, PDFs and ZIP files all work.'}
      </p>
    </div>
  )
}
