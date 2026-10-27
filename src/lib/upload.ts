import imageCompression from 'browser-image-compression'
import { BUCKET, SUPABASE_ANON_KEY, SUPABASE_URL } from './env'
import { supabase } from './supabase'
import { extOf } from './utils'
import type { Item } from './types'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (i < tries - 1) await sleep(800 * (i + 1))
    }
  }
  throw last
}

/** Runs async tasks with limited concurrency. */
export async function runPool<T>(list: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (next < list.length) {
      const item = list[next++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/** Upload one object with real byte progress (XHR), authenticated as the logged-in admin. */
export async function uploadObject(
  path: string,
  body: Blob,
  contentType: string,
  onProgress: (loaded: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expired - please log in again')
  const form = new FormData()
  form.append('cacheControl', '31536000')
  form.append('', new Blob([body], { type: contentType }))
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(e.loaded, body.size))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = `Upload failed (${xhr.status})`
      try {
        msg = JSON.parse(xhr.responseText).message || msg
      } catch {
        /* ignore */
      }
      reject(new Error(msg))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.send(form)
  })
}

export const MAX_EDGE = 2400
export const THUMB_EDGE = 600

async function prepareImage(file: File, keepOriginal: boolean): Promise<{ main: Blob; thumb: Blob | null }> {
  let main: Blob = file
  const isGif = file.type === 'image/gif' // keep animation
  if (!keepOriginal && !isGif) {
    try {
      const c = await imageCompression(file, {
        maxWidthOrHeight: MAX_EDGE,
        initialQuality: 0.85,
        useWebWorker: true,
        alwaysKeepResolution: false,
      })
      if (c.size < file.size) main = c
    } catch {
      main = file // compression failed - upload the original
    }
  }
  let thumb: Blob | null = null
  try {
    thumb = await imageCompression(file, {
      maxWidthOrHeight: THUMB_EDGE,
      initialQuality: 0.8,
      fileType: 'image/jpeg',
      useWebWorker: true,
    })
  } catch {
    thumb = null
  }
  return { main, thumb }
}

export interface UploadResult {
  path: string
  thumbPath: string | null
  size: number
  mime: string
}

export async function uploadItem(
  carId: string,
  item: Item,
  keepOriginal: boolean,
  onProgress: (fraction: number) => void,
): Promise<UploadResult> {
  if (!item.file) throw new Error('Missing file data')
  const ext = extOf(item.name).replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const path = `cars/${carId}/${item.id}.${ext}`
  let main: Blob = item.file
  let thumb: Blob | null = null
  if (item.isImage) {
    const r = await prepareImage(item.file, keepOriginal)
    main = r.main
    thumb = r.thumb
  }
  const total = main.size + (thumb?.size ?? 0) || 1
  let thumbPath: string | null = null
  let done = 0
  await withRetry(() => uploadObject(path, main, item.mime, (l) => onProgress((done + l) / total)))
  done = main.size
  if (thumb) {
    const tp = `cars/${carId}/thumbs/${item.id}.jpg`
    try {
      await withRetry(() => uploadObject(tp, thumb as Blob, 'image/jpeg', (l) => onProgress((done + l) / total)))
      thumbPath = tp
    } catch {
      thumbPath = null // gallery falls back to the full image
    }
  }
  onProgress(1)
  return { path, thumbPath, size: main.size, mime: item.mime }
}
