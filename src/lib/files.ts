import { unzip } from 'fflate'
import { isDisplayableImage, isJunkPath, mimeFromName, naturalCompare } from './utils'
import { publicUrl } from './supabase'
import type { CarFile, Item } from './types'

const isZip = (f: File) =>
  /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed'

export function itemFromFile(file: File): Item {
  const mime = file.type || mimeFromName(file.name)
  const isImage = isDisplayableImage(file.name, mime)
  return {
    id: crypto.randomUUID(),
    source: 'new',
    name: file.name,
    mime,
    size: file.size,
    isImage,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    file,
    status: 'idle',
    progress: 0,
  }
}

export function itemFromCarFile(f: CarFile): Item {
  return {
    id: f.id,
    source: 'existing',
    name: f.name,
    mime: f.mime,
    size: Number(f.size),
    isImage: f.is_image,
    previewUrl: f.is_image ? publicUrl(f.thumb_path || f.path) : null,
    path: f.path,
    thumbPath: f.thumb_path,
    status: 'done',
    progress: 1,
  }
}

/** Extract a ZIP in the browser (worker threads via fflate), skipping junk and flattening folders. */
async function extractZip(file: File): Promise<File[]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const data = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      buf,
      { filter: (e) => !e.name.endsWith('/') && !isJunkPath(e.name) && e.originalSize > 0 },
      (err, out) => (err ? reject(err) : resolve(out)),
    )
  })
  const used = new Set<string>()
  const entries = Object.keys(data)
    .map((full) => ({ full, base: full.split('/').pop() || full }))
    .sort((a, b) => naturalCompare(a.base, b.base) || naturalCompare(a.full, b.full))
  const out: File[] = []
  for (const { full, base } of entries) {
    let name = base
    let n = 2
    while (used.has(name.toLowerCase())) {
      const dot = base.lastIndexOf('.')
      name = dot > 0 ? `${base.slice(0, dot)} (${n})${base.slice(dot)}` : `${base} (${n})`
      n++
    }
    used.add(name.toLowerCase())
    out.push(new File([data[full] as unknown as BlobPart], name, { type: mimeFromName(name) }))
  }
  return out
}

/** Turns whatever was dropped (ZIPs and/or loose files) into a flat, naturally-sorted list of items. */
export async function expandInputs(files: File[]): Promise<Item[]> {
  const loose: File[] = []
  const fromZips: File[] = []
  for (const f of files) {
    if (isZip(f)) fromZips.push(...(await extractZip(f)))
    else if (!isJunkPath(f.name)) loose.push(f)
  }
  loose.sort((a, b) => naturalCompare(a.name, b.name))
  return [...loose, ...fromZips].map(itemFromFile)
}
