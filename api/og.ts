import type { VercelRequest, VercelResponse } from '@vercel/node'
import { serviceClient, supabaseUrl, BUCKET } from './_lib/supabase'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function plain(md: string, max = 160): string {
  const t = md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

interface FileRow {
  path: string
  thumb_path: string | null
  is_image: boolean
  sort_order: number
  id: string
}

function page(opts: { title: string; desc: string; url: string; image?: string; status?: number }) {
  const { title, desc, url, image } = opts
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Car Preview">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta http-equiv="refresh" content="0;url=${esc(url)}">
</head><body>
<script>location.replace(${JSON.stringify(url)})</script>
<p><a href="${esc(url)}">${esc(title)}</a></p>
</body></html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug
  const slug = String(raw || '').toLowerCase()
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const site = (process.env.VITE_SITE_URL || `https://${host}`).replace(/\/+$/, '')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return res.status(404).send(page({ title: 'Car Preview', desc: 'Page not found.', url: site }))
  }

  try {
    const sb = serviceClient()
    const sel = '*, files:car_files!car_files_car_id_fkey(id,path,thumb_path,is_image,sort_order)'
    let { data: car } = await sb.from('cars').select(sel).eq('slug', slug).maybeSingle()
    if (!car) {
      const { data: h } = await sb.from('slug_history').select('car_id').eq('old_slug', slug).maybeSingle()
      if (h) ({ data: car } = await sb.from('cars').select(sel).eq('id', h.car_id).maybeSingle())
    }
    if (!car) {
      return res.status(404).send(page({ title: 'Car not found | Car Preview', desc: 'This link does not exist.', url: `${site}/${slug}` }))
    }
    const url = `${site}/${car.slug}`
    const expired = car.expires_at && new Date(car.expires_at).getTime() <= Date.now()
    if (!car.is_published || expired) {
      return res.status(200).send(
        page({
          title: expired ? 'This listing has expired | Car Preview' : 'This car is not available | Car Preview',
          desc: 'This car listing is no longer available.',
          url,
        }),
      )
    }
    const files = ((car.files || []) as FileRow[]).slice().sort((a, b) => a.sort_order - b.sort_order)
    const cover = files.find((f) => f.id === car.cover_file_id) || files.find((f) => f.is_image)
    const imgPath = cover ? cover.thumb_path || cover.path : null
    const image = imgPath
      ? `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${imgPath.split('/').map(encodeURIComponent).join('/')}`
      : undefined
    const desc = plain(car.description || '') || `View photos of ${car.title} on Car Preview.`
    return res.status(200).send(page({ title: car.title, desc, url, image }))
  } catch {
    return res.status(200).send(page({ title: 'Car Preview', desc: 'View car photos and details.', url: `${site}/${slug}` }))
  }
}
