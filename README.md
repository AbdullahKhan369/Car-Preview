# Car Preview

Drop a ZIP of car photos, add a title, get a public link anyone can open. No login for viewers.

## How the boss uses it (4 steps)

1. Open `https://yourdomain.com/admin/login` and log in.
2. Click **New car**, then drop the ZIP (or photos, videos, PDFs) onto the big box. Drag the grip handle to reorder, click **Set cover** to pick the main photo.
3. Type a **Title** (the link is built from it, for example `/honda-city-2020-black`), add an optional description, and choose how many days until it auto-deletes (default 30).
4. Click **Publish & get link**. Copy the link, tap **WhatsApp**, or show the QR code.

Later: open the car from the dashboard to edit, add or remove photos, extend the expiry, hide it, or delete it.

## Features

- ZIP extracted in the browser (no server size limits), junk files skipped, natural sort (img2 before img10)
- Image compression (2400 px, quality 0.85) + 600 px thumbnails, optional "Keep original quality"
- Real upload progress, 4 parallel uploads, automatic retries, "Retry failed uploads"
- Auto-delete with expiry badges, a 3-day warning banner, and a daily cleanup job
- Old links keep working when a title (and so its slug) changes
- WhatsApp/Facebook link previews through `/api/og`
- Multiple admins, created and managed from `/admin/admins`

## Folder structure

```
api/                 Vercel serverless functions (service-role key lives only here)
  _lib/              shared helpers (not exposed as routes)
  admin/             create-admin, update-admin, delete-admin, run-cleanup
  cron/cleanup.ts    daily expiry cleanup (CRON_SECRET protected)
  og.ts              link-preview HTML for WhatsApp/Facebook bots
src/
  pages/             Landing, Login, Dashboard, NewCar, EditCar, Admins, PublicCar, NotFound
  components/        CarForm, FileGrid, UploadZone, Gallery, ShareBox, ...
  hooks/             useAuth, useItems, useDebounced
  lib/               supabase client, upload + ZIP logic, saveCar, slug, utils
supabase/
  migration.sql                      tables, RLS, RPCs, storage bucket + policies
  seed_first_admin.sql               creates the first admin row
  cleanup_pg_cron_alternative.sql    optional pg_cron scheduler
vercel.json          SPA rewrite, bot rewrite to /api/og, daily cron
```

## Local development

```bash
npm install
cp .env.example .env     # fill in the values
npm run dev              # frontend only (admin/public pages work; /api functions do not)
npx vercel dev           # frontend + /api functions together (needs the Vercel CLI)
```

`npm run build` makes the production bundle. `npm run typecheck` runs the TypeScript checker.
